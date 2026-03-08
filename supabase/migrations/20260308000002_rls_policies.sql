-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.drops enable row level security;
alter table public.drop_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- profiles: users can read/update their own profile only
create policy "profiles: own read" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: own update" on public.profiles
  for update using (auth.uid() = id);

-- products: public read
create policy "products: public read" on public.products
  for select using (true);

-- product_images: public read
create policy "product_images: public read" on public.product_images
  for select using (true);

-- drops: public read (active and archived only; drafts hidden)
create policy "drops: public read" on public.drops
  for select using (status in ('active', 'archived'));

-- drop_items: public read
create policy "drop_items: public read" on public.drop_items
  for select using (true);

-- orders: users can read their own orders
create policy "orders: own read" on public.orders
  for select using (auth.uid() = user_id);

-- orders: authenticated users can insert
create policy "orders: authenticated insert" on public.orders
  for insert with check (auth.uid() = user_id);

-- order_items: users can read their own order items (via order)
create policy "order_items: own read" on public.order_items
  for select using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

-- order_items: authenticated insert
create policy "order_items: authenticated insert" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );
