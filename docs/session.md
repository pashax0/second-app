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
- **Stale Supabase session (JWT после `db reset` / удаления юзера на сервере).** Локальный JWT остаётся в `AsyncStorage`/`SecureStore`, но `sub` указывает на удалённого юзера → `auth.uid()` возвращает null или сам UUID несуществующего юзера. RPC валятся с `23502 user_id NOT NULL`, `23503 user_id_fkey`, либо PostgREST `PGRST301`. **Решение в коде**: (1) `stores/auth.ts initialize()` валидирует сессию через `supabase.auth.getUser()` на старте — при ошибке делает `signOut()`; (2) глобальный `MutationCache.onError` / `QueryCache.onError` в `app/_layout.tsx` через `isStaleSessionError(err)` ловит эти три кода в рантайме и тоже делает `signOut()` + toast «Сессия завершилась». Дальше анон-сессия поднимется сама на следующий action.
- **`products.status` и `deleted_at` менять только через RPC.** Прямой `update products set status=...` отвергается column-privilege RLS (`insufficient_privilege`). Используем `publish_product`/`withdraw_product`/`activate_drop`/`archive_drop`/`complete_order`/`cancel_order`/`process_return`/`complete_return_inspection`/`write_off_product`/`delete_product`. Все SECURITY DEFINER + `is_admin()` guard. Полный список и семантика — [.llm/context/product-lifecycle.md](../.llm/context/product-lifecycle.md).
