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
| 8 | Имплементация lifecycle (см. [product-lifecycle.md](../../.llm/context/product-lifecycle.md), секция «MVP scope»). Под-шаги: 8.1 миграция БД (rename статусов, новые поля, новые таблицы); 8.2 RPC + триггеры + view + RLS column-deny; 8.3 backfill; 8.4 admin-код переход на RPC + view + новые имена UI; 8.5 mobile types/queries; 8.6 sync [apps/admin/architecture.md](../../apps/admin/architecture.md) | Playwright: try прямой UPDATE products.status — отказ; через RPC — переход; mobile витрина читается из view; вкладки админки используют новые имена |

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
- [ ] Шаг 8: Имплементация lifecycle (миграция + код + composite UI)
