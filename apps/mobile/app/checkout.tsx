import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { queryKeys } from '../lib/queryKeys';
import { useAuthStore } from '../stores/auth';

const checkoutSchema = z.object({
  name: z.string().min(1, 'Укажите имя'),
  phone: z.string().min(7, 'Укажите телефон'),
  address: z.string().min(5, 'Укажите адрес доставки'),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('name, phone, address')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function createOrder(params: {
  dropId: string;
  productId: string;
  deliveryAddress: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_order', {
    p_drop_id: params.dropId,
    p_product_id: params.productId,
    p_delivery_address: params.deliveryAddress,
  });
  if (error) throw error;
  return data as string;
}

export default function CheckoutScreen() {
  const { dropId, productId } = useLocalSearchParams<{ dropId: string; productId: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [orderId, setOrderId] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: user ? () => fetchProfile(user.id) : undefined,
    enabled: !!user,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { name: '', phone: '', address: '' },
  });

  useEffect(() => {
    if (profile) {
      reset({
        name: profile.name ?? '',
        phone: profile.phone ?? '',
        address: profile.address ?? '',
      });
    }
  }, [profile]);

  const { mutate, isPending, error: mutationError } = useMutation({
    mutationFn: (form: CheckoutForm) =>
      createOrder({
        dropId,
        productId,
        deliveryAddress: `${form.name}\n${form.phone}\n${form.address}`,
      }),
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drops.active() });
      setOrderId(id);
    },
  });

  if (orderId) {
    return <OrderSuccess orderId={orderId} />;
  }

  const errorMessage = mutationError
    ? mutationError.message.includes('out_of_stock')
      ? 'Товар уже забрали — успели быстрее 😔'
      : 'Что-то пошло не так. Попробуйте ещё раз.'
    : null;

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-6 py-6">
      <Text className="text-lg font-bold text-gray-900 mb-6">Получатель и адрес</Text>

      <Field label="Имя" error={errors.name?.message}>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
              placeholder="Ваше имя"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              autoCapitalize="words"
            />
          )}
        />
      </Field>

      <Field label="Телефон" error={errors.phone?.message}>
        <Controller
          control={control}
          name="phone"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
              placeholder="+7 900 000-00-00"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              keyboardType="phone-pad"
            />
          )}
        />
      </Field>

      <Field label="Адрес доставки" error={errors.address?.message}>
        <Controller
          control={control}
          name="address"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900"
              placeholder="Город, улица, дом, квартира"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          )}
        />
      </Field>

      {errorMessage && (
        <Text className="text-red-500 text-sm mb-4 text-center">{errorMessage}</Text>
      )}

      <Text className="text-xs text-gray-400 text-center mb-6">
        Оплата при получении. Мы свяжемся с вами для подтверждения.
      </Text>

      <Pressable
        className="bg-gray-900 rounded-full py-4 items-center"
        disabled={isPending}
        onPress={handleSubmit((form) => mutate(form))}
      >
        {isPending ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-semibold text-base">Оформить заказ</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      {children}
      {error && <Text className="text-red-500 text-xs mt-1">{error}</Text>}
    </View>
  );
}

function OrderSuccess({ orderId }: { orderId: string }) {
  const shortId = orderId.slice(0, 8).toUpperCase();

  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <Text className="text-4xl mb-4">🎉</Text>
      <Text className="text-2xl font-bold text-gray-900 mb-2">Заказ принят!</Text>
      <Text className="text-gray-500 text-center mb-6">
        Мы свяжемся с вами по телефону для подтверждения и уточнения деталей доставки.
      </Text>
      <View className="bg-gray-100 rounded-xl px-6 py-4 mb-8 items-center">
        <Text className="text-xs text-gray-400 mb-1">Номер заказа</Text>
        <Text className="text-lg font-bold text-gray-900 font-mono">{shortId}</Text>
        <Text className="text-xs text-gray-400 mt-1">Ожидает подтверждения</Text>
      </View>
      <Pressable
        className="bg-gray-900 rounded-full px-8 py-3"
        onPress={() => router.back()}
      >
        <Text className="text-white font-semibold">Закрыть</Text>
      </Pressable>
    </View>
  );
}
