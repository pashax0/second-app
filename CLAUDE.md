# Daily Drop Shop

Секонд-хенд магазин одежды с ежедневными дропами.
Каждая вещь уникальна. Оплата при получении (наложенный платёж).

## Tech Stack

### Mobile (apps/mobile)
- Language: TypeScript
- Runtime: Expo SDK 55 (managed workflow) + React Native
- Navigation: Expo Router ~55.0.5 (file-based)
- Styling: NativeWind v4 (Tailwind CSS v3 для RN)
- Server state: TanStack Query
- Client state: Zustand
- Forms: React Hook Form + Zod

### Admin (apps/admin)
- Language: TypeScript
- Runtime: Vite 6 + React 19
- Navigation: React Router v6
- Styling: Tailwind CSS v3
- Server state: TanStack Query
- Forms: React Hook Form + Zod

### Backend
- Supabase (auth, PostgreSQL, storage, real-time, edge functions)
- Monorepo: pnpm workspaces

## Commands

```bash
# Install
pnpm install

# --- Mobile ---
# Dev (web — основной режим разработки, SDK 55 несовместим с Expo Go)
pnpm --filter mobile web -- --clear

# Build (EAS)
cd apps/mobile && eas build --platform android --profile preview

# Test
pnpm --filter mobile test

# Lint
pnpm --filter mobile lint

# Type check
pnpm --filter mobile typecheck

# --- Admin ---
# Dev
pnpm --filter admin dev

# Build
pnpm --filter admin build

# Type check
pnpm --filter admin typecheck

# --- Supabase ---
pnpm supabase start       # запустить локально
pnpm supabase stop        # остановить
pnpm supabase db reset    # сбросить БД + миграции + seed
```

## Architecture

```
apps/
  mobile/        # Expo React Native app
  admin/         # Vite/React веб-панель администратора
packages/
  shared/        # Shared types, Zod schemas, utilities
supabase/
  migrations/    # SQL migrations
  seed.sql       # Dev seed
```

See [docs/architecture.md](docs/architecture.md) for details.

## Rules

@.llm/rules/behavior.md
@.llm/rules/code-style.md
@.llm/rules/testing.md
@.llm/rules/workflow.md
@.llm/rules/react-native.md
@.llm/rules/deploy-mobile.md

## Context

@.llm/context/business.md
@.llm/context/ux.md
