import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useArchivedDrops, type ArchivedDrop } from '../../hooks/useDrop';

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
        ItemSeparatorComponent={() => <View className="border-b border-gray-100" />}
        renderItem={({ item }) => <DropRow drop={item} />}
      />
    </View>
  );
}

function DropRow({ drop }: { drop: ArchivedDrop }) {
  const date = new Date(drop.scheduled_at).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Pressable
      className="px-4 py-4 active:bg-gray-50"
      onPress={() => router.push({ pathname: '/drop/[id]', params: { id: drop.id } })}
    >
      <Text className="text-base font-semibold text-gray-900">
        {drop.title ?? 'Дроп'}
      </Text>
      <Text className="text-sm text-gray-400 mt-0.5">{date}</Text>
      {drop.description ? (
        <Text className="text-sm text-gray-500 mt-1" numberOfLines={1}>
          {drop.description}
        </Text>
      ) : null}
    </Pressable>
  );
}
