import { ActivityIndicator, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import { useAuthStore } from '../stores/auth';

type OrderItem = {
  id: string;
  quantity: number;
  price_at_purchase: number;
  product: { name: string };
};

type Order = {
  id: string;
  status: string;
  delivery_address: string;
  created_at: string;
  order_items: OrderItem[];
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Ожидает',
  confirmed: 'Подтверждён',
  shipped: 'Отправлен',
  delivered: 'Доставлен',
  cancelled: 'Отменён',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

async function fetchMyOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      delivery_address,
      created_at,
      order_items (
        id,
        quantity,
        price_at_purchase,
        product:products ( name )
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as unknown as Order[];
}

export default function MyOrdersScreen() {
  const { user } = useAuthStore();

  const { data: orders, isLoading, error } = useQuery({
    queryKey: queryKeys.orders.my(),
    queryFn: user ? () => fetchMyOrders(user.id) : undefined,
    enabled: !!user,
  });

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
        <Text className="text-red-500 text-center">Не удалось загрузить заказы</Text>
      </View>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Заказов пока нет</Text>
        <Text className="text-gray-500 text-center">Здесь появятся ваши покупки</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <FlashList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <OrderCard order={item} />}
        ItemSeparatorComponent={() => <View className="h-px bg-gray-100 mx-4" />}
        contentContainerStyle={{ paddingVertical: 8 }}
      />
    </View>
  );
}

function OrderCard({ order }: { order: Order }) {
  const shortId = order.id.slice(0, 8).toUpperCase();
  const date = new Date(order.created_at).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
  const statusClass = STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-500';
  const statusLabel = STATUS_LABEL[order.status] ?? order.status;
  const total = order.order_items.reduce(
    (sum, item) => sum + item.price_at_purchase * item.quantity,
    0,
  );

  return (
    <View className="px-4 py-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs font-mono text-gray-400">{shortId}</Text>
        <View className={`rounded-full px-3 py-0.5 ${statusClass.split(' ')[0]}`}>
          <Text className={`text-xs font-medium ${statusClass.split(' ')[1]}`}>{statusLabel}</Text>
        </View>
      </View>

      {order.order_items.map((item) => (
        <Text key={item.id} className="text-sm text-gray-900 mb-0.5">
          {item.product.name}
          <Text className="text-gray-500">
            {'  '}
            {item.price_at_purchase.toLocaleString('ru-RU')} ₽
          </Text>
        </Text>
      ))}

      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-xs text-gray-400">{date}</Text>
        <Text className="text-sm font-bold text-gray-900">
          {total.toLocaleString('ru-RU')} ₽
        </Text>
      </View>
    </View>
  );
}
