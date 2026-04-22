# Session State

Здесь только то, чего нет в коде или git. «Что сделано» смотреть в `git log`.

## Open decisions

### p023 — не выбран

Три кандидата, решение не принято:

1. **Focus-group Android release** — playbook в [deploy.md](deploy.md). Первый APK тестировщикам.
2. **Push notifications** — помечено «не реализовано» в [architecture.md](architecture.md) и [deploy.md](deploy.md). Нужны FCM ключи.
3. **Admin: Orders page** — при COD нет интерфейса для обработки заказов в админке.

## Known Gotchas

- **EAS secrets аудит перед следующей сборкой.** `cd apps/mobile && eas secret:list`. Если висит старый `EXPO_PUBLIC_SUPABASE_ANON_KEY` — он перекроет `.env.production` (переменная переименована в `..._PUBLISHABLE_KEY`). Подробнее: блок «EAS secrets — TODO проверить» в [deploy.md](deploy.md).
- **Два формата Supabase-ключей сосуществуют.** Локальный CLI (v2.77+) выдаёт `sb_publishable_...`, прод всё ещё возвращает JWT `eyJhbGci...`. Оба валидны для `..._PUBLISHABLE_KEY`.
