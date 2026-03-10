import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useActiveDrop, type DropItem } from '../../hooks/useActiveDrop';
import { useReservations, useExpiryTrigger, type Reservation } from '../../hooks/useReservations';
import { usePhotoGrid } from '../../lib/grid';
import { useAuthStore } from '../../stores/auth';

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

export default function DropsScreen() {
  const { data: drop, isLoading, error } = useActiveDrop();
  const { cols, cellSize, gap } = usePhotoGrid();
  const { user } = useAuthStore();

  const productIds = drop?.drop_items.map((i) => i.product.id) ?? [];
  const { data: reservations } = useReservations(productIds);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-red-500 text-center">Не удалось загрузить дроп</Text>
      </View>
    );
  }

  if (!drop) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Сегодня дропа нет</Text>
        <Text className="text-gray-500 text-center">
          Следите за уведомлениями — следующий дроп скоро
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <FlatList
        key={cols}
        data={drop.drop_items}
        keyExtractor={(item) => item.id}
        numColumns={cols}
        columnWrapperStyle={cols > 1 ? { gap } : undefined}
        ItemSeparatorComponent={() => <View style={{ height: gap }} />}
        ListHeaderComponent={
          drop.description ? (
            <View className="px-4 py-3 border-b border-gray-100">
              <Text className="text-sm text-gray-600">{drop.description}</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <GridCell
            item={item}
            index={index}
            dropId={drop.id}
            cellSize={cellSize}
            reservation={reservations?.get(item.product.id)}
            currentUserId={user?.id}
          />
        )}
      />
    </View>
  );
}

function GridCell({
  item,
  index,
  dropId,
  cellSize,
  reservation,
  currentUserId,
}: {
  item: DropItem;
  index: number;
  dropId: string;
  cellSize: number;
  reservation?: Reservation | undefined;
  currentUserId?: string;
}) {
  const isSold = item.product.status === 'sold';
  const isMyReservation = !!reservation && reservation.user_id === currentUserId;
  const isSomeoneElsesReservation = !!reservation && !isMyReservation;
  const imageUrl = item.product.images[0]?.url;
  const countdown = useCountdown(reservation?.expires_at);
  useExpiryTrigger(reservation);

  return (
    <Pressable
      style={{ width: cellSize, height: cellSize }}
      onPress={() =>
        router.push({ pathname: '/item/[id]', params: { id: item.product.id, dropId, index } })
      }
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: cellSize, height: cellSize }}
          resizeMode="cover"
        />
      ) : (
        <View className="flex-1 bg-gray-100" />
      )}

      {isSold && (
        <View
          className="absolute items-center justify-center bg-white/70"
          style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Text className="text-xs font-semibold text-gray-500">Продано</Text>
        </View>
      )}

      {isMyReservation && (
        <View className="absolute bottom-0 left-0 right-0 bg-gray-900/70 py-1 items-center">
          <Text className="text-white text-xs font-medium">
            {countdown ? `В корзине ${countdown}` : 'В корзине'}
          </Text>
        </View>
      )}

      {isSomeoneElsesReservation && (
        <View className="absolute bottom-0 left-0 right-0 bg-black/50 py-1 items-center">
          <Text className="text-white text-xs font-medium">
            {countdown ? `Зарезервировано ${countdown}` : 'Зарезервировано'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
