# ADR-004: Механизм истечения резерваций

**Date:** 2026-03-10
**Status:** accepted

## Context

Когда пользователь добавляет товар в корзину, создаётся запись в `reservations` с полем `expires_at`.
Товар блокируется для других пользователей на время таймера (5–10 минут).

**Требования:**
- Когда таймер истекает — все пользователи должны увидеть товар как доступный без задержки >1 сек
- Если пользователь продлит таймер (кнопка "ещё минуту") — все должны увидеть обновлённый отсчёт без дополнительных запросов
- Решение должно масштабироваться (100+ пользователей, 15–20 товаров в дропе)

**Контекст Supabase:**
- Realtime: WebSocket-соединение, рассылает события на INSERT / UPDATE / DELETE в таблице
- Realtime срабатывает только на DML-события (не на течение времени)
- Edge Functions: stateless, max ~150 сек выполнения — не могут держать долгоживущие таймеры
- pg_cron: встроенный планировщик SQL-джобов, минимальный интервал ~1 мин

---

## Проблема: Realtime не знает о течении времени

Запись в `reservations` не удаляется сама по себе. Пока запись в БД существует — Realtime
молчит. Другие пользователи видят "Зарезервировано 0:00" (таймер дошёл до нуля на экране,
но UI не обновился) до тех пор, пока что-то не удалит запись и не породит DELETE-событие.

---

## Кейсы и поведение по каждому решению

### Кейс A: owner онлайн, таймер истекает

| Решение | Что видят другие пользователи |
|---|---|
| pg_cron only | "Зарезервировано" (застывший) до ~1 мин |
| Client setQueryData | Мгновенно убирается локально (~0ms) |
| Client RPC + jitter | Убирается через ~200ms (Realtime DELETE) |
| Inngest | Убирается через ~500ms–1s (Edge Function cold start + Realtime) |
| Timer Service | Убирается через ~200–300ms (Realtime DELETE) |

### Кейс B: owner офлайн до истечения таймера

| Решение | Что видят другие пользователи |
|---|---|
| pg_cron only | "Зарезервировано" (застывший) до ~1 мин |
| Client setQueryData | Мгновенно (~0ms) — каждый клиент убирает локально |
| Client RPC + jitter | Первый видящий клиент вызывает RPC → ~200ms |
| Inngest | Точно в момент expires_at → ~500ms–1s |
| Timer Service | Точно в момент expires_at → ~200ms |

### Кейс C: owner продлевает таймер (UPDATE expires_at)

```
UPDATE reservations SET expires_at = expires_at + interval '1 min'
→ Realtime UPDATE → все клиенты получают новый expires_at → countdown сбрасывается
```

| Решение | Race condition? | Что нужно при продлении |
|---|---|---|
| pg_cron only | ✅ нет | только UPDATE в БД |
| Client setQueryData | ⚠️ да | только UPDATE в БД, но race condition |
| Client RPC + jitter | ✅ нет | только UPDATE в БД |
| Inngest | ✅ нет | cancel старого job + schedule нового (нужен `job_id` в БД) |
| Timer Service | ✅ нет | Realtime UPDATE → сервис делает clearTimeout + reschedule |

**Race condition при setQueryData:**
```
T=4:59  Owner продлевает → UPDATE → Realtime UPDATE в пути (~150ms)
T=5:00  User2 countdown=0 → setQueryData удаляет резервацию локально
T=5:00  User2 видит "В корзину" ← НЕВЕРНО
T=5:00  Realtime UPDATE приходит → countdown сбрасывается до 1:00 ← мигание
```
Это делает `Client setQueryData` непригодным при наличии продления таймера.

### Кейс D: 100 пользователей смотрят 1 товар, таймер истекает

| Решение | Запросов на сервер |
|---|---|
| pg_cron only | 0 от клиентов |
| Client setQueryData | 0 (только локальный кэш) |
| Client RPC + jitter | 1–2 (jitter + Realtime отсеивает остальных) |
| Inngest | 0 от клиентов (Inngest сам вызывает Edge Function) |
| Timer Service | 0 от клиентов |

**Механизм jitter:**
```
countdown = 0
→ sleep(random(0, 300ms))
→ проверить: reservation ещё в кэше?
    → нет (Realtime DELETE уже пришёл) → пропустить
    → да → вызвать expire_reservation RPC
```
При Realtime latency ~50–100ms и jitter 0–300ms: первый клиент (минимальный jitter)
вызывает RPC, остальные получают Realtime DELETE до истечения своего jitter → пропускают.

### Кейс E: никто не смотрит товар в момент истечения

| Решение | Что происходит |
|---|---|
| pg_cron | Чистит при следующем запуске (~1 мин) ← единственный механизм |
| Client setQueryData | Запись остаётся в БД. При следующем открытии: фильтрация по `expires_at > now()` |
| Client RPC + jitter | Никто не вызывает RPC → запись в БД. pg_cron как fallback |
| Inngest | Чистит точно в момент expires_at — не зависит от клиентов |
| Timer Service | Чистит точно в момент expires_at — не зависит от клиентов |

---

## Сравнение решений

| | pg_cron only | Client setQueryData | Client RPC + jitter | Inngest | Timer Service |
|---|---|---|---|---|---|
| Задержка expiry | ~1 мин | 0ms | ~200ms | ~500ms–1s | ~200ms |
| Продление таймера | ✅ | ⚠️ race | ✅ | ⚠️ cancel+reschedule | ✅ |
| Owner офлайн | ~1 мин | 0ms | ~200ms | ~500ms–1s | ~200ms |
| Запросов при expiry (100 юзеров) | 0 | 0 | 1–2 | 0 | 0 |
| Кейс "никто не смотрит" | ✅ | запись в БД | запись в БД | ✅ | ✅ |
| Новая инфраструктура | ❌ | ❌ | ❌ | ✅ Inngest account | ✅ Railway/Fly.io |
| job_id в БД нужен | ❌ | ❌ | ❌ | ✅ | ❌ |
| Сложность | Минимальная | Низкая | Средняя | Средняя | Высокая |
| Подходит при продлении | ✅ | ❌ | ✅ | ✅ (с оговоркой) | ✅ |

---

## Описание вариантов

### 1. pg_cron only
SQL-джоб каждую минуту: `DELETE FROM reservations WHERE expires_at < now()`.
DELETE → WAL → Realtime DELETE → клиенты обновляются.

**Когда подходит:** нет требования к точности <1 мин, нет продления таймера пользователем.

### 2. Client setQueryData
Каждый клиент знает `expires_at`. При countdown=0 — удаляет запись из локального кэша
через `queryClient.setQueryData(...)` без сетевых запросов. pg_cron — только для чистки БД.

**Когда подходит:** нет продления таймера пользователем (иначе race condition).

### 3. Client RPC + jitter (рекомендуется)
При countdown=0 клиент ждёт случайный jitter (0–300ms), затем проверяет кэш.
Если резервация ещё есть — вызывает `expire_reservation(product_id)` RPC.
Сервер: `DELETE WHERE expires_at < now()` → Realtime DELETE.
Если был UPDATE expires_at (продление) — RPC получает rejected (expires_at > now()).
pg_cron раз в 5 мин как fallback для кейса "никто не смотрит".

**Когда подходит:** есть продление таймера, нет отдельного сервиса, масштаб до тысяч юзеров.

### 4. Inngest
Внешний job queue (inngest.com). При создании резервации — schedule delayed job:

```typescript
// при INSERT в reservations:
await inngest.send({
  name: 'reservation/expire',
  data: { productId, reservationId },
  ts: new Date(expires_at).getTime(), // запустить точно в этот момент
});

// Inngest function:
inngest.createFunction({ id: 'expire-reservation' }, { event: 'reservation/expire' },
  async ({ event }) => {
    await supabase.rpc('expire_reservation', { product_id: event.data.productId });
  }
);
```

**Продление таймера — оговорка:**
При продлении нужно отменить старый job и создать новый. Для этого `job_id` (или `reservationId`)
должен храниться в БД, чтобы знать какой job отменять. Inngest поддерживает cancel по `id`.

```typescript
// при UPDATE expires_at:
await inngest.cancel({ id: `expire-${reservationId}` });     // отменить старый
await inngest.send({ ..., ts: new Date(new_expires_at) });   // создать новый
```

**Задержка:** ~500ms–1s из-за cold start Edge Function при вызове из Inngest.

**Когда подходит:** нужна серверная точность без своего сервиса, сложная логика при expiry
(push-уведомления, аналитика), free tier достаточен (50K runs/month >> наши ~600/month).

### 5. Timer Service (персистентный фоновый процесс)
Маленький Node.js/Deno сервис (~50 строк) на Railway/Fly.io free tier:
- Подписан на Supabase Realtime (INSERT/UPDATE в `reservations`)
- На INSERT → `setTimeout(expires_at - now())`
- На UPDATE (продление) → `clearTimeout` + новый `setTimeout`
- При срабатывании → вызывает `expire_reservation` RPC → Realtime DELETE

**Когда подходит:** нужна точность до миллисекунды, сложная логика при expiry
(push-уведомления, вебхуки), масштаб 10 000+ пользователей.

---

## Decision

**Client RPC + jitter + pg_cron fallback** — единственный вариант без новой инфраструктуры,
который корректно обрабатывает продление таймера пользователем.

**Реализовано в p020** (2026-03-10):
- `expire_reservation(p_product_id)` RPC (SECURITY DEFINER) в `initial_schema.sql`
- pg_cron job каждые 5 мин как fallback (с тихой обработкой ошибки если недоступен)
- `useExpiryTrigger(reservation)` в `useReservations.ts` — setTimeout на `expires_at`, затем jitter 0–300ms + проверка кэша + RPC
- `useAddToCart` использует RPC вместо прямого DELETE перед INSERT
- `useExpiryTrigger` подключён в `GridCell` (витрина) и `ItemCard` (экран товара)

---

## Consequences

**При выборе Client RPC + jitter:**
- Нужен RPC `expire_reservation(product_id)` в Supabase с проверкой `expires_at < now()`
- `useAddToCart` должен удалять любую истёкшую резервацию для product_id перед INSERT
  (не только свою), иначе UNIQUE violation при добавлении после чужого истёкшего таймера
- pg_cron как fallback — раз в 5 мин достаточно
- При добавлении продления таймера: только UPDATE `expires_at` в БД — клиенты получат
  Realtime UPDATE и пересчитают countdown автоматически, без изменений в логике expiry

**При переходе на Timer Service в будущем:**
- Убрать jitter-логику с клиентов
- Добавить обработку UPDATE в Timer Service (clearTimeout + reschedule)
- pg_cron можно оставить как второй fallback или убрать

## Notes

- `reservations` должна быть в `supabase_realtime` publication — уже добавлена
- Для получения `product_id` в DELETE payload нужен `REPLICA IDENTITY FULL` на таблице
  (иначе payload содержит только PK). Актуально если переходим на setQueryData по событию.
- Текущая реализация в `useReservations.ts` использует `invalidateQueries` на любое событие —
  при переходе на RPC-подход можно оптимизировать: DELETE → setQueryData (убрать product_id),
  INSERT/UPDATE → invalidateQueries (нужны свежие данные)
