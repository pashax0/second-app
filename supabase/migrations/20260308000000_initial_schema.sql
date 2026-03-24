-- profiles: extends auth.users
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  phone       text,
  address     text,
  push_token  text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- products
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  brand           text,
  country         text,
  size            text,
  measurements    jsonb,          -- {"chest":50,"waist":null,"hips":null,"length":70}
  item_number     text,           -- internal shop number, e.g. "202"
  price           numeric(10,2) not null,
  stock_quantity  int not null default 0,
  -- draft: created, not in active drop
  -- available: in active drop, purchasable
  -- sold: purchased
  status          text not null default 'draft' check (status in ('draft', 'available', 'sold')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- product_images: multiple photos per product
create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create index on public.product_images (product_id, position);

-- drops: a daily drop event
create table public.drops (
  id            uuid primary key default gen_random_uuid(),
  title         text,
  description   text,           -- optional header shown above the item grid
  scheduled_at  timestamptz not null,
  published_at  timestamptz,
  -- draft → active → archived
  status        text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- drop_items: which products are in a drop, with optional price override
-- override_price: if set, shown as "new price"; product.price shown as "old price"
create table public.drop_items (
  id              uuid primary key default gen_random_uuid(),
  drop_id         uuid not null references public.drops(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete cascade,
  quantity        int not null default 1,
  position        int not null default 0,  -- display order in the grid
  override_price  numeric(10,2),           -- nullable; enables strikethrough pricing in future
  created_at      timestamptz not null default now(),
  unique (drop_id, product_id)
);

-- reservations: cart state (temporary, replaces 'reserved' product status)
-- A product is "in cart" if a non-expired row exists here.
-- No background cleanup needed — expired rows are ignored on read.
create table public.reservations (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  drop_id     uuid not null references public.drops(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  unique (product_id)  -- one active reservation per product
);

create index on public.reservations (product_id, expires_at);
create index on public.reservations (user_id);

-- orders
create table public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id),
  drop_id           uuid references public.drops(id),
  status            text not null default 'pending' check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  delivery_address  text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on public.orders (user_id);

-- order_items: snapshot of price at purchase time
create table public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders(id) on delete cascade,
  product_id          uuid not null references public.products(id),
  quantity            int not null default 1,
  price_at_purchase   numeric(10,2) not null,
  created_at          timestamptz not null default now()
);

create index on public.order_items (order_id);

-- auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.drops
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- Enable Realtime for reservations (needed for live cart/timer updates across browsers)
alter publication supabase_realtime add table public.reservations;

-- Atomically creates a reservation, enforcing anonymous cart limit and expiring stale reservations.
-- SECURITY DEFINER: needs to call expire_reservation (itself SECURITY DEFINER) and bypass RLS on insert.
-- Safe: only operates on auth.uid() — target cannot be spoofed by the client.
create or replace function public.create_reservation(
  p_product_id uuid,
  p_drop_id     uuid,
  p_expires_at  timestamptz
)
returns void language plpgsql security definer as $$
begin
  -- Enforce 1-item limit for anonymous users
  -- Query auth.users directly — auth.jwt() ->> 'is_anonymous' is unreliable in local dev.
  if (select is_anonymous from auth.users where id = auth.uid()) then
    if (
      select count(*) from public.reservations
      where user_id = auth.uid()
        and expires_at > now()
    ) >= 1 then
      raise exception 'anon_cart_limit';
    end if;
  end if;

  -- Expire any stale reservation for this product before inserting
  perform public.expire_reservation(p_product_id);

  insert into public.reservations (product_id, user_id, drop_id, expires_at)
  values (p_product_id, auth.uid(), p_drop_id, p_expires_at);
end;
$$;

-- Deletes an expired reservation for a specific product, triggering a Realtime DELETE event.
-- SECURITY DEFINER: RLS allows deleting only own rows, but any authenticated client
-- may need to expire a reservation belonging to another user (e.g. before inserting their own).
-- Safe: only deletes rows where expires_at < now() — cannot remove active reservations.
create or replace function public.expire_reservation(p_product_id uuid)
returns void language plpgsql security definer as $$
begin
  delete from public.reservations
  where product_id = p_product_id
    and expires_at < now();
end;
$$;

-- pg_cron fallback: cleans up reservations that nobody expired client-side (case E in ADR-004).
-- Requires pg_cron extension; silently skipped if unavailable (e.g. local dev without pg_cron).
do $outer$ begin
  perform cron.schedule(
    'expire-reservations',
    '*/5 * * * *',
    'delete from public.reservations where expires_at < now()'
  );
exception when others then
  null;
end $outer$;

-- Transfer non-expired reservations from an anonymous user to the currently signed-in user.
-- Used when an anonymous user signs into an existing account.
-- SECURITY DEFINER: runs as owner, bypassing RLS to update rows owned by another user.
-- Safety: target is always auth.uid() (cannot be spoofed by the client).
create or replace function public.transfer_reservations(anon_user_id uuid)
returns void language plpgsql security definer as $$
begin
  -- Skip products the real user already has reserved (unique constraint on product_id)
  update public.reservations
  set user_id = auth.uid()
  where user_id = anon_user_id
    and expires_at > now()
    and product_id not in (
      select product_id from public.reservations
      where user_id = auth.uid() and expires_at > now()
    );
end;
$$;
