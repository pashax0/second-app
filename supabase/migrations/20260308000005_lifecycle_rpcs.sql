-- Step 8.3 — Lifecycle RPCs (admin-only).
-- See: .llm/context/product-lifecycle.md (section "Консистентность.3").
--
-- All functions:
--   • SECURITY DEFINER (bypass RLS to mutate products/drops/orders/etc.)
--   • is_admin() guard
--   • atomic in a single transaction
--
-- Customer-facing create_order lives in 20260308000004_create_order_fn.sql.

-- ── publish_product ────────────────────────────────────────────────────────
-- Adds product to drop's drop_items.
-- target drop active    → product status → 'listed'
-- target drop scheduled → product stays 'in_stock' (composite: Scheduled)
create or replace function public.publish_product(p_id uuid, p_drop_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_drop_status    text;
  v_product_status text;
  v_next_position  int;
begin
  if not public.is_admin() then raise exception 'unauthorized'; end if;

  select status into v_drop_status from public.drops where id = p_drop_id;
  if not found then raise exception 'drop_not_found'; end if;
  if v_drop_status not in ('scheduled', 'active') then
    raise exception 'drop_not_publishable';
  end if;

  select status into v_product_status from public.products where id = p_id;
  if not found then raise exception 'product_not_found'; end if;
  if v_product_status <> 'in_stock' then
    raise exception 'product_not_in_stock';
  end if;

  select coalesce(max(position), -1) + 1 into v_next_position
    from public.drop_items where drop_id = p_drop_id;

  insert into public.drop_items (drop_id, product_id, position)
  values (p_drop_id, p_id, v_next_position);

  if v_drop_status = 'active' then
    update public.products set status = 'listed' where id = p_id;
  end if;
end;
$$;

-- ── withdraw_product ───────────────────────────────────────────────────────
-- Removes product from active drop's drop_items, reverts to 'in_stock'.
-- Refuses if active reservation exists.
create or replace function public.withdraw_product(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_active_drop uuid;
begin
  if not public.is_admin() then raise exception 'unauthorized'; end if;

  if exists (
    select 1 from public.reservations
    where product_id = p_id and expires_at > now()
  ) then
    raise exception 'product_in_cart';
  end if;

  select id into v_active_drop from public.drops where status = 'active';
  if v_active_drop is null then raise exception 'no_active_drop'; end if;

  delete from public.drop_items
  where product_id = p_id and drop_id = v_active_drop;

  update public.products set status = 'in_stock' where id = p_id;
end;
$$;

-- ── activate_drop ──────────────────────────────────────────────────────────
-- Atomically: archive current active drop (revert its unsold products),
-- then activate target scheduled drop (its products become 'listed').
create or replace function public.activate_drop(p_drop_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_target_status text;
  v_prev_active   uuid;
begin
  if not public.is_admin() then raise exception 'unauthorized'; end if;

  select status into v_target_status from public.drops where id = p_drop_id;
  if not found then raise exception 'drop_not_found'; end if;
  if v_target_status <> 'scheduled' then
    raise exception 'drop_not_scheduled';
  end if;

  select id into v_prev_active from public.drops where status = 'active';
  if v_prev_active is not null then
    update public.products set status = 'in_stock'
    where id in (select product_id from public.drop_items where drop_id = v_prev_active)
      and status = 'listed';

    update public.drops set status = 'archived' where id = v_prev_active;
  end if;

  update public.drops set status = 'active', published_at = now() where id = p_drop_id;

  update public.products set status = 'listed'
  where id in (select product_id from public.drop_items where drop_id = p_drop_id)
    and status = 'in_stock';
end;
$$;

-- ── archive_drop ───────────────────────────────────────────────────────────
-- Archive an active drop and revert its unsold products to 'in_stock'.
create or replace function public.archive_drop(p_drop_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if not public.is_admin() then raise exception 'unauthorized'; end if;

  select status into v_status from public.drops where id = p_drop_id;
  if not found then raise exception 'drop_not_found'; end if;
  if v_status <> 'active' then raise exception 'drop_not_active'; end if;

  update public.products set status = 'in_stock'
  where id in (select product_id from public.drop_items where drop_id = p_drop_id)
    and status = 'listed';

  update public.drops set status = 'archived' where id = p_drop_id;
end;
$$;

-- ── complete_order ─────────────────────────────────────────────────────────
-- Marks products in order's order_items as 'sold' (idempotent for already-sold).
-- Note: drop_items rows are intentionally NOT deleted — sold items stay in the
-- active drop grid for FOMO display (see business.md, ux.md).
create or replace function public.complete_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'unauthorized'; end if;

  if not exists (select 1 from public.orders where id = p_order_id) then
    raise exception 'order_not_found';
  end if;

  update public.products set status = 'sold'
  where id in (select product_id from public.order_items where order_id = p_order_id)
    and status = 'listed';
end;
$$;

-- ── cancel_order ───────────────────────────────────────────────────────────
-- Cancels order; reverts each product based on whether its drop is still active.
create or replace function public.cancel_order(
  p_order_id uuid,
  p_reason   text,
  p_notes    text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status   text;
  v_drop_id  uuid;
  v_drop_status text;
  v_target_status text;
begin
  if not public.is_admin() then raise exception 'unauthorized'; end if;

  if p_reason is null or p_reason not in (
    'customer_request','no_show','damaged_in_transit',
    'admin_withdraw','out_of_stock','other'
  ) then
    raise exception 'invalid_reason';
  end if;

  select status, drop_id into v_status, v_drop_id from public.orders where id = p_order_id;
  if not found then raise exception 'order_not_found'; end if;
  if v_status = 'cancelled' then raise exception 'order_already_cancelled'; end if;

  -- Determine target product status from the order's drop (active → listed; otherwise in_stock)
  v_target_status := 'in_stock';
  if v_drop_id is not null then
    select status into v_drop_status from public.drops where id = v_drop_id;
    if v_drop_status = 'active' then
      v_target_status := 'listed';
    end if;
  end if;

  update public.products set status = v_target_status
  where id in (select product_id from public.order_items where order_id = p_order_id)
    and status = 'sold';

  update public.orders
  set status = 'cancelled',
      cancellation_reason = p_reason,
      cancellation_notes  = p_notes
  where id = p_order_id;
end;
$$;

-- ── process_return ─────────────────────────────────────────────────────────
-- Records a return; product status stays 'sold' until inspection completes.
create or replace function public.process_return(
  p_order_item_id uuid,
  p_reason        text,
  p_refund_amount numeric default null,
  p_notes         text    default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_product_id uuid;
  v_return_id  uuid;
begin
  if not public.is_admin() then raise exception 'unauthorized'; end if;

  if p_reason is null or p_reason not in ('size','quality','color','changed_mind','other') then
    raise exception 'invalid_reason';
  end if;

  select product_id into v_product_id from public.order_items where id = p_order_item_id;
  if not found then raise exception 'order_item_not_found'; end if;

  insert into public.returns (order_item_id, product_id, reason, refund_amount, notes)
  values (p_order_item_id, v_product_id, p_reason, p_refund_amount, p_notes)
  returning id into v_return_id;

  return v_return_id;
end;
$$;

-- ── complete_return_inspection ─────────────────────────────────────────────
-- outcome='relisted'    → product back to 'in_stock'
-- outcome='written_off' → product 'written_off' + write_offs row
create or replace function public.complete_return_inspection(
  p_return_id uuid,
  p_outcome   text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_product_id uuid;
  v_status     text;
  v_notes      text;
begin
  if not public.is_admin() then raise exception 'unauthorized'; end if;

  if p_outcome not in ('relisted','written_off') then
    raise exception 'invalid_outcome';
  end if;

  select product_id, inspection_status, notes
    into v_product_id, v_status, v_notes
    from public.returns where id = p_return_id;
  if not found then raise exception 'return_not_found'; end if;
  if v_status <> 'pending' then raise exception 'return_already_inspected'; end if;

  update public.returns
  set inspection_status = p_outcome,
      inspected_at      = now()
  where id = p_return_id;

  if p_outcome = 'relisted' then
    update public.products set status = 'in_stock' where id = v_product_id;
  else
    update public.products set status = 'written_off' where id = v_product_id;
    insert into public.write_offs (product_id, reason, notes)
    values (v_product_id, 'damaged', coalesce(v_notes, 'returned, inspection failed'));
  end if;
end;
$$;

-- ── write_off_product ──────────────────────────────────────────────────────
-- Manual write-off for products in stock or listed. Removes from active drop
-- items if currently listed.
create or replace function public.write_off_product(
  p_id     uuid,
  p_reason text,
  p_notes  text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if not public.is_admin() then raise exception 'unauthorized'; end if;

  if p_reason not in ('damaged','lost','personal','other') then
    raise exception 'invalid_reason';
  end if;

  select status into v_status from public.products where id = p_id;
  if not found then raise exception 'product_not_found'; end if;
  if v_status not in ('in_stock', 'listed') then
    raise exception 'product_not_writable_off';
  end if;

  if v_status = 'listed' then
    delete from public.drop_items
    where product_id = p_id
      and drop_id in (select id from public.drops where status = 'active');
  end if;

  insert into public.write_offs (product_id, reason, notes)
  values (p_id, p_reason, p_notes);

  update public.products set status = 'written_off' where id = p_id;
end;
$$;

-- ── delete_product ─────────────────────────────────────────────────────────
-- Hard delete only for in_stock products with no drop_items history.
-- Other in_stock → soft delete (deleted_at).
-- sold / written_off / listed → not deletable via this RPC.
create or replace function public.delete_product(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_status      text;
  v_has_history boolean;
begin
  if not public.is_admin() then raise exception 'unauthorized'; end if;

  select status into v_status from public.products where id = p_id;
  if not found then raise exception 'product_not_found'; end if;

  if v_status = 'listed' then raise exception 'product_listed_withdraw_first'; end if;
  if v_status in ('sold', 'written_off') then raise exception 'product_not_deletable'; end if;

  -- in_stock from here
  v_has_history := exists (select 1 from public.drop_items where product_id = p_id);

  if v_has_history then
    update public.products set deleted_at = now() where id = p_id;
    return 'soft';
  end if;

  delete from public.products where id = p_id;
  return 'hard';
end;
$$;

-- ── grants ─────────────────────────────────────────────────────────────────
-- All RPCs are authenticated-only at the privilege layer; admin gating is
-- enforced inside each function via is_admin().
revoke all on function public.publish_product(uuid, uuid)               from public;
revoke all on function public.withdraw_product(uuid)                    from public;
revoke all on function public.activate_drop(uuid)                       from public;
revoke all on function public.archive_drop(uuid)                        from public;
revoke all on function public.complete_order(uuid)                      from public;
revoke all on function public.cancel_order(uuid, text, text)            from public;
revoke all on function public.process_return(uuid, text, numeric, text) from public;
revoke all on function public.complete_return_inspection(uuid, text)    from public;
revoke all on function public.write_off_product(uuid, text, text)       from public;
revoke all on function public.delete_product(uuid)                      from public;

grant execute on function public.publish_product(uuid, uuid)               to authenticated;
grant execute on function public.withdraw_product(uuid)                    to authenticated;
grant execute on function public.activate_drop(uuid)                       to authenticated;
grant execute on function public.archive_drop(uuid)                        to authenticated;
grant execute on function public.complete_order(uuid)                      to authenticated;
grant execute on function public.cancel_order(uuid, text, text)            to authenticated;
grant execute on function public.process_return(uuid, text, numeric, text) to authenticated;
grant execute on function public.complete_return_inspection(uuid, text)    to authenticated;
grant execute on function public.write_off_product(uuid, text, text)       to authenticated;
grant execute on function public.delete_product(uuid)                      to authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- Step 8.4 — Triggers (guard rails).
-- See: .llm/context/product-lifecycle.md (section "Консистентность.4").
--
-- Triggers are a safety net for direct table manipulation (ad-hoc SQL,
-- migrations). They duplicate RPC logic and are idempotent: a status update
-- that's already correct is a no-op. After step 8.5 locks down direct UPDATE
-- on products.status, these triggers must be SECURITY DEFINER to bypass that
-- restriction when fired from a transaction that touched drop_items / drops /
-- orders directly.
-- ──────────────────────────────────────────────────────────────────────────────

-- Recompute product status from drop_items state.
-- Skips terminal statuses ('sold', 'written_off') which are managed by RPCs.
create or replace function public._recompute_product_status(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status    text;
  v_in_active boolean;
begin
  select status into v_status from public.products where id = p_id;
  if v_status is null or v_status in ('sold', 'written_off') then return; end if;

  v_in_active := exists (
    select 1 from public.drop_items di
      join public.drops d on d.id = di.drop_id
    where di.product_id = p_id and d.status = 'active'
  );

  if v_in_active and v_status <> 'listed' then
    update public.products set status = 'listed' where id = p_id;
  elsif not v_in_active and v_status = 'listed' then
    update public.products set status = 'in_stock' where id = p_id;
  end if;
end;
$$;

-- drop_items AFTER INSERT/DELETE → recompute affected product
create or replace function public._sync_drop_items_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    perform public._recompute_product_status(NEW.product_id);
  elsif TG_OP = 'DELETE' then
    perform public._recompute_product_status(OLD.product_id);
  end if;
  return null;
end;
$$;

create trigger sync_drop_items_change
  after insert or delete on public.drop_items
  for each row execute function public._sync_drop_items_change();

-- drops AFTER UPDATE OF status → mass recompute every product in this drop
create or replace function public._sync_drops_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if NEW.status is distinct from OLD.status then
    for r in select product_id from public.drop_items where drop_id = NEW.id loop
      perform public._recompute_product_status(r.product_id);
    end loop;
  end if;
  return null;
end;
$$;

create trigger sync_drops_status_change
  after update of status on public.drops
  for each row execute function public._sync_drops_status_change();

-- orders AFTER UPDATE OF status → revert sold products on cancel
-- (Only this branch — other status transitions don't touch products.)
create or replace function public._sync_orders_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_drop_status   text;
  v_target_status text;
begin
  if NEW.status = 'cancelled' and OLD.status <> 'cancelled' then
    v_target_status := 'in_stock';
    if NEW.drop_id is not null then
      select status into v_drop_status from public.drops where id = NEW.drop_id;
      if v_drop_status = 'active' then
        v_target_status := 'listed';
      end if;
    end if;

    update public.products set status = v_target_status
    where id in (select product_id from public.order_items where order_id = NEW.id)
      and status = 'sold';
  end if;
  return null;
end;
$$;

create trigger sync_orders_status_change
  after update of status on public.orders
  for each row execute function public._sync_orders_status_change();

-- ──────────────────────────────────────────────────────────────────────────────
-- Step 8.6 — View products_with_flags (composite filter helpers).
-- See: .llm/context/product-lifecycle.md (section "Консистентность.5").
--
-- Soft-deleted products are excluded. Composite states (Scheduled / Returned /
-- In cart / Pending return) are derived in queries by combining `status` with
-- the boolean flags below.
-- security_invoker=on so RLS on `products` is honored for the calling user.
-- ──────────────────────────────────────────────────────────────────────────────

create view public.products_with_flags
with (security_invoker = on) as
select p.*,
  exists(
    select 1 from public.drop_items di
      join public.drops d on d.id = di.drop_id
    where di.product_id = p.id and d.status = 'scheduled'
  ) as is_scheduled,
  exists(
    select 1 from public.drop_items di
      join public.drops d on d.id = di.drop_id
    where di.product_id = p.id and d.status = 'archived'
  ) as is_returned_to_stock,
  exists(
    select 1 from public.reservations r
    where r.product_id = p.id and r.expires_at > now()
  ) as is_in_cart,
  exists(
    select 1 from public.returns rt
    where rt.product_id = p.id and rt.inspection_status = 'pending'
  ) as has_pending_return
from public.products p
where p.deleted_at is null;

grant select on public.products_with_flags to anon, authenticated;
