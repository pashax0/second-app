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

-- products: public read; admin write
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

create policy "drops: authenticated read all" on public.drops
  for select using (auth.role() = 'authenticated');

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
