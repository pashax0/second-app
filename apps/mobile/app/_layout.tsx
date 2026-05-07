import '../global.css'
import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { useAuthStore } from '../stores/auth'
import { SnackbarProvider, toast } from '../lib/snackbar'
import { formatError, isStaleSessionError } from '../lib/errors'
import { supabase } from '../lib/supabase'

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: { silent?: boolean; userMessage?: string }
    mutationMeta: { silent?: boolean; userMessage?: string }
  }
}

type Meta = { silent?: boolean; userMessage?: string } | undefined

// Stale-session always toasts and triggers signOut, regardless of meta.silent —
// otherwise the user is left guessing why a screen with inline error UI silently
// refuses to load. Other errors respect meta.silent.
function reportError(error: unknown, meta: Meta) {
  if (isStaleSessionError(error)) {
    void supabase.auth.signOut()
    toast.show(formatError(error))
    return
  }
  if (meta?.silent) return
  toast.show(meta?.userMessage ?? formatError(error))
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => reportError(error, query.meta),
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => reportError(error, mutation.meta),
  }),
})

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
      <SnackbarProvider>
      <AuthGate>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="checkout" options={{ presentation: 'modal', title: 'Оформление заказа' }} />
          <Stack.Screen name="my-orders" options={{ title: 'Мои заказы' }} />
          <Stack.Screen name="item/[id]" options={{ title: '' }} />
        </Stack>
      </AuthGate>
      </SnackbarProvider>
    </QueryClientProvider>
  )
}
