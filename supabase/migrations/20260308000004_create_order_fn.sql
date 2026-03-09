-- create_order: atomically creates an order for one product from a drop.
-- SECURITY DEFINER is required to update products.status,
-- which has no user-facing UPDATE policy.
create or replace function public.create_order(
  p_drop_id         uuid,
  p_product_id      uuid,
  p_delivery_address text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id         uuid;
  v_price_at_purchase numeric(10,2);
  v_status           text;
begin
  -- Verify the product belongs to this drop, get price and status
  select
    coalesce(di.override_price, p.price),
    p.status
  into v_price_at_purchase, v_status
  from public.drop_items di
  join public.products p on p.id = di.product_id
  where di.drop_id = p_drop_id
    and di.product_id = p_product_id;

  if not found then
    raise exception 'product_not_in_drop';
  end if;

  if v_status <> 'available' then
    raise exception 'out_of_stock';
  end if;

  -- Create the order
  insert into public.orders (user_id, drop_id, delivery_address)
  values (auth.uid(), p_drop_id, p_delivery_address)
  returning id into v_order_id;

  -- Create the order item
  insert into public.order_items (order_id, product_id, quantity, price_at_purchase)
  values (v_order_id, p_product_id, 1, v_price_at_purchase);

  -- Mark product as sold
  update public.products
  set status = 'sold'
  where id = p_product_id;

  -- Delete reservation if one exists (clean up cart)
  delete from public.reservations
  where product_id = p_product_id;

  return v_order_id;
end;
$$;

-- Only authenticated users can call this function
revoke all on function public.create_order(uuid, uuid, text) from public;
grant execute on function public.create_order(uuid, uuid, text) to authenticated;
