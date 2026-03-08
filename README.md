# Daily Drop Shop

Мобильное приложение (iOS + Android) — секонд-хенд магазин одежды с ежедневными дропами.
Каждая вещь уникальна. Дропы выходят раз в день — опоздал, не успел.

## Быстрый старт

### 1. Зависимости

```bash
pnpm install
```

### 2. Переменные окружения

```bash
cp apps/mobile/.env.example apps/mobile/.env
# Заполнить EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Supabase (локально)

```bash
# Запустить локальный Supabase (Docker должен быть запущен)
pnpm supabase start

# Применить миграции и seed-данные
pnpm supabase db reset
```

После `db reset` доступны:
- Studio: http://127.0.0.1:54323
- API URL: http://127.0.0.1:54321
- Тестовый юзер: `test@test.test` / `test123`

### 4. Запуск приложения

```bash
# Web (основной режим разработки)
pnpm --filter mobile web -- --clear

# iOS / Android (требует нативной сборки через EAS)
pnpm --filter mobile start
```

> SDK 55 несовместим с Expo Go — разработка ведётся в web-режиме.

## Команды

```bash
pnpm --filter mobile typecheck   # TypeScript
pnpm --filter mobile lint        # ESLint
pnpm --filter mobile test        # Jest
pnpm --filter mobile build       # EAS Build
```

## Supabase

```bash
pnpm supabase start    # запустить
pnpm supabase stop     # остановить
pnpm supabase db reset # сбросить БД + применить миграции + seed
```

## Архитектура

См. [docs/architecture.md](docs/architecture.md) и [docs/decisions/](docs/decisions/).
