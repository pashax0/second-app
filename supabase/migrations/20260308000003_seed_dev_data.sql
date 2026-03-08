-- Dev seed data: 1 active drop with 3 products
-- This migration is safe to run multiple times (uses fixed UUIDs)

insert into public.products (id, name, description, price, stock_quantity) values
  (
    '11111111-0000-0000-0000-000000000001',
    'Кожаный кошелёк ручной работы',
    'Натуральная кожа, ручная прошивка. Есть отсек для карт и купюр.',
    2490.00,
    3
  ),
  (
    '11111111-0000-0000-0000-000000000002',
    'Льняная рубашка оверсайз',
    '100% лён. Свободный крой, летняя коллекция.',
    4900.00,
    0  -- sold out for FOMO effect
  ),
  (
    '11111111-0000-0000-0000-000000000003',
    'Деревянный кулон «Северный лес»',
    'Ручная резьба по кедру. Каждый уникален.',
    1200.00,
    5
  )
on conflict (id) do nothing;

insert into public.drops (id, title, scheduled_at, published_at, status) values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Дроп #1 — Лето 2026',
    now(),
    now(),
    'active'
  )
on conflict (id) do nothing;

insert into public.drop_items (drop_id, product_id, quantity, override_price) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 3, null),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 1, null),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 5, null)
on conflict (drop_id, product_id) do nothing;
