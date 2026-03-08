import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import type { ActiveDrop, DropItem } from './useActiveDrop';

const DROP_SELECT = `
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
`;

async function fetchDrop(id: string): Promise<ActiveDrop | null> {
  const { data, error } = await supabase
    .from('drops')
    .select(DROP_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const items = (data.drop_items as unknown as DropItem[]).sort(
    (a, b) => a.position - b.position
  );

  return { ...data, drop_items: items } as ActiveDrop;
}

export async function fetchArchivedDrops() {
  const { data, error } = await supabase
    .from('drops')
    .select('id, title, description, scheduled_at, published_at')
    .eq('status', 'archived')
    .order('scheduled_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export type ArchivedDrop = {
  id: string;
  title: string | null;
  description: string | null;
  scheduled_at: string;
  published_at: string | null;
};

export function useDrop(id: string) {
  return useQuery({
    queryKey: queryKeys.drops.byId(id),
    queryFn: () => fetchDrop(id),
    enabled: !!id,
  });
}

export function useArchivedDrops() {
  return useQuery({
    queryKey: queryKeys.drops.archived(),
    queryFn: fetchArchivedDrops,
  });
}
