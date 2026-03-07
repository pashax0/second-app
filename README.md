# Daily Drop Shop

Мобильное приложение (iOS + Android) — интернет-магазин со штучными товарами.

Главная фишка: **ежедневные дропы** — товары выкладываются раз в день в настраиваемое время, ограниченным количеством. Пользователи получают push-уведомления о новых дропах. Непроданные товары доступны в архиве с фильтрами.

## Getting started

```bash
# Install
pnpm install

# Dev (mobile)
pnpm --filter mobile start
```

## Development

```bash
# Tests:     pnpm --filter mobile test
# Lint:      pnpm --filter mobile lint
# Typecheck: pnpm --filter mobile typecheck
# Build:     pnpm --filter mobile build
```

## Architecture

See [docs/architecture.md](docs/architecture.md) and [docs/decisions/](docs/decisions/).
