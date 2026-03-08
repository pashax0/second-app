import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';

export type DropItem = {
  id: string;
  quantity: number;
  override_price: number | null;
  product: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    stock_quantity: number;
  };
};

export type ActiveDrop = {
  id: string;
  title: string | null;
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
      scheduled_at,
      published_at,
      drop_items (
        id,
        quantity,
        override_price,
        product:products (
          id,
          name,
          description,
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
  return data as ActiveDrop | null;
}

export function useActiveDrop() {
  return useQuery({
    queryKey: queryKeys.drops.active(),
    queryFn: fetchActiveDrop,
  });
}
