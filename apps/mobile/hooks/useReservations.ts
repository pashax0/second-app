import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';

export type Reservation = {
  product_id: string;
  user_id: string;
  drop_id: string;
  expires_at: string;
};

// Returns a map of productId → Reservation for all active (non-expired) reservations.
// Keeps itself fresh via Realtime.
export function useReservations(productIds: string[]) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.reservations.active(),
    queryFn: async (): Promise<Map<string, Reservation>> => {
      if (productIds.length === 0) return new Map();

      const { data, error } = await supabase
        .from('reservations')
        .select('product_id, user_id, drop_id, expires_at')
        .in('product_id', productIds)
        .gt('expires_at', new Date().toISOString());

      if (error) throw error;

      const map = new Map<string, Reservation>();
      for (const row of data ?? []) {
        map.set(row.product_id, row as Reservation);
      }
      return map;
    },
    enabled: productIds.length > 0,
  });

  // Realtime: invalidate cache whenever any reservation changes
  useEffect(() => {
    if (productIds.length === 0) return;

    const channel = supabase
      .channel('reservations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeys.reservations.active() });
          // Reservation deleted on purchase → refresh product statuses too
          queryClient.invalidateQueries({ queryKey: queryKeys.drops.active() });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productIds.length, queryClient]);

  return query;
}
