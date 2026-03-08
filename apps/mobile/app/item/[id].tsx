import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, Text, useWindowDimensions, View, ViewToken } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useActiveDrop, type DropItem, type Measurements } from '../../hooks/useActiveDrop';

function formatMeasurements(m: Measurements | null): string {
  if (!m) return '';
  const parts: string[] = [];
  if (m.chest) parts.push(`ПОГ ${m.chest}`);
  if (m.waist) parts.push(`ПОТ ${m.waist}`);
  if (m.hips) parts.push(`ПОБ ${m.hips}`);
  if (m.length) parts.push(`дл. ${m.length}`);
  return parts.join(' · ');
}

export default function ItemScreen() {
  const { index } = useLocalSearchParams<{ index: string }>();
  const { width } = useWindowDimensions();
  const { data: drop } = useActiveDrop();
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
            <ItemCard item={item} dropId={drop.id} width={width} position={i + 1} total={total} />
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
}: {
  item: DropItem;
  dropId: string;
  width: number;
  position: number;
  total: number;
}) {
  const { product, override_price } = item;
  const displayPrice = override_price ?? product.price;
  const isSoldOut = product.stock_quantity === 0;
  const measurements = formatMeasurements(product.measurements);

  return (
    <View style={{ width }} className="flex-1">
      {/* Photo placeholder */}
      <View
        className="bg-gray-100 items-center justify-center"
        style={{ width, aspectRatio: 1 }}
      >
        <Text className="text-gray-400">Фото</Text>
      </View>

      {/* Info */}
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

          {isSoldOut ? (
            <View className="bg-gray-100 rounded-full px-6 py-3">
              <Text className="text-sm font-semibold text-gray-400">Продано</Text>
            </View>
          ) : (
            <Pressable
              className="bg-gray-900 rounded-full px-6 py-3"
              onPress={() =>
                router.push({
                  pathname: '/checkout',
                  params: { dropId, productId: product.id },
                })
              }
            >
              <Text className="text-sm font-semibold text-white">Купить</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
