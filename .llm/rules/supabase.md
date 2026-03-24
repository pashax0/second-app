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
