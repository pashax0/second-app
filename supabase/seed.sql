-- Dev seed: users + orders
-- Runs automatically on every `supabase db reset`

-- ── Users ────────────────────────────────────────────────────────────────────

-- Admin: admin@test.com / admin123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  'dddddddd-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'admin@test.com',
  crypt('admin123', gen_salt('bf')),
  now(), now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into public.profiles (id, name, is_admin) values (
  'dddddddd-0000-0000-0000-000000000001',
  'Admin',
  true
) on conflict (id) do update set name = excluded.name, is_admin = excluded.is_admin;

-- Customer: test@test.test / test123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  'cccccccc-0000-0000-0000-000000000001',
  'authenticated', 'authenticated',
  'test@test.test',
  crypt('test123', gen_salt('bf')),
  now(), now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into public.profiles (id, name, phone, address, is_admin) values (
  'cccccccc-0000-0000-0000-000000000001',
  'Алексей Тестовый',
  '+7 916 000 00 01',
  'Москва, ул. Арбат, д. 1, кв. 42',
  false
) on conflict (id) do update set
  name     = excluded.name,
  phone    = excluded.phone,
  address  = excluded.address,
  is_admin = excluded.is_admin;

-- ── Orders ────────────────────────────────────────────────────────────────────
-- Simulate purchase history so drop analytics are testable.

insert into public.orders (id, user_id, drop_id, status, delivery_address) values
  -- Drop #1 (archived): 2 orders
  (
    'eeeeeeee-0000-0000-0000-000000000001',
    'cccccccc-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'delivered',
    'Москва, ул. Арбат, д. 1, кв. 42'
  ),
  (
    'eeeeeeee-0000-0000-0000-000000000002',
    'cccccccc-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'delivered',
    'Москва, ул. Арбат, д. 1, кв. 42'
  ),
  -- Drop #2 (archived): 2 orders
  (
    'eeeeeeee-0000-0000-0000-000000000003',
    'cccccccc-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'delivered',
    'Москва, ул. Арбат, д. 1, кв. 42'
  ),
  (
    'eeeeeeee-0000-0000-0000-000000000004',
    'cccccccc-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'delivered',
    'Москва, ул. Арбат, д. 1, кв. 42'
  ),
  -- Drop #3 (active): 1 order (FOMO — Crane куртка оверсайз)
  (
    'eeeeeeee-0000-0000-0000-000000000005',
    'cccccccc-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000003',
    'confirmed',
    'Москва, ул. Арбат, д. 1, кв. 42'
  )
on conflict (id) do nothing;

insert into public.order_items (order_id, product_id, quantity, price_at_purchase) values
  -- Drop #1 order 1: Regatta, George, YOURS
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 1, 1990.00),
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 1, 1990.00),
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003', 1, 1990.00),
  -- Drop #1 order 2: Wrangler, F&F (discount), Columbia, River Island
  ('eeeeeeee-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000013', 1, 2490.00),
  ('eeeeeeee-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000014', 1, 2990.00),
  ('eeeeeeee-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000016', 1, 2990.00),
  ('eeeeeeee-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000018', 1, 1490.00),
  -- Drop #2 order 3: PLT x4
  ('eeeeeeee-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000005', 1, 2990.00),
  ('eeeeeeee-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000006', 1, 2990.00),
  ('eeeeeeee-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000008', 1, 2990.00),
  ('eeeeeeee-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000019', 1, 1490.00),
  -- Drop #2 order 4: PLT x3
  ('eeeeeeee-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000021', 1, 2490.00),
  ('eeeeeeee-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000023', 1, 2490.00),
  ('eeeeeeee-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000024', 1, 1990.00),
  -- Drop #3 order 5: Crane оверсайз (FOMO)
  ('eeeeeeee-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000012', 1, 1990.00)
on conflict do nothing;
