import { useEffect, useId } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

interface TableFilter {
  table: string;
  filter?: string;
}

// Hybrid live-data pattern: subscribe to Postgres changes for a signal only,
// then let TanStack Query refetch through its normal HTTP path. Keeps clients
// in sync without the fragility of patching joined rows client-side.
export function useRealtimeInvalidation(
  subscriptions: TableFilter[],
  queryKeys: QueryKey[]
) {
  const queryClient = useQueryClient();
  const instanceId = useId();

  const tablesSig = subscriptions.map((s) => `${s.table}:${s.filter ?? ''}`).join(',');
  const keysSig = JSON.stringify(queryKeys);

  useEffect(() => {
    if (subscriptions.length === 0) return;

    let channel = supabase.channel(`rt-${instanceId}`);
    for (const { table, filter } of subscriptions) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        () => {
          for (const key of queryKeys) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        }
      );
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesSig, keysSig, queryClient, instanceId]);
}
