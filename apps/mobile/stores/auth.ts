import { create } from 'zustand'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAnonymous: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInAnonymously: () => Promise<void>
  // Converts anonymous account to a real one, preserving reservations
  upgradeToFullAccount: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isAnonymous: false,

  signIn: async (email, password) => {
    // Capture anonymous user_id before signing in so we can transfer their reservations
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    const anonUserId = currentSession?.user?.is_anonymous ? currentSession.user.id : null

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    // Transfer non-expired reservations from the anonymous session to the real account
    if (anonUserId) {
      await supabase.rpc('transfer_reservations', { anon_user_id: anonUserId })
    }
  },

  signUp: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  },

  signInAnonymously: async () => {
    // No-op if already has a session (anon or real)
    if (get().user) return
    const { error } = await supabase.auth.signInAnonymously()
    if (error) throw error
  },

  upgradeToFullAccount: async (email, password) => {
    // Converts the current anonymous account to a real one.
    // Same user_id is preserved → reservations carry over automatically.
    const { error } = await supabase.auth.updateUser({ email, password })
    if (error) throw error
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  initialize: () => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({
        session,
        user: session?.user ?? null,
        isAnonymous: session?.user?.is_anonymous ?? false,
        isLoading: false,
      })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        isAnonymous: session?.user?.is_anonymous ?? false,
        isLoading: false,
      })
    })

    return () => subscription.unsubscribe()
  },
}))
