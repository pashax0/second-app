# Admin Panel

Веб-панель администратора Daily Drop Shop. Vite + React, отдельное приложение в монорепе.

## Local dev

```bash
pnpm --filter admin dev                          # http://localhost:5173 (локальный Supabase)
pnpm --filter admin dev -- --mode production     # против продакшн Supabase
pnpm --filter admin typecheck
pnpm --filter admin build
```

Работа с prod env — [docs/deploy.md](../../docs/deploy.md).

## Документация

- Концепция и границы — [architecture.md](./architecture.md)
- Решение о выделении в отдельный сервис — [ADR-003](../../docs/decisions/ADR-003-admin-service.md)
- Карта всего монорепо — [docs/architecture.md](../../docs/architecture.md)
