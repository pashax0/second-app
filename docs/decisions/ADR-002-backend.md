# ADR-002: Backend

**Date:** 2026-03-07
**Status:** accepted

## Context

Нужно выбрать backend для мобильного приложения.
Требования: auth (Google, Apple, Email), хранение данных о товарах/заказах/пользователях,
хранилище изображений, scheduled jobs для дропов, push-уведомления, быстрый MVP.

## Decision

**Supabase**

## Considered alternatives

| Option | Pros | Cons |
|---|---|---|
| Supabase (chosen) | PostgreSQL (реляционная схема), встроенный auth с OAuth, Storage, real-time, Edge Functions, pg_cron, Row Level Security, TypeScript SDK, локальная разработка через CLI | Vendor lock-in (митигируется — под капотом стандартный Postgres) |
| Firebase | Хорошо известен, real-time, FCM нативно | NoSQL (неудобно для реляционных данных), Firestore дороже при масштабировании |
| NestJS + PostgreSQL custom | Полный контроль | Много boilerplate, медленный MVP, нужен отдельный деплой |

## Consequences

- Auth через Supabase Auth (Google, Apple, Email/Password)
- JWT сессии, хранятся в `expo-secure-store`
- Все таблицы защищены через Row Level Security
- Scheduled drops реализованы через `pg_cron` + Edge Functions
- Суpabase Storage для изображений товаров
- Миграции версионируются в `supabase/migrations/`

## Notes

- Для локальной разработки: `supabase start` (Docker)
- При росте: Supabase self-hosted или миграция на чистый Postgres + собственный auth
