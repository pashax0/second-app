import { ActivityIndicator, Dimensions, FlatList, Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useActiveDrop, type DropItem } from '../../hooks/useActiveDrop';

const COLS = 3;
const GAP = 1;
const CELL_SIZE = (Dimensions.get('window').width - GAP * (COLS - 1)) / COLS;

export default function DropsScreen() {
  const { data: drop, isLoading, error } = useActiveDrop();

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
        data={drop.drop_items}
        keyExtractor={(item) => item.id}
        numColumns={COLS}
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        ListHeaderComponent={
          drop.description ? (
            <View className="px-4 py-3 border-b border-gray-100">
              <Text className="text-sm text-gray-600">{drop.description}</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => (
          <GridCell item={item} index={index} dropId={drop.id} />
        )}
      />
    </View>
  );
}

function GridCell({ item, index, dropId }: { item: DropItem; index: number; dropId: string }) {
  const isSoldOut = item.product.stock_quantity === 0;
  const imageUrl = item.product.images[0]?.url;

  return (
    <Pressable
      style={{ width: CELL_SIZE, height: CELL_SIZE }}
      onPress={() =>
        router.push({ pathname: '/item/[id]', params: { id: item.product.id, dropId, index } })
      }
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: CELL_SIZE, height: CELL_SIZE }}
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
