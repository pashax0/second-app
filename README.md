# Daily Drop Shop

Мобильное приложение (iOS + Android) — секонд-хенд магазин одежды с ежедневными дропами.
Каждая вещь уникальна. Дропы выходят раз в день — опоздал, не успел.

## Быстрый старт

### 1. Зависимости

```bash
pnpm install
```

### 2. Supabase (локально)

```bash
# Запустить локальный Supabase (Docker должен быть запущен)
pnpm supabase start

# Применить миграции + seed-данные
pnpm supabase db reset

# Загрузить seed-изображения в локальный Storage
pnpm seed:storage
```

После `db reset` + `seed:storage` доступны:
- Studio: http://127.0.0.1:54323
- API URL: http://127.0.0.1:54321
- Тестовый юзер: `test@test.test` / `test123`
- Админ: `admin@test.com` / `admin123`
- Anon key: `pnpm supabase status` → `ANON_KEY`

### 3. Переменные окружения

```bash
# Mobile
cp apps/mobile/.env.example apps/mobile/.env
# Вставить EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY из `pnpm supabase status`

# Admin
cp apps/admin/.env.example apps/admin/.env
# Вставить VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY из `pnpm supabase status`
```

### 4. Запуск

```bash
# Мобильное приложение (web-режим, основной)
pnpm --filter mobile web -- --clear

# Админ-панель (локальная БД)
pnpm --filter admin dev

# Админ-панель (продакшн БД — для добавления товаров в прод)
pnpm --filter admin dev -- --mode production
```

> SDK 55 несовместим с Expo Go — мобильная разработка ведётся в web-режиме.

## Команды

```bash
# Mobile
pnpm --filter mobile typecheck   # TypeScript
pnpm --filter mobile lint        # ESLint
pnpm --filter mobile test        # Jest

# Admin
pnpm --filter admin typecheck    # TypeScript
pnpm --filter admin build        # Production build

# Supabase
pnpm supabase start              # запустить
pnpm supabase stop               # остановить
pnpm supabase db reset           # сбросить БД + миграции + seed
pnpm seed:storage                # загрузить seed-изображения в локальный Storage
pnpm supabase db push            # накатить миграции на продакшн
```

## Деплой

См. [docs/deploy.md](docs/deploy.md) — EAS Build, фокус-группа, продакшн workflow.

## Архитектура

См. [docs/architecture.md](docs/architecture.md) и [docs/decisions/](docs/decisions/).
