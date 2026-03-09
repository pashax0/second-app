import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useActiveDrop, type DropItem } from '../../hooks/useActiveDrop';
import { useReservations } from '../../hooks/useReservations';
import { usePhotoGrid } from '../../lib/grid';

export default function DropsScreen() {
  const { data: drop, isLoading, error } = useActiveDrop();
  const { cols, cellSize, gap } = usePhotoGrid();

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
}: {
  item: DropItem;
  index: number;
  dropId: string;
  cellSize: number;
  reservation?: { expires_at: string } | undefined;
}) {
  const isSold = item.product.status === 'sold';
  const isReserved = !!reservation;
  const imageUrl = item.product.images[0]?.url;

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

      {!isSold && isReserved && (
        <View className="absolute bottom-0 left-0 right-0 bg-black/50 py-1 items-center">
          <Text className="text-white text-xs font-medium">Занято</Text>
        </View>
      )}
    </Pressable>
  );
}
