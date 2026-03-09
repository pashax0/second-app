import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import { useAuthStore } from '../stores/auth';

// Reservation duration in minutes (matches backend default)
const RESERVATION_MINUTES = 10;

export function useAddToCart() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async ({ productId, dropId }: { productId: string; dropId: string }) => {
      if (!user) throw new Error('not_authenticated');

      const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000).toISOString();

      // Delete my own expired reservation if any, then insert fresh one.
      // RLS ensures only my rows are deleted; if someone else holds it, insert will fail.
      await supabase
        .from('reservations')
        .delete()
        .eq('product_id', productId)
        .eq('user_id', user.id);

      const { error } = await supabase.from('reservations').insert({
        product_id: productId,
        user_id: user.id,
        drop_id: dropId,
        expires_at: expiresAt,
      });

      if (error) {
        if (error.code === '23505') throw new Error('already_reserved');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.active() });
    },
  });
}

export function useRemoveFromCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId }: { productId: string }) => {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('product_id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.active() });
    },
  });
}
