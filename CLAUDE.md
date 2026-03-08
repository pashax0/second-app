# Daily Drop Shop

Мобильное приложение (iOS + Android) — секонд-хенд магазин одежды с ежедневными дропами.
Каждая вещь уникальна. Оплата при получении (наложенный платёж).

## Tech Stack

- Language: TypeScript
- Runtime: Expo SDK 55 (managed workflow) + React Native
- Navigation: Expo Router ~55.0.4 (file-based)
- Styling: NativeWind v4 (Tailwind CSS v3 для RN)
- Server state: TanStack Query
- Client state: Zustand
- Forms: React Hook Form + Zod
- Backend: Supabase (auth, PostgreSQL, storage, real-time, edge functions)
- Monorepo: pnpm workspaces

## Commands

```bash
# Install
pnpm install

# Dev (web — основной режим разработки, SDK 55 несовместим с Expo Go)
pnpm --filter mobile web -- --clear

# Build
pnpm --filter mobile build

# Test
pnpm --filter mobile test

# Lint
pnpm --filter mobile lint

# Type check
pnpm --filter mobile typecheck

# Supabase
pnpm supabase start       # запустить локально
pnpm supabase stop        # остановить
pnpm supabase db reset    # сбросить БД + миграции + seed
```

## Architecture

```
apps/
  mobile/        # Expo React Native app
packages/
  shared/        # Shared types, Zod schemas, utilities
supabase/
  migrations/    # SQL migrations
  functions/     # Edge Functions (scheduled drops, push notifications)
```

See [docs/architecture.md](docs/architecture.md) for details.

## Rules

@.llm/rules/behavior.md
@.llm/rules/code-style.md
@.llm/rules/git-workflow.md
@.llm/rules/testing.md
@.llm/rules/workflow.md
@.llm/rules/react-native.md
