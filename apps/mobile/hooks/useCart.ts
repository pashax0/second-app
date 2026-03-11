import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';

const RESERVATION_MINUTES = 60 / 60; // 60 sec for testing
const ANONYMOUS_RESERVATION_MINUTES = 20 / 60; // 20 sec for testing

export type CartItem = {
  id: string;
  product_id: string;
  drop_id: string;
  expires_at: string;
  product: {
    id: string;
    name: string;
    brand: string | null;
    price: number;
    status: string;
    images: { url: string; position: number }[];
  };
};

export function useMyCart() {
  return useQuery({
    queryKey: queryKeys.reservations.mine(),
    queryFn: async (): Promise<CartItem[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];

      const { data, error } = await supabase
        .from('reservations')
        .select(`
          id, product_id, drop_id, expires_at,
          product:products(id, name, brand, price, status,
            images:product_images(url, position)
          )
        `)
        .eq('user_id', session.user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at');

      if (error) throw error;
      return (data ?? []) as unknown as CartItem[];
    },
  });
}

export function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, dropId }: { productId: string; dropId: string }) => {
      // Get current session; sign in anonymously if none exists
      let { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }

      const user = session!.user;
      const isAnon = user.is_anonymous ?? false;
      const minutes = isAnon ? ANONYMOUS_RESERVATION_MINUTES : RESERVATION_MINUTES;
      const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

      // DB-side RPC: atomically checks anon limit, expires stale reservation, inserts.
      const { error } = await supabase.rpc('create_reservation', {
        p_product_id: productId,
        p_drop_id: dropId,
        p_expires_at: expiresAt,
      });

      if (error) {
        if (error.message === 'anon_cart_limit') throw new Error('anon_cart_limit');
        if (error.code === '23505') throw new Error('already_reserved');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.active() });
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.mine() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.mine() });
    },
  });
}
