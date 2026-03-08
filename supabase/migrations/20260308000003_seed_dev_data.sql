-- Dev seed: 3 drops with real secondhand clothing items from Instagram posts
-- Uses fixed UUIDs + do update so safe to run on every db reset

-- ── Products ────────────────────────────────────────────────────────────────
-- Drop #1 items (4 шт, все проданы кроме одного — FOMO в архиве)

insert into public.products (id, name, brand, country, size, measurements, item_number, price, stock_quantity) values
  (
    '11111111-0000-0000-0000-000000000001',
    'Флисовая курточка',
    'Regatta', 'England', 'M',
    '{"chest":50,"length":70}',
    '202', 1990.00, 0
  ),
  (
    '11111111-0000-0000-0000-000000000002',
    'Свитшот оверсайз',
    'George', 'England', 'L',
    '{"chest":60,"length":65}',
    '54', 1990.00, 0
  ),
  (
    '11111111-0000-0000-0000-000000000003',
    'Брюки классические',
    'YOURS', 'England', 'XL',
    '{"waist":50,"hips":60,"length":110}',
    '331', 1990.00, 0
  ),
  (
    '11111111-0000-0000-0000-000000000004',
    'Спортивные брюки',
    'M&S', 'England', 'L',
    '{"waist":42,"hips":50,"length":90}',
    '43', 1990.00, 1  -- не продали, можно купить из архива
  ),

-- Drop #2 items (PLT — 4 шт, большинство продано)

  (
    '11111111-0000-0000-0000-000000000005',
    'Блуза',
    'Pretty Little Thing', 'England', 'XS',
    '{"chest":42,"length":50}',
    '143', 2990.00, 0
  ),
  (
    '11111111-0000-0000-0000-000000000006',
    'Свитшот на флисе оверсайз',
    'Pretty Little Thing', 'England', 'S',
    '{"chest":55,"length":70}',
    '146', 2990.00, 0
  ),
  (
    '11111111-0000-0000-0000-000000000007',
    'Удлинённая худи на флисе оверсайз',
    'Pretty Little Thing', 'England', '3XL',
    '{"chest":80,"length":100}',
    '148', 2990.00, 1  -- осталась
  ),
  (
    '11111111-0000-0000-0000-000000000008',
    'Джинсы',
    'Pretty Little Thing', 'England', 'L',
    '{"waist":40,"hips":50,"length":120}',
    '177', 2990.00, 0
  ),

-- Drop #3 items (активный, 4 шт — 1 продана для FOMO)

  (
    '11111111-0000-0000-0000-000000000009',
    'Рубашка оверсайз',
    'Primark', 'England', 'L',
    '{"chest":70,"length":85}',
    '35', 1990.00, 1
  ),
  (
    '11111111-0000-0000-0000-000000000010',
    'Платье миди',
    'Papaya', 'England', 'S',
    '{"chest":44,"length":100}',
    '77', 1990.00, 1
  ),
  (
    '11111111-0000-0000-0000-000000000011',
    'Куртка с подкладкой',
    'Abercrombie & Fitch', 'USA', 'M/L',
    '{"chest":50,"length":60}',
    '168', 2990.00, 1
  ),
  (
    '11111111-0000-0000-0000-000000000012',
    'Куртка оверсайз',
    'Crane', 'England', 'M',
    '{"chest":60,"length":70}',
    '46', 1990.00, 0  -- продана, FOMO
  )
on conflict (id) do update set
  name         = excluded.name,
  brand        = excluded.brand,
  country      = excluded.country,
  size         = excluded.size,
  measurements = excluded.measurements,
  item_number  = excluded.item_number,
  price        = excluded.price,
  stock_quantity = excluded.stock_quantity;

-- ── Drops ───────────────────────────────────────────────────────────────────

insert into public.drops (id, description, scheduled_at, published_at, status) values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    null,
    now() - interval '14 days',
    now() - interval '14 days',
    'archived'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    'Сток от крутого английского бренда Pretty Little Thing London ❤️',
    now() - interval '7 days',
    now() - interval '7 days',
    'archived'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000003',
    null,
    now(),
    now(),
    'active'
  )
on conflict (id) do update set
  description  = excluded.description,
  scheduled_at = excluded.scheduled_at,
  published_at = excluded.published_at,
  status       = excluded.status;

-- ── Drop items ──────────────────────────────────────────────────────────────

insert into public.drop_items (drop_id, product_id, quantity, position, override_price) values
  -- Drop #1
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 1, 1, null),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 1, 2, null),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 1, 3, null),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000004', 1, 4, null),
  -- Drop #2
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000005', 1, 1, null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000006', 1, 2, null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000007', 1, 3, null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000008', 1, 4, null),
  -- Drop #3 (active)
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000009', 1, 1, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000010', 1, 2, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000011', 1, 3, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000012', 1, 4, null)
on conflict (drop_id, product_id) do update set
  position = excluded.position;
