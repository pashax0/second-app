-- Enable Supabase Realtime for product/drop tables so clients receive live
-- INSERT/UPDATE/DELETE events. Paired with TanStack Query invalidation:
-- event → invalidate query keys → normal HTTP refetch. Used by admin list,
-- EditProduct, and mobile useActiveDrop.
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.product_images;
alter publication supabase_realtime add table public.drops;
alter publication supabase_realtime add table public.drop_items;
