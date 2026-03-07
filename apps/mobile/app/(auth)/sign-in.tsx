import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'expo-router'
import { useAuthStore } from '../../stores/auth'

const schema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
})

type FormData = z.infer<typeof schema>

export default function SignInScreen() {
  const signIn = useAuthStore((s) => s.signIn)
  const [error, setError] = useState<string | null>(null)

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: FormData) => {
    try {
      setError(null)
      await signIn(data.email, data.password)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка входа')
    }
  }

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-2xl font-bold mb-8 text-center">Вход</Text>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 mb-1"
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.email && <Text className="text-red-500 text-sm mb-3">{errors.email.message}</Text>}

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value } }) => (
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 mb-1 mt-2"
            placeholder="Пароль"
            secureTextEntry
            onChangeText={onChange}
            value={value}
          />
        )}
      />
      {errors.password && <Text className="text-red-500 text-sm mb-3">{errors.password.message}</Text>}

      {error && <Text className="text-red-500 text-sm mb-3 text-center">{error}</Text>}

      <Pressable
        className="bg-black rounded-lg py-4 mt-4"
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
      >
        {isSubmitting
          ? <ActivityIndicator color="white" />
          : <Text className="text-white text-center font-semibold text-base">Войти</Text>
        }
      </Pressable>

      <Link href="/(auth)/sign-up" asChild>
        <Pressable className="mt-6">
          <Text className="text-center text-gray-500">Нет аккаунта? <Text className="text-black font-semibold">Зарегистрироваться</Text></Text>
        </Pressable>
      </Link>
    </View>
  )
}
