-- Dev seed data: 3 drops (2 archived, 1 active) with 10 unique secondhand clothing items
-- This migration is safe to run multiple times (uses fixed UUIDs + do update)
-- Domain: each item is unique, stock_quantity=1; sold-out items kept for FOMO/archive

-- ── Products ────────────────────────────────────────────────────────────────

insert into public.products (id, name, description, price, stock_quantity) values
  -- Drop #1 (archived, 2 weeks ago)
  (
    '11111111-0000-0000-0000-000000000001',
    'Куртка Levi''s vintage 90-х, M',
    'Джинсовая куртка, плотная ткань, лёгкий износ — это история, не дефект.',
    3200.00,
    0  -- sold out
  ),
  (
    '11111111-0000-0000-0000-000000000002',
    'Шерстяное пальто Zara, S',
    'Бежевое пальто-кокон, 70% шерсть. Состояние отличное, без катышков.',
    4500.00,
    0  -- sold out
  ),
  (
    '11111111-0000-0000-0000-000000000003',
    'Хлопковый свитер оверсайз, L',
    'Мягкий крупной вязки, тёмно-зелёный. Носили один сезон.',
    1800.00,
    0  -- sold out
  ),
  -- Drop #2 (archived, 1 week ago)
  (
    '11111111-0000-0000-0000-000000000004',
    'Ветровка Columbia, XL',
    'Лёгкая непромокаемая ветровка, синяя. Швы проклеены, все молнии целы.',
    2900.00,
    0  -- sold out
  ),
  (
    '11111111-0000-0000-0000-000000000005',
    'Льняные брюки прямые, M',
    '100% лён, молочный цвет. Стрелки, высокая посадка.',
    2100.00,
    0  -- sold out
  ),
  (
    '11111111-0000-0000-0000-000000000006',
    'Платье миди H&M Conscious, S',
    'Вискоза, принт в мелкий цветок. Состояние: отличное, без пятен.',
    1600.00,
    1
  ),
  (
    '11111111-0000-0000-0000-000000000007',
    'Кожаный ремень Massimo Dutti',
    'Натуральная кожа, коричневый, ширина 3 см. Практически не использовался.',
    900.00,
    0  -- sold out
  ),
  -- Drop #3 (active — сегодня)
  (
    '11111111-0000-0000-0000-000000000008',
    'Пуховик Uniqlo Ultra Light, M',
    'Ультралёгкий, чёрный, складывается в карман. Один сезон носки.',
    5200.00,
    1
  ),
  (
    '11111111-0000-0000-0000-000000000009',
    'Джинсы Weekday, 28/32',
    'Прямой крой, светло-серый деним. Фирменная бирка на месте.',
    2400.00,
    0  -- sold out for FOMO
  ),
  (
    '11111111-0000-0000-0000-000000000010',
    'Шёлковая блуза COS, XS',
    '100% шёлк, пудровый розовый. Стирка деликатная, без дефектов.',
    3100.00,
    1
  )
on conflict (id) do update set
  name          = excluded.name,
  description   = excluded.description,
  price         = excluded.price,
  stock_quantity = excluded.stock_quantity;

-- ── Drops ───────────────────────────────────────────────────────────────────

insert into public.drops (id, title, scheduled_at, published_at, status) values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'Дроп #1 — Зима 2026',
    now() - interval '14 days',
    now() - interval '14 days',
    'archived'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    'Дроп #2 — Февраль 2026',
    now() - interval '7 days',
    now() - interval '7 days',
    'archived'
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000003',
    'Дроп #3 — Весна 2026',
    now(),
    now(),
    'active'
  )
on conflict (id) do update set
  title       = excluded.title,
  scheduled_at = excluded.scheduled_at,
  published_at = excluded.published_at,
  status      = excluded.status;

-- ── Drop items ──────────────────────────────────────────────────────────────

insert into public.drop_items (drop_id, product_id, quantity, override_price) values
  -- Drop #1
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 1, null),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 1, null),
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 1, null),
  -- Drop #2
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000004', 1, null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000005', 1, null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000006', 1, null),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000007', 1, null),
  -- Drop #3 (active)
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000008', 1, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000009', 1, null),
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000010', 1, null)
on conflict (drop_id, product_id) do nothing;
