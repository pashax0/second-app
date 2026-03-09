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
      stock_quantity,
      images:product_images (
        url,
        position
      )
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

const ARCHIVED_SELECT = `
  id,
  description,
  scheduled_at,
  drop_items (
    id,
    position,
    product:products (
      id,
      stock_quantity,
      images:product_images (
        url,
        position
      )
    )
  )
`;

export async function fetchArchivedDrops() {
  const { data, error } = await supabase
    .from('drops')
    .select(ARCHIVED_SELECT)
    .eq('status', 'archived')
    .order('scheduled_at', { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data.map((drop) => {
    const items = (drop.drop_items as unknown as ArchivedDropItem[]).sort(
      (a, b) => a.position - b.position
    );
    return { ...drop, drop_items: items } as ArchivedDrop;
  });
}

export type ArchivedDropItem = {
  id: string;
  position: number;
  product: {
    id: string;
    stock_quantity: number;
    images: { url: string; position: number }[];
  };
};

export type ArchivedDrop = {
  id: string;
  description: string | null;
  scheduled_at: string;
  drop_items: ArchivedDropItem[];
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
