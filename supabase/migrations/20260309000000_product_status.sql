-- Add status to products (draft → active → sold)
alter table public.products
  add column status text not null default 'draft'
  check (status in ('draft', 'active', 'sold'));

-- Admin write policies (authenticated users = shop admin)
create policy "products: authenticated insert" on public.products
  for insert with check (auth.role() = 'authenticated');

create policy "products: authenticated update" on public.products
  for update using (auth.role() = 'authenticated');

create policy "product_images: authenticated insert" on public.product_images
  for insert with check (auth.role() = 'authenticated');

-- Storage bucket for product photos
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
