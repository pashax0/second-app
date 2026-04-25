# План: Товары (каталог) — базовый функционал админки

Статус: approved, имплементация по шагам.

## Gap-анализ

По [apps/admin/ARCHITECTURE.md](../../apps/admin/ARCHITECTURE.md) в секции «Товары» реализовано list / create / delete draft. Не хватает:
- edit существующего товара
- полноценный photo manager (add / remove / reorder)
- явные статусы в UI (включая «в корзине» — композитный)
- фильтры/поиск/пагинация (масштаб: ~6000 sold товаров/год)

## Архитектурные решения

### 1. Модель статусов — схему БД НЕ трогаем

- `products.status ∈ {draft, available, sold}` остаётся как есть.
- `reservations` — отдельная таблица, обоснование в [ADR-004](../decisions/ADR-004-reservation-expiry.md).
- **В UI показываем композитный статус** (вычисляется на клиенте):

| UI label | Условие | Когда |
|---|---|---|
| Draft | `status=draft`, нет строк в `drop_items` | новый товар |
| Returned | `status=draft`, есть `drop_items` с архивным дропом | не продался, лежит в фонде |
| Listed | `status=available`, нет активной `reservations` | на витрине |
| In cart | `status=available`, есть `reservations.expires_at > now()` | у кого-то в корзине |
| Sold | `status=sold` | продан |

### 2. Фильтрация — tabs + search

- Табы статусов: `All / Draft / Listed / In cart / Sold`
- Дефолт: `All` исключая `Sold`
- Search: `name / brand / item_number` (ilike)
- Пагинация: 50/страница, range-запрос в Supabase

### 3. Edit-правила

Один админ — доверяем. Field-level locks НЕ делаем. Все поля редактируются в любом статусе.

- **Sold:** мягкий баннер «Товар продан. Правки видны в истории заказов клиента; `order_items.price_at_purchase` зафиксирован и не меняется.» Без disable.
- **Listed / In cart:** редактируется всё. Если есть активная резервация — на Edit показываем badge «В корзине до HH:MM». Правки видны клиенту при refresh.
- **Withdraw from drop** (только `status=available`): кнопка «Убрать с витрины».
  - Action: `delete drop_items` (активный дроп) + `products.status → draft`.
  - Если активная резервация — блок с текстом «В корзине до HH:MM, попробуйте позже».
- **Delete:** только Draft (как сейчас). Sold — FK блокирует.

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
| 2 | Фильтры (tabs + search) на `Products.tsx` | Playwright: клик «Draft» — отфильтровано |
| 3 | Вынести форму в `components/ProductForm.tsx` | Playwright: создание товара не сломано |
| 4 | Страница `EditProduct` + маршрут `/products/:id/edit` + «Edit» ссылка | Playwright: открыть edit, сохранить, проверить обновление |
| 5 | Photo manager (reorder + remove + add) | Playwright: удалить/переупорядочить/добавить фото |
| 6 | Withdraw-кнопка + reservation badge + Sold warning banner | Playwright: withdraw на available → статус draft, drop_items почищены |
| 6.5 | «Добавить на витрину» (зеркало withdraw) на EditProduct | Playwright: draft + active drop → клик → статус available, drop_items row создан |
| 6.75 | Live-сигналы: миграция publications + `useRealtimeInvalidation` (admin + mobile) | Playwright: SQL update из другой сессии → UI обновился без reload |
| 7 | Композитный статус в UI (join с `drop_items` + `reservations`) | Playwright: проверить badges на seed-данных |
| 8 | Обновить [ARCHITECTURE.md](../../apps/admin/ARCHITECTURE.md) и [.llm/context/business.md](../../.llm/context/business.md) (убрать `reserved` как статус товара) | — |

После каждого шага: stop, report, ждём подтверждения перед следующим.

## Non-goals

- Схема БД / RLS — не трогаем
- Atomicity публикации дропа — отдельная задача (roadmap #2)
- Mobile-side — не в scope
- Юнит-тесты — только Playwright smoke после каждого шага

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
- [ ] Шаг 7: Composite status
- [ ] Шаг 8: Docs update
