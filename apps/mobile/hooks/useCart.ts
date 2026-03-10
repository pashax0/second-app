import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';

const RESERVATION_MINUTES = 10;
const ANONYMOUS_RESERVATION_MINUTES = 5;
const ANONYMOUS_CART_LIMIT = 1;

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

      if (isAnon) {
        // Enforce 1-item limit for anonymous users
        const { data: existing } = await supabase
          .from('reservations')
          .select('id')
          .eq('user_id', user.id)
          .gt('expires_at', new Date().toISOString());

        if ((existing?.length ?? 0) >= ANONYMOUS_CART_LIMIT) {
          throw new Error('anon_cart_limit');
        }
      }

      const minutes = isAnon ? ANONYMOUS_RESERVATION_MINUTES : RESERVATION_MINUTES;
      const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

      // Remove own stale reservation for this product before inserting fresh one
      await supabase
        .from('reservations')
        .delete()
        .eq('product_id', productId)
        .eq('user_id', user.id);

      const { error: insertError } = await supabase.from('reservations').insert({
        product_id: productId,
        user_id: user.id,
        drop_id: dropId,
        expires_at: expiresAt,
      });

      if (insertError) {
        if (insertError.code === '23505') throw new Error('already_reserved');
        throw insertError;
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
