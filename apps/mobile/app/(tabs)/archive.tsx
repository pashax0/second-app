import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useArchivedDrops, type ArchivedDrop, type ArchivedDropItem } from '../../hooks/useDrop';
import { usePhotoGrid } from '../../lib/grid';

export default function ArchiveScreen() {
  const { data: drops, isLoading, error } = useArchivedDrops();

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
        <Text className="text-red-500 text-center">Не удалось загрузить архив</Text>
      </View>
    );
  }

  if (!drops || drops.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-gray-500 text-center">Архив пуст</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={drops}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View className="border-b-4 border-gray-100" />}
        renderItem={({ item }) => <DropCard drop={item} />}
      />
    </View>
  );
}

function DropCard({ drop }: { drop: ArchivedDrop }) {
  const { cellSize } = usePhotoGrid();

  const date = new Date(drop.scheduled_at).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Pressable onPress={() => router.push({ pathname: '/drop/[id]', params: { id: drop.id } })}>
      <View className="px-4 pt-3 pb-2">
        {drop.description ? (
          <Text className="text-sm font-medium text-gray-900" numberOfLines={2}>
            {drop.description}
          </Text>
        ) : null}
        <Text className="text-xs text-gray-400 mt-0.5">{date}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {drop.drop_items.map((item) => (
          <PhotoCell key={item.id} item={item} size={cellSize} />
        ))}
      </View>
    </Pressable>
  );
}

function PhotoCell({ item, size }: { item: ArchivedDropItem; size: number }) {
  const isSoldOut = item.product.stock_quantity === 0;
  const imageUrl = item.product.images[0]?.url;

  return (
    <View style={{ width: size, height: size }}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ width: size, height: size }} className="bg-gray-100" />
      )}
      {isSoldOut && (
        <View
          className="absolute bg-white/60"
          style={{ top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
    </View>
  );
}
