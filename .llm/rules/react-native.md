---
description: React Native and Expo specific rules and conventions.
alwaysApply: false
globs: ["apps/mobile/**/*.ts", "apps/mobile/**/*.tsx"]
paths:
  - "apps/mobile/**/*.ts"
  - "apps/mobile/**/*.tsx"
---

# React Native / Expo

## Project setup

- Runtime: Expo SDK (managed workflow)
- Navigation: Expo Router (file-based, `app/` directory)
- Styling: NativeWind (Tailwind CSS for React Native)
- Server state: TanStack Query
- Client state: Zustand
- Forms: React Hook Form + Zod
- Backend: Supabase JS client

## Components

- Functional components only, no class components
- Props interface named `<ComponentName>Props`
- Co-locate component, styles, and tests in same directory
- Prefer React Native core components (`View`, `Text`, `Pressable`) over third-party wrappers
- Use `Pressable` instead of `TouchableOpacity`

## Navigation (Expo Router)

- File-based routing in `app/` directory
- `app/(tabs)/` for tab navigation
- `app/(auth)/` for auth screens
- Layouts in `_layout.tsx`
- Type-safe navigation with `expo-router` typed routes

## Styling (NativeWind)

- Use Tailwind classes via `className` prop
- Platform-specific styles: `Platform.select()` or `ios:` / `android:` prefixes
- No inline styles unless dynamic values require it

## Data fetching

- All server state via TanStack Query (`useQuery`, `useMutation`)
- Supabase client initialized once in `lib/supabase.ts`
- Query keys in a central `queryKeys.ts` file

## Performance

- Use `FlashList` (from `@shopify/flash-list`) for long lists, not `FlatList`
- Memoize only when there is a measured performance problem
- Avoid anonymous functions in JSX props on frequently re-rendering components

## Push notifications

- Expo Notifications SDK for both FCM (Android) and APNs (iOS)
- Register device token on auth, store in Supabase `profiles` table
- Handle notification press in root `_layout.tsx`
