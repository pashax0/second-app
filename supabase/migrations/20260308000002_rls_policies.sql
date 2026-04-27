-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.drops enable row level security;
alter table public.drop_items enable row level security;
alter table public.reservations enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.supply_lots enable row level security;
alter table public.returns enable row level security;
alter table public.write_offs enable row level security;

-- Helper: is the current user an admin?
-- Used in policies to avoid repeating the subquery.
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  )
$$;

-- profiles: users can read/update their own profile only
create policy "profiles: own read" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: own update" on public.profiles
  for update using (auth.uid() = id);

-- products: public read; authenticated write (admin only in practice)
create policy "products: public read" on public.products
  for select using (true);

create policy "products: authenticated insert" on public.products
  for insert with check (auth.role() = 'authenticated');

create policy "products: authenticated update" on public.products
  for update using (auth.role() = 'authenticated');

create policy "products: authenticated delete" on public.products
  for delete using (auth.role() = 'authenticated');

-- product_images: public read; admin write
create policy "product_images: public read" on public.product_images
  for select using (true);

create policy "product_images: authenticated insert" on public.product_images
  for insert with check (auth.role() = 'authenticated');

create policy "product_images: authenticated delete" on public.product_images
  for delete using (auth.role() = 'authenticated');

-- drops: public read (active and archived only); admin reads all + full write
create policy "drops: public read" on public.drops
  for select using (status in ('active', 'archived'));

create policy "drops: admin read all" on public.drops
  for select using (public.is_admin());

create policy "drops: authenticated insert" on public.drops
  for insert with check (auth.role() = 'authenticated');

create policy "drops: authenticated update" on public.drops
  for update using (auth.role() = 'authenticated');

create policy "drops: authenticated delete" on public.drops
  for delete using (auth.role() = 'authenticated');

-- drop_items: public read; admin write
create policy "drop_items: public read" on public.drop_items
  for select using (true);

create policy "drop_items: authenticated insert" on public.drop_items
  for insert with check (auth.role() = 'authenticated');

create policy "drop_items: authenticated delete" on public.drop_items
  for delete using (auth.role() = 'authenticated');

-- reservations: anyone can see non-expired ones (to show timer on storefront)
create policy "reservations: public read active" on public.reservations
  for select using (expires_at > now());

-- admin can see all reservations (including expired)
create policy "reservations: admin read all" on public.reservations
  for select using (public.is_admin());

create policy "reservations: own insert" on public.reservations
  for insert with check (auth.uid() = user_id);

create policy "reservations: own delete" on public.reservations
  for delete using (auth.uid() = user_id);

-- orders: users can read their own; admin reads all
create policy "orders: own read" on public.orders
  for select using (auth.uid() = user_id);

create policy "orders: admin read all" on public.orders
  for select using (public.is_admin());

create policy "orders: authenticated insert" on public.orders
  for insert with check (auth.uid() = user_id);

-- order_items: users can read their own (via order); admin reads all
create policy "order_items: own read" on public.order_items
  for select using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

create policy "order_items: admin read all" on public.order_items
  for select using (public.is_admin());

create policy "order_items: authenticated insert" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

-- supply_lots / returns / write_offs: admin-only (mobile app does not read these)
create policy "supply_lots: admin read" on public.supply_lots
  for select using (public.is_admin());
create policy "supply_lots: admin insert" on public.supply_lots
  for insert with check (public.is_admin());
create policy "supply_lots: admin update" on public.supply_lots
  for update using (public.is_admin());
create policy "supply_lots: admin delete" on public.supply_lots
  for delete using (public.is_admin());

create policy "returns: admin read" on public.returns
  for select using (public.is_admin());
create policy "returns: admin insert" on public.returns
  for insert with check (public.is_admin());
create policy "returns: admin update" on public.returns
  for update using (public.is_admin());
create policy "returns: admin delete" on public.returns
  for delete using (public.is_admin());

create policy "write_offs: admin read" on public.write_offs
  for select using (public.is_admin());
create policy "write_offs: admin insert" on public.write_offs
  for insert with check (public.is_admin());
create policy "write_offs: admin update" on public.write_offs
  for update using (public.is_admin());
create policy "write_offs: admin delete" on public.write_offs
  for delete using (public.is_admin());

-- Storage: product images bucket
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product-images: public read" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "product-images: authenticated upload" on storage.objects
  for insert with check (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
  );

create policy "product-images: authenticated delete" on storage.objects
  for delete using (
    bucket_id = 'product-images'
    and auth.role() = 'authenticated'
  );
