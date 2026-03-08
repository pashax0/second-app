-- Dev seed: test user (test@test.test / test123)
-- Runs automatically on every `supabase db reset`

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  'cccccccc-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'test@test.test',
  crypt('test123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '',
  '',
  ''
) on conflict (id) do nothing;
