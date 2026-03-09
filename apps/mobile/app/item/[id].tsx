import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, useWindowDimensions, View, ViewToken } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useActiveDrop, type DropItem, type Measurements } from '../../hooks/useActiveDrop';
import { useDrop } from '../../hooks/useDrop';
import { useReservations, type Reservation } from '../../hooks/useReservations';
import { useAddToCart, useRemoveFromCart } from '../../hooks/useCart';
import { useAuthStore } from '../../stores/auth';

function formatMeasurements(m: Measurements | null): string {
  if (!m) return '';
  const parts: string[] = [];
  if (m.chest) parts.push(`ПОГ ${m.chest}`);
  if (m.waist) parts.push(`ПОТ ${m.waist}`);
  if (m.hips) parts.push(`ПОБ ${m.hips}`);
  if (m.length) parts.push(`дл. ${m.length}`);
  return parts.join(' · ');
}

function useCountdown(expiresAt: string | undefined): string {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!expiresAt) {
      setLabel('');
      return;
    }

    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) {
        setLabel('');
        return;
      }
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

export default function ItemScreen() {
  const { index, dropId } = useLocalSearchParams<{ index: string; dropId: string }>();
  const { width } = useWindowDimensions();
  const { data: activeDrop } = useActiveDrop();
  const isArchived = !!dropId && dropId !== activeDrop?.id;
  const { data: archivedDrop } = useDrop(isArchived ? dropId : '');

  const drop = isArchived ? archivedDrop : activeDrop;

  const productIds = drop?.drop_items.map((i) => i.product.id) ?? [];
  const { data: reservations } = useReservations(productIds);

  const listRef = useRef<FlatList>(null);
  const initialIndex = parseInt(index ?? '0', 10);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]) setCurrentIndex(viewableItems[0].index ?? 0);
    },
    []
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  if (!drop) return null;

  const items = drop.drop_items;
  const total = items.length;

  return (
    <>
      <Stack.Screen options={{ title: `${currentIndex + 1} / ${total}` }} />
      <View className="flex-1 bg-white">
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item, index: i }) => (
            <ItemCard
              item={item}
              dropId={drop.id}
              width={width}
              position={i + 1}
              total={total}
              reservation={reservations?.get(item.product.id)}
              isActive={!isArchived}
            />
          )}
        />
      </View>
    </>
  );
}

function ItemCard({
  item,
  dropId,
  width,
  reservation,
  isActive,
}: {
  item: DropItem;
  dropId: string;
  width: number;
  position: number;
  total: number;
  reservation: Reservation | undefined;
  isActive: boolean;
}) {
  const { product, override_price } = item;
  const displayPrice = override_price ?? product.price;
  const measurements = formatMeasurements(product.measurements);
  const { user } = useAuthStore();
  const { mutate: addToCart, isPending: isAdding } = useAddToCart();
  const { mutate: removeFromCart, isPending: isRemoving } = useRemoveFromCart();
  const countdown = useCountdown(reservation?.expires_at);

  const isSold = product.status === 'sold';
  const isMyReservation = !!reservation && reservation.user_id === user?.id;
  const isSomeoneElsesReservation = !!reservation && !isMyReservation;

  return (
    <View style={{ width }} className="flex-1">
      {product.images[0]?.url ? (
        <Image
          source={{ uri: product.images[0].url }}
          style={{ width, aspectRatio: 1 }}
          resizeMode="cover"
        />
      ) : (
        <View className="bg-gray-100" style={{ width, aspectRatio: 1 }} />
      )}

      <View className="px-4 pt-4 pb-8">
        <Text className="text-xl font-bold text-gray-900">{product.name}</Text>

        <View className="flex-row items-center gap-2 mt-1">
          {product.brand ? <Text className="text-sm text-gray-700">{product.brand}</Text> : null}
          {product.country ? (
            <Text className="text-sm text-gray-400">{product.country}</Text>
          ) : null}
        </View>

        {product.size ? (
          <Text className="text-sm text-gray-600 mt-1">Размер {product.size}</Text>
        ) : null}

        {measurements ? (
          <Text className="text-sm text-gray-500 mt-1">{measurements}</Text>
        ) : null}

        <View className="flex-row items-center justify-between mt-5">
          <Text className="text-2xl font-bold text-gray-900">
            {displayPrice.toLocaleString('ru-RU')} ₽
          </Text>

          <ActionButton
            isSold={isSold}
            isActive={isActive}
            isMyReservation={isMyReservation}
            isSomeoneElsesReservation={isSomeoneElsesReservation}
            countdown={countdown}
            isAdding={isAdding}
            isRemoving={isRemoving}
            onAddToCart={() => addToCart({ productId: product.id, dropId })}
            onRemoveFromCart={() => removeFromCart({ productId: product.id })}
            onCheckout={() =>
              router.push({ pathname: '/checkout', params: { dropId, productId: product.id } })
            }
          />
        </View>

        {/* Cancel button shown separately below when it's my reservation */}
        {isMyReservation && (
          <Pressable
            className="mt-3 items-center py-2"
            onPress={() => removeFromCart({ productId: product.id })}
            disabled={isRemoving}
          >
            <Text className="text-xs text-gray-400">Отменить резервацию</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ActionButton({
  isSold,
  isActive,
  isMyReservation,
  isSomeoneElsesReservation,
  countdown,
  isAdding,
  isRemoving,
  onAddToCart,
  onRemoveFromCart: _onRemoveFromCart,
  onCheckout,
}: {
  isSold: boolean;
  isActive: boolean;
  isMyReservation: boolean;
  isSomeoneElsesReservation: boolean;
  countdown: string;
  isAdding: boolean;
  isRemoving: boolean;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
  onCheckout: () => void;
}) {
  if (isSold) {
    return (
      <View className="bg-gray-100 rounded-full px-6 py-3">
        <Text className="text-sm font-semibold text-gray-400">Продано</Text>
      </View>
    );
  }

  if (!isActive) {
    // Archive view — no cart actions
    return (
      <View className="bg-gray-100 rounded-full px-6 py-3">
        <Text className="text-sm font-semibold text-gray-400">Продано</Text>
      </View>
    );
  }

  if (isMyReservation) {
    return (
      <View className="items-end gap-1">
        {countdown ? (
          <Text className="text-xs text-gray-400">Зарезервировано {countdown}</Text>
        ) : null}
        <Pressable
          className="bg-gray-900 rounded-full px-6 py-3"
          onPress={onCheckout}
        >
          <Text className="text-sm font-semibold text-white">Оформить</Text>
        </Pressable>
      </View>
    );
  }

  if (isSomeoneElsesReservation) {
    return (
      <View className="bg-gray-100 rounded-full px-6 py-3">
        <Text className="text-sm font-semibold text-gray-500">
          {countdown ? `Занято ${countdown}` : 'Занято'}
        </Text>
      </View>
    );
  }

  // Available — add to cart
  return (
    <Pressable
      className="bg-gray-900 rounded-full px-6 py-3"
      onPress={onAddToCart}
      disabled={isAdding || isRemoving}
    >
      {isAdding ? (
        <ActivityIndicator color="white" size="small" />
      ) : (
        <Text className="text-sm font-semibold text-white">В корзину</Text>
      )}
    </Pressable>
  );
}
