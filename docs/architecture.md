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
        index.tsx         # Витрина (текущий дроп)
        cart.tsx          # Корзина с таймерами резерваций
        profile.tsx       # Профиль + выход
      item/
        [id].tsx          # Карточка товара
      checkout.tsx        # Оформление заказа (modal)
      my-orders.tsx       # История заказов
      _layout.tsx         # Root layout (auth guard + providers)
    lib/
      supabase.ts         # Supabase client
      queryKeys.ts        # TanStack Query keys
      snackbar.tsx        # SnackbarProvider для ошибок
      grid.ts             # Утилиты сетки витрины
    hooks/
      useActiveDrop.ts    # Активный дроп с товарами
      useCart.ts          # Корзина (reservations от текущего юзера)
      useReservations.ts  # Realtime подписка + expiry trigger
    stores/
      auth.ts             # Zustand: сессия пользователя
    components/
      RegistrationGateSheet.tsx  # Гейт для анонимных при checkout

  admin/                  # Vite/React веб-панель администратора — см. apps/admin/architecture.md

packages/
  shared/                 # placeholder

supabase/
  migrations/             # SQL миграции (версионированные)
  seed.sql                # Dev seed: тестовый юзер (запускается при db reset)
  seed-images/            # Сиды изображений для Storage (pnpm seed:storage)
  snippets/               # SQL-заготовки
```

## Key Decisions

See [decisions/](./decisions/) for Architecture Decision Records.

- [ADR-001](./decisions/ADR-001-mobile-framework.md) — выбор мобильного фреймворка
- [ADR-002](./decisions/ADR-002-backend.md) — выбор backend
- [ADR-003](./decisions/ADR-003-admin-service.md) — отдельный веб-сервис для админки

## Data Flow

### Просмотр товаров

```
Mobile App → TanStack Query → Supabase REST API → PostgreSQL
  ← JSON response ← RLS-filtered data
```

### Резервации (корзина)

```
Add to cart → INSERT в reservations (status=reserved, expires_at=+10m)
  → Realtime publication → WebSocket → все клиенты invalidateQueries
  → countdown на каждом клиенте → при expires_at==0 → jitter + expire_reservation RPC
  → DELETE → Realtime → всем видно "доступно"
  → pg_cron каждые 5 мин как fallback (см. ADR-004)
```

### Аутентификация

```
Mobile App → Supabase Auth (Email/Password или anonymous sign-in)
  → JWT session → default storage Supabase JS client
  → автообновление через клиент
```

### Ежедневный дроп (не реализовано)

Публикация дропов сейчас вручную через admin. Автоматизация (pg_cron → Edge Function →
Expo Push → FCM/APNs) — запланирована, но не реализована (нет `supabase/functions/` и
push-инфраструктуры).

## External Dependencies

| Сервис | Назначение |
|---|---|
| Supabase | Auth, БД, Storage, Edge Functions, Real-time |
| Expo EAS | Сборка и доставка приложения |
| Expo Push | Агрегатор push-уведомлений (FCM + APNs) |
