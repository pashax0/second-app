import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useActiveDrop, type DropItem } from '../../hooks/useActiveDrop';

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
        <Text className="text-gray-500 text-center">Следите за уведомлениями — следующий дроп скоро</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScrollView contentContainerClassName="pb-8">
        <View className="px-4 pt-6 pb-4">
          <Text className="text-2xl font-bold text-gray-900">{drop.title ?? 'Дроп'}</Text>
          <Text className="text-sm text-gray-500 mt-1">
            {new Date(drop.scheduled_at).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        <FlashList
          data={drop.drop_items}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => <DropItemCard item={item} />}
          ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-4" />}
        />
      </ScrollView>
    </View>
  );
}

function DropItemCard({ item }: { item: DropItem }) {
  const { product, override_price } = item;
  const displayPrice = override_price ?? product.price;
  const isSoldOut = product.stock_quantity === 0;

  return (
    <View className={`px-4 py-4 ${isSoldOut ? 'opacity-50' : ''}`}>
      {/* Image placeholder */}
      <View className="w-full h-48 bg-gray-100 rounded-xl mb-3 items-center justify-center">
        <Text className="text-gray-400 text-sm">Фото</Text>
      </View>

      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold text-gray-900">{product.name}</Text>
          {product.description ? (
            <Text className="text-sm text-gray-500 mt-1" numberOfLines={2}>
              {product.description}
            </Text>
          ) : null}
        </View>

        <View className="items-end">
          {override_price !== null && (
            <Text className="text-xs text-gray-400 line-through">
              {product.price.toLocaleString('ru-RU')} ₽
            </Text>
          )}
          <Text className="text-lg font-bold text-gray-900">
            {displayPrice.toLocaleString('ru-RU')} ₽
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between mt-3">
        {isSoldOut ? (
          <View className="bg-gray-200 rounded-full px-3 py-1">
            <Text className="text-xs font-medium text-gray-600">Распродано</Text>
          </View>
        ) : (
          <Text className="text-xs text-gray-500">Осталось: {product.stock_quantity} шт.</Text>
        )}

        <Pressable
          disabled={isSoldOut}
          className={`px-5 py-2 rounded-full ${isSoldOut ? 'bg-gray-200' : 'bg-gray-900'}`}
        >
          <Text className={`text-sm font-semibold ${isSoldOut ? 'text-gray-400' : 'text-white'}`}>
            {isSoldOut ? 'Нет в наличии' : 'Купить'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
