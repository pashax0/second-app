# Daily Drop Shop

Мобильное приложение (iOS + Android) — интернет-магазин со штучными товарами.
Главная фишка: ежедневные дропы — товары выкладываются раз в день в настраиваемое время, ограниченным количеством. Непроданные товары доступны в архиве с фильтрами.

## Tech Stack

- Language: TypeScript
- Runtime: Expo (managed workflow) + React Native
- Navigation: Expo Router (file-based)
- Styling: NativeWind (Tailwind CSS for RN)
- Server state: TanStack Query
- Client state: Zustand
- Forms: React Hook Form + Zod
- Backend: Supabase (auth, PostgreSQL, storage, real-time, edge functions)
- Monorepo: pnpm workspaces

## Commands

```bash
# Install
pnpm install

# Dev (mobile)
pnpm --filter mobile start

# Build
pnpm --filter mobile build

# Test
pnpm --filter mobile test

# Lint
pnpm --filter mobile lint

# Type check
pnpm --filter mobile typecheck
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
