-- profiles: extends auth.users
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  phone       text,
  address     text,
  push_token  text,
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
  status          text not null default 'draft' check (status in ('draft', 'active', 'sold')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- product_images: multiple photos per product
create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  url         text not null,
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
