# Product Lifecycle

Single source of truth: статусы товара, переходы, связанные сущности, как поддерживается консистентность, что сознательно НЕ моделируется.

Применяется и к админке, и к мобилке. Связь:
- бизнес-обзор — [business.md](business.md)
- UX покупателя — [ux.md](ux.md)
- решения — `docs/decisions/ADR-*.md`

## Статусы товара (`products.status`)

Четыре физических состояния. Никакого `draft` — заменено на однозначное `in_stock`. Имена выбраны под общепринятую e-commerce / retail-терминологию.

| Status | Означает (физически) | Из чего → во что |
|---|---|---|
| `in_stock` | Принят в фонд. У нас на руках, на витрине нет. Привязан не более чем к одному scheduled-дропу (план; повторно планировать в другой scheduled нельзя). | start → `listed`, → `written_off` |
| `listed` | **В `drop_items` дропа со `status='active'`** = на витрине прямо сейчас, доступен для покупки. | → `sold`, → `in_stock` (withdraw / архивация дропа без продажи), → `written_off` |
| `sold` | Продан, заказ создан. | → `in_stock` (отмена заказа до отгрузки или возврат + успешная инспекция), → `written_off` (возврат + дефект) |
| `written_off` | Списан без продажи. Конечное. | — |

Ключевое: `listed` — **только текущий active drop**. Запланированный товар в будущем дропе НЕ `listed`, он `in_stock` + composite **Scheduled** в UI.

## Производные состояния (computed, не в `products.status`)

Хранятся как boolean-флаги в **view** (см. ниже), чтобы фильтровать одним SELECT без join'ов в коде.

| Composite | Условие |
|---|---|
| **Scheduled** | `status=in_stock` + есть `drop_items` к дропу `status=scheduled` |
| **Returned** | `status=in_stock` + есть `drop_items` к дропу `status=archived` (был на витрине, не продан) |
| **In cart** | `status=listed` + активная `reservations.expires_at > now()` |
| **Pending return** | `status=sold` + есть `returns.inspection_status='pending'` |
| **Sold here / elsewhere** | DropDetail-only: `status=sold` + сравнение `orders.drop_id` с просматриваемым |

## Статусы дропа (`drops.status`) — связанные

Тоже без `draft`. Финальный набор:

| Status | Означает |
|---|---|
| `scheduled` | Дроп собран, дата публикации задана, на витрине ещё нет |
| `active` | Текущий, на витрине, ровно один в системе |
| `archived` | Завершён, нераспроданные товары возвращены в `in_stock` |

Переходы дропа автоматически синхронизируют `products.status` всех связанных товаров (см. секцию «Консистентность»).

## Консистентность — как обеспечивается

Дизайн-задача:
- **Запретить рассогласование** (например, `products.status='listed'` без строки в `drop_items` активного дропа).
- **Не платить** join'ами на каждый запрос за «текущий статус».

Решение — **гибрид: денормализованный кэш + защита БД + RPC API + view**.

### 1. `products.status` как кэш

Хранится физически. Главные фильтры (вкладки в админке, FlashList на мобилке) делают `WHERE status=...` по обычному btree-индексу. Никаких join'ов.

### 2. Прямой `UPDATE products SET status=...` запрещён

Через **RLS / column privileges**: у роли `authenticated` нет прав на `UPDATE` колонки `products.status`. Менять status можно только через RPC с `SECURITY DEFINER` (которые выполняются от имени привилегированной роли).

### 3. RPC — единственный API для смены статуса

| Функция | Что делает (атомарно в одной транзакции) |
|---|---|
| `publish_product(p_id, drop_id)` | INSERT в `drop_items` (если drop активен → status=`listed`; если scheduled → status остаётся `in_stock`) |
| `withdraw_product(p_id)` | DELETE из `drop_items` активного дропа + `status='in_stock'` |
| `activate_drop(drop_id)` | UPDATE drop status `scheduled→active` + UPDATE всех связанных products `in_stock→listed`. Также archive предыдущего active дропа: UPDATE drop status `active→archived` + UPDATE его непроданных products `listed→in_stock`. |
| `archive_drop(drop_id)` | UPDATE drop status → `archived` + revert непроданных products в `in_stock` |
| `complete_order(order_id)` | UPDATE products в order_items на `sold`. `drop_items` активного дропа НЕ удаляются — sold-товары остаются в сетке витрины (FOMO, см. [business.md](business.md), [ux.md](ux.md)). |
| `cancel_order(order_id, reason, notes)` | UPDATE order на `cancelled` + revert products: если active drop ещё идёт → `listed`; если archived → `in_stock` |
| `process_return(order_item_id, reason, refund_amount, notes)` | INSERT в `returns` со `inspection_status='pending'`. `products.status` остаётся `sold` до инспекции. |
| `complete_return_inspection(return_id, outcome)` | outcome=`relisted` → `products.status='in_stock'`; outcome=`written_off` → `products.status='written_off'` + INSERT в `write_offs`. |
| `write_off_product(p_id, reason, notes)` | INSERT в `write_offs` + `status='written_off'`. Если был `listed` — DELETE из `drop_items` активного дропа. |

### 4. Триггеры — guard rails

На случай прямой манипуляции таблицами (миграции, ad-hoc SQL):

- `drop_items` AFTER INSERT/DELETE → пересчёт `products.status` затронутого товара
- `drop_items` BEFORE INSERT → отказ, если товар уже в `drop_items` другого дропа со `status` ∈ (`scheduled`, `active`). Один товар = один план.
- `drops` AFTER UPDATE OF status → массовый sync для всех `drop_items` дропа
- `orders` AFTER UPDATE OF status → revert если cancel

Триггеры идемпотентны и совпадают с логикой RPC. Они страховка, не первичный механизм.

### 5. View `products_with_flags` — для composite-фильтров

```sql
create view public.products_with_flags as
select p.*,
  exists(select 1 from drop_items di join drops d on d.id=di.drop_id
         where di.product_id=p.id and d.status='scheduled') as is_scheduled,
  exists(select 1 from drop_items di join drops d on d.id=di.drop_id
         where di.product_id=p.id and d.status='archived')  as is_returned_to_stock,
  exists(select 1 from reservations r
         where r.product_id=p.id and r.expires_at > now())  as is_in_cart,
  exists(select 1 from returns rt
         where rt.product_id=p.id and rt.inspection_status='pending')
                                                              as has_pending_return
from public.products p
where p.deleted_at is null;
```

Запросы к view — обычные WHERE, никаких join'ов в коде:
```sql
-- "В корзине": status='listed' AND активная резервация
select * from products_with_flags where status='listed' and is_in_cart;

-- "Запланирован но не на витрине"
select * from products_with_flags where status='in_stock' and is_scheduled;
```

Postgres оптимизирует EXISTS через индексы по `drop_items(product_id)`, `reservations(product_id)`, `returns(product_id)` — стоимость линейна, не квадратична.

## Цены

Два слоя, не путать:

**Slow / silent layer — что покупатель платит.** Меняется тихо, никак не подсвечивается в UI.

| Поле | Где | Семантика | Изменяемое |
|---|---|---|---|
| `cost` | `products` | Себестоимость (что заплатили) | да, админ |
| `list_price` | `products` | Первоначальная цена при первом листинге. Не для отображения — анкер для аналитики. | задаётся раз |
| `price` | `products` | Текущая цена в фонде | да, админ может снижать в любой момент |
| `override_price` | `drop_items` | Цена для этой позиции в этом дропе. Если задана — заменяет `products.price` для этого дропа. | да |
| `price_at_purchase` | `order_items` | Снапшот в момент продажи | immutable |

**Promo layer — единственный сигнал «это акция».**

| Поле | Где | Семантика |
|---|---|---|
| `compare_at_price` | `drop_items` | «Старая» цена для зачёркивания. Промо включается ⇔ поле задано и > эффективной цены. Иначе — silent. |

### Effective price — что списываем
```
effective_price = drop_items.override_price ?? products.price
```
То же самое использует `create_order` для `price_at_purchase`. Это единственный источник «реальной» цены.

### Promo display — что видит покупатель
```
isPromo  = compare_at_price IS NOT NULL AND compare_at_price > effective_price
discount = round((1 - effective_price / compare_at_price) * 100)   # только если isPromo
```
- `isPromo = false` → показываем только `effective_price`. Никаких бейджей/зачёркиваний.
- `isPromo = true` → показываем `effective_price` + зачёркнутый `compare_at_price` + бейдж `−{discount}%`.

### Кейсы — как разные сценарии ложатся в модель

| Сценарий | `override_price` | `compare_at_price` | Что видит покупатель |
|---|---|---|---|
| Цена «как обычно» | `null` | `null` | `products.price`, без бейджей |
| Тихая корректировка цены в фонде | `null` (правится `products.price`) | `null` | новая `products.price`, без бейджей |
| Тихая корректировка для этого дропа | задан | `null` | `override_price`, без бейджей |
| Промо одной позиции | по желанию | задан > effective | effective + зачёркнутая старая + `−X%` |
| Drop-wide промо | по желанию | задан на всех позициях дропа | у каждой позиции свой бейдж |

Drop-wide промо — это **bulk-операция** в админке, материализующаяся как N row-updates `compare_at_price`. Отдельного флага на уровне дропа нет — модель сознательно избегает precedence-правил.

### Почему именно так — принципы

1. **Эффективная цена и сигнал «акция» — разные слои.** Изменение цены не означает «акция»; флаг «акция» не считает цену сам.
2. **`compare_at_price` — единственный источник правды для зачёркивания.** Не вычисляется из `list_price`, не выводится из истории. Только то, что админ задал явно.
3. **Промо — explicit opt-in.** Защита от «приучить покупателя ждать скидки» (см. [business.md](business.md)). По умолчанию любое снижение цены — silent.

## Условие / grade

`products.condition`: `new_with_tags | excellent | good | has_defect`. Опц. `products.defect_notes` (свободный текст).

Влияет на ценообразование, на доверие в карточке. В админ-листе — иконка/цвет.

## Связанные таблицы

### `supply_lots` (новая)

Партия закупки: «50 вещей за £400 у поставщика X из UK».

```
id, source_country, supplier, total_cost, item_count, received_at, notes
```

`products.lot_id → supply_lots.id`. Cost per item:
- по умолчанию `total_cost / item_count`
- override через `products.cost`

### `returns` (новая)

```
id, order_item_id, product_id, reason (size/quality/color/changed_mind/other),
inspection_status (pending/relisted/written_off), refund_amount,
returned_at, inspected_at, notes
```

См. RPC `process_return` и `complete_return_inspection`.

### `write_offs` (новая)

```
id, product_id, reason (damaged/lost/personal/other), notes, written_off_at
```

Отдельно от `products.status='written_off'`, чтобы хранить причину и audit.

### `orders.cancellation_reason` + `cancellation_notes` (новые поля)

`reason ∈ customer_request | no_show | damaged_in_transit | admin_withdraw | out_of_stock | other`. `notes` — свободный текст.

## Soft delete

`products.deleted_at timestamptz`. Скрыт из view `products_with_flags` (фильтр `where deleted_at is null` в основной view).

- **Hard delete** разрешён только для `in_stock` товара, никогда не появлявшегося в `drop_items`. Проверяется на уровне RPC `delete_product(p_id)`.
- **Soft delete** (`deleted_at = now()`) для остальных `in_stock` — товар скрыт, история в `drop_items` (archived) и order_items (если был sold) сохраняется.
- **`sold` / `written_off`** — `deleted_at` не ставится никогда (audit + FK).

## Что НЕ моделируем (и почему)

| Кейс | Почему |
|---|---|
| **Обмен (exchange)** | Каждая вещь уникальна. Замена = возврат + новая покупка. |
| **Multi-quantity SKU** | Секонд-хенд, единичные вещи. `stock_quantity` всегда 1. |
| **Wait-list / pre-order** | Уникальные вещи, predict нельзя. Не в MVP. |
| **Pre-shoot intake** | Текущая валидация требует ≥1 фото; снимать — отдельная задача с риском «забытых» товаров без фото. Не в MVP. |
| **Bulk intake UI** | Single-add окей для текущего объёма. Не в MVP. |
| **Audit log** (история всех изменений) | Тяжело для MVP. Минимум — `created_at`/`updated_at`; опц. `price_history` позже. |
| **IG-hold (ручная резервация для клиента из Инстаграма)** | Резервации только через приложение. В IG — админ ставит `sold` сразу либо ждёт прихода клиента в app. |
