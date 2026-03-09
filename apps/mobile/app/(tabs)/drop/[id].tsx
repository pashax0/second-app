import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useDrop } from '../../../hooks/useDrop';
import { usePhotoGrid } from '../../../lib/grid';
import type { DropItem } from '../../../hooks/useActiveDrop';

export default function DropScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: drop, isLoading, error } = useDrop(id);
  const { cols, cellSize, gap } = usePhotoGrid();

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
        <Text className="text-gray-500 text-center">Дроп не найден</Text>
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
          <GridCell item={item} index={index} dropId={drop.id} cellSize={cellSize} />
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
}: {
  item: DropItem;
  index: number;
  dropId: string;
  cellSize: number;
}) {
  const isSoldOut = item.product.stock_quantity === 0;
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
      {isSoldOut && (
        <View
          className="absolute items-center justify-center bg-white/70"
          style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Text className="text-xs font-semibold text-gray-500">Продано</Text>
        </View>
      )}
    </Pressable>
  );
}
