# ADR-003: Admin Interface as Separate Web Service

**Date:** 2026-03-09
**Status:** accepted

## Context

Нужен интерфейс для управления магазином: создание товаров, дропов, публикация.
Вопрос: где разместить — внутри мобильного приложения или отдельный сервис?

## Decision

**Отдельное веб-приложение `apps/admin` в монорепе**

## Considered alternatives

| Option | Pros | Cons |
|---|---|---|
| Отдельный веб-сервис (chosen) | Удобная загрузка фото с компьютера, полноценный UI без ограничений RN, независимый деплой, не засоряет мобильное приложение | Ещё одно приложение в монорепе |
| Таб в мобильном приложении | Уже в существующей кодовой базе | Неудобно загружать фото, ограниченный UI React Native, смешивает пользовательский и adminский UX |

## Consequences

- `apps/admin` — Vite + React + TypeScript + Tailwind CSS
- Тот же Supabase проект, тот же Storage bucket `product-images`
- Auth через Supabase Auth (email/password, только владелец)
- Деплой независим от мобильного приложения

## Notes

- Shared-типы можно выносить в `packages/shared` по мере роста
