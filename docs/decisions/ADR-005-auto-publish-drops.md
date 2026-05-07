# ADR-005: Автопубликация дропов по `scheduled_at`

**Date:** 2026-05-07
**Status:** accepted

## Context

Дроп имеет поле `scheduled_at` (см. [product-lifecycle.md](../../.llm/context/product-lifecycle.md)).
До этого момента публикация шла только вручную: админ открывает список дропов и жмёт «Publish»,
которая зовёт RPC `activate_drop`. Если админ не зашёл — `scheduled_at` ничего не значит.

Требования к автопубликации:
- В `scheduled_at` (с лагом до нескольких минут) дроп становится `active` без участия админа.
- Поведение полностью совпадает с ручной публикацией — никаких отдельных веток, никаких
  «упрощений для крона».
- Эдж-кейсы (пустой дроп, два дропа на одно время) не разруливаются в момент публикации, а
  предотвращаются на источнике — потому что валидный дроп таким не должен быть.
- Решение работает и локально, и на проде. Одна кодовая база.

Контекст Supabase:
- pg_cron — встроенный планировщик, минимальный интервал 1 секунда; в проекте уже используется
  для `expire-reservations` (см. [ADR-004](ADR-004-reservation-expiry.md)).
- Edge Functions stateless, max ~150 сек.
- Внешние шедулеры (Inngest / Cloudflare cron / GH Actions) — отдельная инфраструктура.

## Decision

**pg_cron + общая SECURITY DEFINER функция** — крон зовёт ту же логику, что админская кнопка.

Структура (см. [supabase/migrations/20260308000005_lifecycle_rpcs.sql](../../supabase/migrations/20260308000005_lifecycle_rpcs.sql)):

- `_activate_drop_body(p_drop_id uuid)` — единый источник правды для активации дропа.
  Без `is_admin()` гейта. Внутри: precondition `drop_empty`, archive предыдущего active,
  активация целевого, флипы `products.status`. Тело идентично прежнему `activate_drop`.
- `activate_drop(p_drop_id uuid)` — тонкая админ-обёртка: `is_admin()` гард + `_activate_drop_body`.
  Вызывается из админки.
- `auto_activate_due_drops()` — крон-обёртка: цикл по `drops where status='scheduled' and
  scheduled_at <= now()` ASC + `_activate_drop_body` на каждый. Ошибки на одном дропе не блокируют
  остальные (`raise warning`, переходим к следующему).

Расписание — `*/5 * * * *` (см. [supabase/migrations/20260308000000_initial_schema.sql](../../supabase/migrations/20260308000000_initial_schema.sql)):

```sql
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'auto-activate-drops',
  '*/5 * * * *',
  'select public.auto_activate_due_drops()'
);
```

Гарантии на источнике (предотвращают эдж-кейсы):
- `drop_items` precondition внутри `_activate_drop_body` — пустой дроп публиковаться не может
  (это ловит и ручной путь, и крон). UI блокирует пустой сабмит на форме создания и
  снятие последнего товара со scheduled-дропа.
- Partial unique index `drops(scheduled_at) where status='scheduled'` — два scheduled-дропа на одну
  секунду физически невозможны. UI ловит `23505` дружелюбным сообщением.

## Considered alternatives

| Option | Pros | Cons |
|---|---|---|
| **pg_cron + общая RPC (chosen)** | Нет новой инфры. Логика одна на ручной и авто пути. Атомарно в транзакции. Уже паттерн проекта (`expire-reservations`). | Лаг до 5 минут. На локалке нужен `create extension pg_cron`. |
| Edge Function on schedule | Та же атомарность через RPC | Лишний HTTP-слой, auth, cold start, новый deploy-артефакт. Нулевая выгода. |
| Внешний шедулер (Inngest / GH cron / Cloudflare) | Точность до секунды | Новая инфра, secrets, отдельный rollback. То же самое отклонено в [ADR-004](ADR-004-reservation-expiry.md). |
| Отдельная функция `auto_activate_due_drops` со своей логикой активации | Гибче | Дублирует тело `activate_drop`. Любая правка ручного пути требует дублирования в крон-пути. Рассинхрон гарантирован со временем. |

## Consequences

**Лучше:**
- `scheduled_at` стал боевым полем — админу не нужно сидеть в админке к назначенному времени.
- Один путь активации: ручная кнопка и крон зовут `_activate_drop_body`. Изменения в логике
  публикации автоматически попадают в обе ветки.
- Эдж-кейсы (пустой / коллизия времени) нельзя сохранить в БД → крон не может «упасть на них»,
  потому что они туда не попадают.

**Принятые трейд-офы:**
- Лаг публикации до 5 минут. Для бизнес-кейса (ежедневный дроп) приемлемо. Если станет важно —
  меняем расписание на минутный/секундный без изменений в логике.
- Если предыдущая активация ручной кнопкой выпала на ту же минуту, что и крон, второй проиграет
  с `drop_not_scheduled`. `raise warning` логируется в `cron.job_run_details`, на пользователя
  не выходит — это ожидаемая идемпотентность.
- pg_cron теперь жёсткое требование, в т.ч. локально. `create extension if not exists pg_cron`
  лежит в базовой миграции, `do/exception`-фолбэки `expire-reservations` сняты — крон должен
  работать или мы падаем громко.

**Если в будущем потребуется секундная точность:**
- Поменять расписание (`30 seconds`).
- Вынести в Edge Function только если появится логика, которой не место в БД (push-уведомления,
  внешние webhook'и). Тогда Edge Function зовёт `_activate_drop_body` по REST — тело по-прежнему
  одно.

## Notes

- Видимость ошибок: `cron.job_run_details` + просроченный scheduled-дроп виден в списке
  админки (`scheduled_at < now()` + `status='scheduled'`). Отдельной audit-таблицы нет — для
  MVP двух источников достаточно.
- Гонка с ручной кнопкой решается транзакционной природой `_activate_drop_body`: один UPDATE
  выигрывает, второй ловит `drop_not_scheduled`.
- Реализовано в шаге 16 плана [drops-admin](../plans/drops-admin.md).
