# Architecture

## Overview

Daily Drop Shop — секонд-хенд магазин одежды. Monorepo с мобильным приложением на Expo/React Native, веб-панелью администратора на Vite/React и Supabase в качестве backend.

### Домен

- Все товары — одежда, каждая вещь уникальна (1 экз.), `stock_quantity` по умолчанию = 1
- Исключения (несколько штук одного товара) возможны, поле `stock_quantity` в БД сохраняется
- В UI количество **не показывается** — только статус «в наличии / распродано»
- Заказ всегда на 1 единицу товара, quantity-поля в форме нет
- Оплата: наложенный платёж (cash on delivery), платёжная система в MVP отсутствует

```
┌─────────────────────────────────────────┐
│           Mobile App (Expo RN)          │
│  Expo Router · TanStack Query           │
│  Zustand · Supabase JS client           │
└─────────────────────────────────────────┘
                     │
┌─────────────────────────────────────────┐
│         Admin Panel (Vite/React)        │
│  React Router · TanStack Query          │
│  React Hook Form · Supabase JS client   │
└─────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│              Supabase                   │
│  ┌──────────┐  ┌──────────────────────┐ │
│  │ Auth     │  │ PostgreSQL           │ │
│  │ (Email)  │  │ (products, orders..) │ │
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
      (auth)/             # Auth screens
        sign-in.tsx
        sign-up.tsx
      (tabs)/             # Main tab navigation
        index.tsx         # Сегодняшний дроп
        archive.tsx       # Архив дропов
        profile.tsx       # Профиль + выход
      checkout.tsx        # Оформление заказа (modal)
      my-orders.tsx       # История заказов
      _layout.tsx         # Root layout (auth guard)
    lib/
      supabase.ts         # Supabase client
      queryKeys.ts        # TanStack Query keys
    hooks/
      useActiveDrop.ts    # Активный дроп с товарами
    stores/
      auth.ts             # Zustand: сессия пользователя

  admin/                  # Vite/React веб-панель администратора
    src/
      pages/
        Login.tsx         # /login
        Products.tsx      # /products
        Drops.tsx         # /drops
      App.tsx             # React Router setup
      main.tsx            # Entry point + QueryClientProvider
    lib/
      supabase.ts         # Supabase client

packages/
  shared/                 # placeholder

supabase/
  migrations/             # SQL миграции (версионированные)
  seed.sql                # Dev seed: тестовый юзер (запускается при db reset)
  functions/              # Edge Functions (запланировано)
```

## Key Decisions

See [decisions/](./decisions/) for Architecture Decision Records.

- [ADR-001](./decisions/ADR-001-mobile-framework.md) — выбор мобильного фреймворка
- [ADR-002](./decisions/ADR-002-backend.md) — выбор backend
- [ADR-003](./decisions/ADR-003-admin-service.md) — отдельный веб-сервис для админки

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
Mobile App → Supabase Auth (Email/Password)
  → JWT session → хранится в SecureStore
  → автообновление через Supabase JS client
```

## External Dependencies

| Сервис | Назначение |
|---|---|
| Supabase | Auth, БД, Storage, Edge Functions, Real-time |
| Expo EAS | Сборка и доставка приложения |
| Expo Push | Агрегатор push-уведомлений (FCM + APNs) |
