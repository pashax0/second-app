import { useEffect, useId } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
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
  // Unique channel name per hook instance — prevents removeChannel from breaking
  // other mounted components (e.g. index.tsx + item/[id].tsx both call this hook).
  const channelId = useId();

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
      .channel(`reservations-changes-${channelId}`)
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

async function triggerExpiry(productId: string, queryClient: QueryClient) {
  // Jitter 0–300ms: reduces thundering herd when many clients expire simultaneously
  await new Promise<void>((resolve) => setTimeout(resolve, Math.random() * 300));

  const cached = queryClient.getQueryData<Map<string, Reservation>>(
    queryKeys.reservations.active()
  );
  if (!cached?.has(productId)) return;

  await supabase.rpc('expire_reservation', { p_product_id: productId });

  // Realtime DELETE for expired rows is blocked by RLS (expires_at > now() fails on old row),
  // so we invalidate manually after the RPC call instead of relying on the event.
  queryClient.invalidateQueries({ queryKey: queryKeys.reservations.active() });
  queryClient.invalidateQueries({ queryKey: queryKeys.reservations.mine() });
}

// Schedules a client-side expiry call when the reservation timer runs out.
// Implements the "Client RPC + jitter" pattern from ADR-004.
export function useExpiryTrigger(reservation: Reservation | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!reservation) return;

    const ms = new Date(reservation.expires_at).getTime() - Date.now();
    const delay = Math.max(0, ms);
    const id = setTimeout(() => triggerExpiry(reservation.product_id, queryClient), delay);
    return () => clearTimeout(id);
  }, [reservation?.product_id, reservation?.expires_at, queryClient]);
}
