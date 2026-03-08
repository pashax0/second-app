import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { queryKeys } from '../../lib/queryKeys';
import { useAuthStore } from '../../stores/auth';

const profileSchema = z.object({
  name: z.string().min(1, 'Укажите имя'),
  phone: z.string().min(7, 'Укажите телефон'),
  address: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('name, phone, address')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function saveProfile(userId: string, form: ProfileForm) {
  const { error } = await supabase
    .from('profiles')
    .update({ name: form.name, phone: form.phone, address: form.address ?? null })
    .eq('id', userId);
  if (error) throw error;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: user ? () => fetchProfile(user.id) : undefined,
    enabled: !!user,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
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

  const { mutate: save, isPending: isSaving, isSuccess } = useMutation({
    mutationFn: (form: ProfileForm) => saveProfile(user!.id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() });
      reset(undefined, { keepValues: true });
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-6 py-6">
      <Text className="text-xs text-gray-400 mb-6">{user?.email}</Text>

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

      <Pressable
        className={`rounded-full py-3 items-center mb-3 ${isDirty ? 'bg-gray-900' : 'bg-gray-200'}`}
        disabled={!isDirty || isSaving}
        onPress={handleSubmit((form) => save(form))}
      >
        {isSaving ? (
          <ActivityIndicator color={isDirty ? 'white' : '#9ca3af'} />
        ) : (
          <Text className={`font-semibold ${isDirty ? 'text-white' : 'text-gray-400'}`}>
            {isSuccess && !isDirty ? 'Сохранено' : 'Сохранить'}
          </Text>
        )}
      </Pressable>

      <Pressable
        className="border border-gray-200 rounded-full py-3 items-center mb-3"
        onPress={() => router.push('/my-orders')}
      >
        <Text className="font-semibold text-gray-900">Мои заказы</Text>
      </Pressable>

      <Pressable
        className="py-3 items-center"
        onPress={signOut}
      >
        <Text className="text-red-500 font-semibold">Выйти</Text>
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
