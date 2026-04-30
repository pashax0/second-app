# Session State

Здесь только то, чего нет в коде или git. «Что сделано» смотреть в `git log`.

## Open decisions

### p023 — не выбран

Три кандидата, решение не принято:

1. **Focus-group Android release** — playbook в [deploy.md](deploy.md). Первый APK тестировщикам.
2. **Push notifications** — помечено «не реализовано» в [architecture.md](architecture.md) и [deploy.md](deploy.md). Нужны FCM ключи.
3. **Admin panel expansion** — Orders / Users / Settings. Приоритеты — [apps/admin/architecture.md](../apps/admin/architecture.md#roadmap).

## Known Gotchas

- **EAS secrets аудит перед следующей сборкой.** `cd apps/mobile && eas secret:list`. Если висит старый `EXPO_PUBLIC_SUPABASE_ANON_KEY` — он перекроет `.env.production` (переменная переименована в `..._PUBLISHABLE_KEY`). Подробнее: блок «EAS secrets — TODO проверить» в [deploy.md](deploy.md).
- **Два формата Supabase-ключей сосуществуют.** Локальный CLI (v2.77+) выдаёт `sb_publishable_...`, прод всё ещё возвращает JWT `eyJhbGci...`. Оба валидны для `..._PUBLISHABLE_KEY`.
- **`pnpm supabase db reset` вайпает Storage.** После каждого reset надо прогонять `pnpm seed:storage`, иначе картинки товаров на витрине вернут 404 / `BLOCKED_BY_ORB` (объекты в bucket'е удалены, но `product_images.storage_path` ссылки в seed остаются).
- **Migration convention (на время разработки).** Базовые миграции (`20260308000000…000005_*`) можно править напрямую — нет смысла плодить «patch»-миграции, поскольку прод-данных нет. После правки: `pnpm supabase db reset` + `pnpm seed:storage`. Подробнее — раздел «Конвенция миграций» в [plans/products-admin.md](plans/products-admin.md).
- **`products.status` и `deleted_at` менять только через RPC.** Прямой `update products set status=...` отвергается column-privilege RLS (`insufficient_privilege`). Используем `publish_product`/`withdraw_product`/`activate_drop`/`archive_drop`/`complete_order`/`cancel_order`/`process_return`/`complete_return_inspection`/`write_off_product`/`delete_product`. Все SECURITY DEFINER + `is_admin()` guard. Полный список и семантика — [.llm/context/product-lifecycle.md](../.llm/context/product-lifecycle.md).
