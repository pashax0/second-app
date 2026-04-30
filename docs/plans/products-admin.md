# План: Товары (каталог) — базовый функционал админки

Статус: approved, имплементация по шагам.

## Gap-анализ (на момент старта плана)

По [apps/admin/architecture.md](../../apps/admin/architecture.md) реализовано list / create / delete in-stock. Не хватало:
- edit существующего товара
- полноценный photo manager (add / remove / reorder)
- явные статусы в UI (включая «в корзине» — composite)
- фильтры/поиск/пагинация (масштаб: ~6000 sold товаров/год)
- модель статусов (исходные `draft/available` неудачны, нет полей cost / list_price / condition / lot, нет таблиц returns / write_offs / supply_lots, нет drop-wide discount)

## Архитектурные решения

### 1. Модель статусов и консистентности

Полный спек — [product-lifecycle.md](../../.llm/context/product-lifecycle.md). Сюда не дублируем (single source).

Краткая суть на уровне плана:
- `products.status ∈ {in_stock, listed, sold, written_off}`. `listed` = строго в `drop_items` дропа `status='active'`.
- `drops.status ∈ {scheduled, active, archived}`.
- Composite (Scheduled / Returned / In cart / Pending return) — boolean-флаги во view `products_with_flags`, не в основной таблице.
- Изменения `products.status` — только через RPC; прямой UPDATE заблокирован RLS; триггеры на drop_items / drops / orders как guard rails.
- Новые таблицы — `supply_lots`, `returns`, `write_offs`. Новые поля — см. lifecycle.md.

### 2. Фильтрация — tabs + search

- Табы статусов (после миграции step 8): `All / In stock / Listed / Sold / Written off`. Сейчас в коде временные `All / Draft / Available / Sold` до rename.
- Дефолт: `All` исключая `Sold` и `Written off`
- Sub-фильтры через флаги view: `is_in_cart`, `is_scheduled`, `is_returned_to_stock`, `has_pending_return`
- Search: `name / brand / item_number` (ilike)
- Пагинация: 30/страница, range-запрос в Supabase

### 3. Edit-правила

Один админ — доверяем. Field-level locks НЕ делаем. Все поля редактируются в любом статусе.

- **Sold:** мягкий баннер «Товар продан. Правки видны в истории заказов клиента; `order_items.price_at_purchase` зафиксирован и не меняется.» Без disable.
- **Listed / In cart:** редактируется всё. Если есть активная резервация — на Edit показываем badge «В корзине до HH:MM». Правки видны клиенту при refresh.
- **Withdraw from drop** (`status=listed`): кнопка «Убрать с витрины».
  - Action: `delete drop_items` (активный дроп) + `products.status → in_stock` (после rename, см. lifecycle.md).
  - Если активная резервация — блок с текстом «В корзине до HH:MM, попробуйте позже».
- **Delete:** только in_stock без истории `drop_items` (hard); остальные in_stock — soft delete (`deleted_at`); Sold/written_off — нельзя.

### 4. Photo management

- Thumbnail grid с текущими фото
- Reorder: ↑↓ кнопки (основной механизм), drag — nice-to-have
- Remove: удалить из `product_images` + Storage
- Add: drop zone снизу grid'а
- Транзакционность: новые фото аплоадятся перед коммитом. При ошибке — откатываем уже загруженные.

## Конвенция миграций (на время разработки)

Пока приложение в разработке и нет данных для сохранения — миграции трактуем как «способ применить схему», а не immutable history. Базовые файлы (`20260308000000_initial_schema.sql`, `…002_rls_policies.sql`, `…003_seed_dev_data.sql`, `…004_create_order_fn.sql`) правим напрямую; временные «patch»-миграции не плодим. Применяем через `pnpm supabase db reset` + `pnpm seed:storage`. Это касается всех под-шагов 8.x и далее: новые DDL/RPC/RLS/view добавляем в соответствующие базовые файлы (или одной новой миграцией, если concern явно отдельный — например, RPC-функции lifecycle). Поддержка старых типов и фолбеки не нужны.

## План имплементации (атомарные шаги)

| # | Шаг | Verify |
|---|---|---|
| 1 | Playwright smoke: логин как admin, открыть Products | login работает, список грузится |
| 2 | Фильтры (tabs + search) на `Products.tsx` | Playwright: клик статусной вкладки — список отфильтрован |
| 3 | Вынести форму в `components/ProductForm.tsx` | Playwright: создание товара не сломано |
| 4 | Страница `EditProduct` + маршрут `/products/:id/edit` + «Edit» ссылка | Playwright: открыть edit, сохранить, проверить обновление |
| 5 | Photo manager (reorder + remove + add) | Playwright: удалить/переупорядочить/добавить фото |
| 6 | Withdraw-кнопка + reservation badge + Sold warning banner | Playwright: withdraw на listed → статус in_stock (после step 8), drop_items почищены |
| 6.5 | «Добавить на витрину» (зеркало withdraw) на EditProduct | Playwright: in_stock + active drop → клик → статус listed, drop_items row создан |
| 6.75 | Live-сигналы: миграция publications + `useRealtimeInvalidation` (admin + mobile) | Playwright: SQL update из другой сессии → UI обновился без reload |
| 7 | Lifecycle spec — единый док [product-lifecycle.md](../../.llm/context/product-lifecycle.md) (статусы, переходы, связанные таблицы, what-not-to-model) | Документ согласован; business.md и CLAUDE.md обновлены |
| 8 | Имплементация lifecycle. Спека — [product-lifecycle.md](../../.llm/context/product-lifecycle.md). Под-шаги ниже. | — |
| 8.1 | Миграция: новые поля `products.{cost, list_price, condition, defect_notes, lot_id, deleted_at}`, `drops.discount_percent`, `orders.{cancellation_reason, cancellation_notes}` и новые таблицы `supply_lots`, `returns`, `write_offs` (additive) | Миграция применяется на чистой БД и на текущей; существующий код не сломан |
| 8.2 | Миграция: backfill `list_price = price` для существующих товаров | Нет товаров с `list_price IS NULL` |
| 8.3 | Миграция: RPC-функции (`publish_product`, `withdraw_product`, `activate_drop`, `archive_drop`, `complete_order`, `cancel_order`, `process_return`, `complete_return_inspection`, `write_off_product`, `delete_product`) | Каждая RPC отрабатывает «happy path» и блокирует невалидные кейсы |
| 8.4 | Миграция: триггеры на `drop_items`, `drops`, `orders` (guard rails) | Прямой `INSERT drop_items` или `UPDATE drops.status` корректно автосинкает `products.status` |
| 8.5 | Миграция: RLS column-deny на `products.status` для `authenticated` | Прямой `UPDATE products SET status=...` отвергнут; через RPC проходит |
| 8.6 | Миграция: view `products_with_flags` (is_scheduled, is_returned_to_stock, is_in_cart, has_pending_return) | SELECT возвращает корректные флаги на seed |
| 8.7 | Миграция: rename статусов (`products`: `draft→in_stock`, `available→listed`, добавлен `written_off`; `drops`: `draft→scheduled`) | Существующие записи переехали; check-constraints обновлены |
| 8.8 | Admin: мутации статуса переведены на RPC, запросы списка — на view, UI-имена статусов и табов переименованы | Playwright: withdraw/publish работают; вкладки показывают новые имена; прямого UPDATE статуса в коде нет |
| 8.9 | Admin: новые поля (cost, list_price, condition, defect_notes, lot) в `ProductForm` | Playwright: create/edit сохраняет новые поля |
| 8.10 | Admin: composite в UI (бейджи/sub-фильтры Scheduled, Returned, In cart, Pending return) | Playwright: товар с резервацией показывает бейдж «In cart» и попадает в фильтр |
| 8.11 | Mobile: типы и запросы переведены на новые имена (и view там, где нужны composite) | `pnpm --filter mobile typecheck` чисто; web-витрина грузится без регрессий |
| 8.12 | Docs sync: [apps/admin/architecture.md](../../apps/admin/architecture.md), README, комментарии в коде | Grep `draft/available` в коде возвращает только intentional historical mentions |

После каждого шага: stop, report, ждём подтверждения перед следующим.

## Non-goals

- Atomicity публикации дропа — отдельная задача (roadmap #2)
- Bulk intake / pre-shoot intake / IG-hold / audit log — не в MVP, см. секцию «Что НЕ моделируем» в [product-lifecycle.md](../../.llm/context/product-lifecycle.md)
- Юнит-тесты — только Playwright smoke после каждого шага

(Изначально «схема БД / RLS — не трогаем» и «mobile — не в scope» были non-goals. По итогам шагов 6.75 и 7 эти ограничения сняты.)

## Риски

- Регрессия Create-формы после выноса в shared компонент (шаг 3) — обязательный smoke
- Drag-reorder через Playwright MCP может не работать — остаётся ↑↓ как основной механизм
- `supabase local` MCP в `.mcp.json` помечен failed — если нужен прямой SQL, идём через Studio или psql

## Прогресс

- [x] Шаг 1: Playwright smoke login
- [x] Шаг 2: Filters + search
- [x] Шаг 3: Extract ProductForm
- [x] Шаг 4: EditProduct page
- [x] Шаг 5: Photo manager
- [x] Шаг 6: Withdraw + reservation badge + Sold banner
- [x] Шаг 6.5: Publish to active drop
- [x] Шаг 6.75: Live-сигналы (admin + mobile)
- [x] Шаг 7: Lifecycle spec — [.llm/context/product-lifecycle.md](../../.llm/context/product-lifecycle.md)
- [x] Шаг 8.1 + 8.2 + 8.7: новые поля/таблицы, list_price, rename статусов — сложены в базовые миграции (`…000_initial_schema`, `…002_rls_policies`, `…003_seed_dev_data`, `…004_create_order_fn`). Код admin/mobile переведён на новые литералы (`in_stock`/`listed`/`written_off`, `scheduled`). UI-имена статусов и табов в Products переименованы заодно.
- [x] Шаг 8.3: RPC функции lifecycle (`20260308000005_lifecycle_rpcs.sql`) — 10 функций SECURITY DEFINER, все happy paths и негативные кейсы проверены.
- [x] Шаг 8.4: Триггеры (guard rails) — `_recompute_product_status` + триггеры на `drop_items`/`drops`/`orders`. Прямые манипуляции таблицами автосинкают `products.status`.
- [x] Шаг 8.6: View `products_with_flags` (security_invoker=on) — 4 boolean-флага (`is_scheduled`, `is_returned_to_stock`, `is_in_cart`, `has_pending_return`); soft-deleted скрыты.
- [x] Шаг 8.8: Admin — мутации статуса через RPC, list/single read через view, `delete_product` RPC.
- [x] Шаг 8.5: RLS column-deny — `revoke update on products from authenticated; grant update (... allowed cols ...)`. `status` и `deleted_at` менять только через RPC.
- [x] Шаг 8.9: Admin — новые поля (`cost`, `list_price`, `condition`, `defect_notes`, `lot_id`) в ProductForm. Defect notes textarea показывается при `condition='has_defect'`. Lot — selector из `supply_lots`.
- [x] Шаг 8.10: Admin — composite в UI: бейджи `In cart`/`Scheduled`/`Returned`/`Pending return` в Status-колонке + sub-filter chips per-tab.
- [x] Шаг 8.11: Mobile — типы и литералы переведены ещё в 8.7; composite-флаги моб не использует (cart-state — прямой read из `reservations` с realtime).
- [x] Шаг 8.12: Docs sync — `apps/admin/architecture.md`, `apps/admin/src/pages/CreateDrop.tsx` (UI text), `CreateProduct.tsx` (submitLabel). Grep `draft|available` остаётся только в исторических context-файлах (`product-lifecycle.md`, плане) и в seed-комментарии (English слово, не статус).
