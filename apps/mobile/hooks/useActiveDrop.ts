import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';

export type Measurements = {
  chest?: number | null;
  waist?: number | null;
  hips?: number | null;
  length?: number | null;
};

export type DropProduct = {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  country: string | null;
  size: string | null;
  measurements: Measurements | null;
  item_number: string | null;
  price: number;
  stock_quantity: number;
};

export type DropItem = {
  id: string;
  quantity: number;
  position: number;
  override_price: number | null;
  product: DropProduct;
};

export type ActiveDrop = {
  id: string;
  title: string | null;
  description: string | null;
  scheduled_at: string;
  published_at: string | null;
  drop_items: DropItem[];
};

async function fetchActiveDrop(): Promise<ActiveDrop | null> {
  const { data, error } = await supabase
    .from('drops')
    .select(`
      id,
      title,
      description,
      scheduled_at,
      published_at,
      drop_items (
        id,
        quantity,
        position,
        override_price,
        product:products (
          id,
          name,
          description,
          brand,
          country,
          size,
          measurements,
          item_number,
          price,
          stock_quantity
        )
      )
    `)
    .eq('status', 'active')
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const items = (data.drop_items as unknown as DropItem[]).sort(
    (a, b) => a.position - b.position
  );

  return { ...data, drop_items: items } as ActiveDrop;
}

export function useActiveDrop() {
  return useQuery({
    queryKey: queryKeys.drops.active(),
    queryFn: fetchActiveDrop,
  });
}
