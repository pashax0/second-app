# Architecture

## Overview

Daily Drop Shop — секонд-хенд магазин одежды. Monorepo с мобильным приложением на Expo/React Native и Supabase в качестве backend.

### Домен

- Все товары — одежда, каждая вещь уникальна (1 экз.), `stock_quantity` по умолчанию = 1
- Исключения (несколько штук одного товара) возможны, поле `stock_quantity` в БД сохраняется
- В UI количество **не показывается** — только статус «в наличии / распродано»
- Заказ всегда на 1 единицу товара, quantity-поля в форме нет
- Оплата: наложенный платёж (cash on delivery), платёжная система в MVP отсутствует

```
┌─────────────────────────────────────────┐
│           Mobile App (Expo RN)          │
│  ┌──────────┐  ┌──────────────────────┐ │
│  │ Expo     │  │ TanStack Query       │ │
│  │ Router   │  │ (server state)       │ │
│  └──────────┘  └──────────────────────┘ │
│  ┌──────────┐  ┌──────────────────────┐ │
│  │ Zustand  │  │ Supabase JS client   │ │
│  │ (client) │  │                      │ │
│  └──────────┘  └──────────────────────┘ │
└─────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│              Supabase                   │
│  ┌──────────┐  ┌──────────────────────┐ │
│  │ Auth     │  │ PostgreSQL           │ │
│  │ (OAuth)  │  │ (products, orders..) │ │
│  └──────────┘  └──────────────────────┘ │
│  ┌──────────┐  ┌──────────────────────┐ │
│  │ Storage  │  │ Edge Functions       │ │
│  │ (images) │  │ (drops, notifs)      │ │
│  └──────────┘  └──────────────────────┘ │
└─────────────────────────────────────────┘
```

## Folder Structure

```
apps/
  mobile/
    app/                  # Expo Router screens (file-based routing)
      (auth)/             # Auth screens (login, register)
      (tabs)/             # Main tab navigation
        index.tsx         # Сегодняшний дроп
        archive.tsx       # Архив товаров
        favorites.tsx     # Избранное
        profile.tsx       # Профиль
      product/[id].tsx    # Страница товара
      _layout.tsx         # Root layout (notifications, auth guard)
    components/           # Переиспользуемые компоненты
    lib/
      supabase.ts         # Supabase client
      queryKeys.ts        # TanStack Query keys
    hooks/                # Custom React hooks
    store/                # Zustand stores

packages/
  shared/
    types/                # TypeScript типы (Product, Order, User...)
    schemas/              # Zod schemas (валидация)

supabase/
  migrations/             # SQL миграции (версионированные)
  functions/              # Edge Functions
    schedule-drop/        # Запуск нового дропа по расписанию
    send-notifications/   # Push-уведомления при дропе
```

## Key Decisions

See [decisions/](./decisions/) for Architecture Decision Records.

- [ADR-001](./decisions/ADR-001-mobile-framework.md) — выбор мобильного фреймворка
- [ADR-002](./decisions/ADR-002-backend.md) — выбор backend

## Data Flow

### Ежедневный дроп

```
pg_cron (Supabase) → Edge Function: schedule-drop
  → создаёт drop запись в БД
  → Edge Function: send-notifications
    → Expo Push API → FCM / APNs → устройства
```

### Просмотр товаров

```
Mobile App → TanStack Query → Supabase REST API → PostgreSQL
  ← JSON response ← RLS-filtered data
```

### Аутентификация

```
Mobile App → Supabase Auth (Google / Apple / Email)
  → JWT session → хранится в SecureStore
  → автообновление через Supabase JS client
```

## External Dependencies

| Сервис | Назначение |
|---|---|
| Supabase | Auth, БД, Storage, Edge Functions, Real-time |
| Expo EAS | Сборка и доставка приложения |
| Expo Push | Агрегатор push-уведомлений (FCM + APNs) |
