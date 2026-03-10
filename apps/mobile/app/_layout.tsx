import '../global.css'
import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '../stores/auth'

const queryClient = new QueryClient()

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, initialize } = useAuthStore()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = initialize()
    return unsubscribe
  }, [])

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(auth)'
    const isAnonymous = user?.is_anonymous ?? false

    // Redirect real (non-anonymous) authenticated users away from auth screens
    if (user && !isAnonymous && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [user, isLoading, segments])

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="checkout" options={{ presentation: 'modal', title: 'Оформление заказа' }} />
          <Stack.Screen name="my-orders" options={{ title: 'Мои заказы' }} />
          <Stack.Screen name="item/[id]" options={{ title: '' }} />
        </Stack>
      </AuthGate>
    </QueryClientProvider>
  )
}
