# ADR-001: Mobile Framework

**Date:** 2026-03-07
**Status:** accepted

## Context

Нужно выбрать фреймворк для мобильного приложения под iOS и Android.
Ключевые требования: быстрый MVP, TypeScript, push-уведомления, AI-first разработка.

## Decision

**Expo (managed workflow) + React Native**

## Considered alternatives

| Option | Pros | Cons |
|---|---|---|
| Expo + React Native (chosen) | TypeScript-first, огромная экосистема, Expo SDK упрощает нативные фичи, OTA обновления через EAS, лучшая поддержка в LLM, Expo Router | Managed workflow ограничивает нативные модули (решается через bare workflow при необходимости) |
| Flutter | Отличная производительность, Dart-first | Dart менее распространён в AI обучении, меньше готовых интеграций с JS-экосистемой |
| Native Swift/Kotlin | Максимальная производительность, полный контроль | Две кодовые базы, медленный MVP, дороже |

## Consequences

- Используем Expo Router для навигации (file-based, типизированные маршруты)
- Expo Notifications для push (агрегирует FCM + APNs)
- Expo EAS для сборки и дистрибуции
- При необходимости нативных модулей — переход на bare workflow без смены кодовой базы

## Notes

- Expo SDK 51+ поддерживает New Architecture (Fabric + JSI) по умолчанию
- NativeWind v4 совместим с Expo Router
