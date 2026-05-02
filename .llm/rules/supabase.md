# Supabase

## Before answering any Supabase question

1. Fetch актуальную документацию:
   - Полная дока: `https://supabase.com/docs/llms-full.txt`
   - (или индекс, если нужен конкретный раздел): `https://supabase.com/docs/llms.txt`
2. Проверь реальное состояние проекта через MCP (локальный Supabase MCP на `http://127.0.0.1:54321/mcp`)
3. Только после этого — предлагай решение

## Scope

Всё, что касается Supabase: схема БД, миграции, RLS, RPC, auth, storage, edge functions, real-time.
Деплой мобильного приложения — отдельные правила (`deploy-mobile.md`).

## Контекст проекта

- Локальный Supabase: `http://127.0.0.1:54321`
- MCP endpoint: `http://127.0.0.1:54321/mcp` (доступен только при запущенном `pnpm supabase start`)
- Миграции: `supabase/migrations/`
- Seed: `supabase/seed.sql`
- Сбросить БД: `pnpm supabase db reset`

## Конвенция миграций (на время разработки)

Пока приложение в разработке и нет данных для сохранения — миграции трактуем как «способ применить схему», а не immutable history.

- Базовые файлы (`20260308000000_initial_schema.sql`, `…002_rls_policies.sql`, `…003_seed_dev_data.sql`, `…004_create_order_fn.sql`, `…005_lifecycle_rpcs.sql`) правим напрямую.
- Временные «patch»-миграции не плодим. Новые DDL/RPC/RLS/view добавляем в соответствующий базовый файл — или одной новой миграцией, если concern явно отдельный.
- Применяем через `pnpm supabase db reset` + `pnpm seed:storage` (reset вайпает Storage).
- Поддержка старых типов и фолбеки не нужны.

Когда появятся прод-данные — переключаемся на классический режим (миграции immutable, изменения только новыми файлами).
