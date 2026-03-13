# Deploy

## Платформа

EAS Build (Expo Application Services)

- Аккаунт: `@pashax0` на expo.dev
- Project ID: `7dcf1856-1546-4e23-9922-12881ae35a1f`
- Android package: `com.pashax0.dailydropshop`
- Конфиг: `apps/mobile/eas.json`, `apps/mobile/app.json`

## Профили сборки

| Профиль | Назначение | Артефакт | Дистрибуция |
|---|---|---|---|
| `development` | Dev-клиент (замена Expo Go) | AAB | internal |
| `preview` | Тестирование на устройстве | APK | internal |
| `production` | Релиз | AAB | store |

## Команды

Все команды — из `apps/mobile/`.

```bash
# Тестовый APK
eas build --platform android --profile preview

# Dev-клиент
eas build --platform android --profile development

# OTA-обновление (без пересборки нативного кода)
eas update --branch preview --message "описание"
```

## Требования для сборки

- `pnpm-lock.yaml` должен быть закоммичен (EAS запускает `--frozen-lockfile`)
- Корневой `.npmrc` должен содержать `node-linker=hoisted` (совместимость pnpm + Expo autolinking)
- Android keystore хранится в облаке EAS (не локально)

## Что не настроено

- iOS (нет Apple Developer аккаунта)
- Google Play submit
- Push notifications (FCM/APNs ключи)
- CI/CD автозапуск

## Переменные окружения

### Корневой `/.env` (gitignored, только CLI)

```
SUPABASE_ACCESS_TOKEN=...   # авторизация Supabase CLI
SUPABASE_DB_PASSWORD=...    # пароль БД для db push / db pull
```

### `apps/mobile/.env` (gitignored, локальная разработка)

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<локальный anon key>
```

Локальный anon key: `pnpm supabase status` → `anon key`.

### `apps/mobile/.env.production` (в git, прод)

```
EXPO_PUBLIC_SUPABASE_URL=https://unpldsztqntzybvnaais.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<remote anon key>
```

`EXPO_PUBLIC_*` переменные встраиваются в бандл приложения — это намеренно, anon key не является секретом.

EAS Build автоматически использует `.env.production` для профилей `preview` и `production`.

### Деплой схемы БД

```bash
# Накатить новые миграции на remote
pnpm supabase db push
```

Всегда проверять миграцию локально (`pnpm supabase db reset`) перед push на remote.

## Expo MCP Server

Официальный MCP от Expo даёт Claude Code доступ к актуальным доксам, управлению сборками и автоматизации UI.

**Установка:**
```sh
claude mcp add --transport http expo-mcp https://mcp.expo.dev/mcp
```
После — `/mcp` в Claude Code для авторизации через Expo аккаунт.

**Что даёт:**
- Поиск по актуальной документации Expo/EAS SDK 55
- Запуск и мониторинг EAS Build из Claude Code
- UI автоматизация через локальный dev-сервер (SDK 54+)

**Ограничение:** требует платный EAS план.

**Без платного плана:** Expo публикует полную документацию в машиночитаемом формате:
- `https://docs.expo.dev/llms-full.txt` — полная дока (~1.9 MB)
- `https://docs.expo.dev/llms-eas.txt` — только EAS
- `https://docs.expo.dev/llms-sdk.txt` — только SDK
