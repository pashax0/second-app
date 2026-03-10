import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMyCart, useRemoveFromCart, type CartItem } from '../../hooks/useCart';
import { useAuthStore } from '../../stores/auth';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { queryKeys } from '../../lib/queryKeys';

function useCountdown(expiresAt: string): string {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) { setLabel(''); return; }
      const totalSec = Math.ceil(ms / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      setLabel(`${min}:${String(sec).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return label;
}

export default function CartScreen() {
  const { user, isAnonymous } = useAuthStore();
  const { data: items, isLoading } = useMyCart();
  const queryClient = useQueryClient();

  // Refresh cart when tab becomes focused (e.g. after signing in)
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.reservations.mine() });
  }, [user?.id]);

  // Subscribe to realtime reservation changes
  useEffect(() => {
    const channel = supabase
      .channel('cart-reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.reservations.mine() });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Корзина</Text>
        <Text className="text-gray-500 text-center mb-8">
          Добавьте товар на витрине — он появится здесь
        </Text>
        <Pressable
          className="bg-gray-900 rounded-full px-8 py-3 mb-3 w-full items-center"
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text className="text-white font-semibold">Войти</Text>
        </Pressable>
        <Pressable
          className="border border-gray-200 rounded-full px-8 py-3 w-full items-center"
          onPress={() => router.push('/(auth)/sign-up')}
        >
          <Text className="text-gray-900 font-semibold">Создать аккаунт</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!items || items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Корзина пуста</Text>
        <Text className="text-gray-500 text-center">
          Найдите что-нибудь на витрине
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {isAnonymous && (
        <View className="bg-gray-50 border-b border-gray-100 px-4 py-3">
          <Text className="text-sm text-gray-600 text-center">
            Создайте аккаунт, чтобы оформить заказ
          </Text>
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View className="border-b border-gray-100" />}
        renderItem={({ item }) => <CartRow item={item} isAnonymous={isAnonymous} />}
      />
    </View>
  );
}

function CartRow({ item, isAnonymous }: { item: CartItem; isAnonymous: boolean }) {
  const countdown = useCountdown(item.expires_at);
  const { mutate: remove, isPending: isRemoving } = useRemoveFromCart();
  const imageUrl = item.product.images[0]?.url;

  return (
    <View className="flex-row items-center px-4 py-3 gap-3">
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: 72, height: 72, borderRadius: 8 }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ width: 72, height: 72, borderRadius: 8 }} className="bg-gray-100" />
      )}

      <View className="flex-1">
        <Text className="font-semibold text-gray-900" numberOfLines={1}>
          {item.product.name}
        </Text>
        {item.product.brand ? (
          <Text className="text-sm text-gray-500">{item.product.brand}</Text>
        ) : null}
        <Text className="text-sm font-medium text-gray-900 mt-1">
          {Number(item.product.price).toLocaleString('ru-RU')} ₽
        </Text>
        {countdown ? (
          <Text className="text-xs text-orange-500 mt-0.5">Зарезервировано {countdown}</Text>
        ) : null}
      </View>

      <View className="items-end gap-2">
        {isAnonymous ? (
          <Pressable
            className="bg-gray-900 rounded-full px-4 py-2"
            onPress={() => router.push('/(auth)/sign-up')}
          >
            <Text className="text-white text-xs font-semibold">Войти</Text>
          </Pressable>
        ) : (
          <Pressable
            className="bg-gray-900 rounded-full px-4 py-2"
            onPress={() =>
              router.push({
                pathname: '/checkout',
                params: { dropId: item.drop_id, productId: item.product_id },
              })
            }
          >
            <Text className="text-white text-xs font-semibold">Оформить</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => remove({ productId: item.product_id })}
          disabled={isRemoving}
        >
          <Text className="text-xs text-gray-400">Удалить</Text>
        </Pressable>
      </View>
    </View>
  );
}
