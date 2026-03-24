# Deploy

## Платформа

EAS Build (Expo Application Services)

- Аккаунт: `@pashax0` на expo.dev
- Project ID: `7dcf1856-1546-4e23-9922-12881ae35a1f`
- Android package: `com.pashax0.dailydropshop`
- Конфиг: `apps/mobile/eas.json`, `apps/mobile/app.json`

## Supabase (продакшн)

- Project ref: `unpldsztqntzybvnaais`
- URL: `https://unpldsztqntzybvnaais.supabase.co`
- Уже слинкован: `supabase/.temp/project-ref`

## Профили сборки

| Профиль | Назначение | Артефакт | Дистрибуция |
|---|---|---|---|
| `development` | Dev-клиент (замена Expo Go) | AAB | internal |
| `preview` | Фокус-группа / тест на устройстве | APK | internal |
| `production` | Релиз в магазин | AAB | store |

## Фокус-группа: процесс запуска

Полный цикл от нуля до APK в руках тестировщика.

### 1. Накатить схему БД на прод

```bash
pnpm supabase db push
```

Всегда проверять локально (`pnpm supabase db reset`) перед push.

### 2. Добавить товары в прод через admin app

Admin app переключается на продакшн через `--mode production`:

```bash
pnpm --filter admin dev -- --mode production
```

Vite автоматически загружает `apps/admin/.env.production` вместо `.env`.
Открываешь `http://localhost:5173` — admin подключён к продакшн Supabase.
Создаёшь товары, загружаешь фото — всё попадает сразу в прод.

### 3. Собрать APK

```bash
cd apps/mobile
eas build --platform android --profile preview
```

EAS использует `apps/mobile/.env.production` — билд автоматически смотрит на продакшн Supabase.
Ссылка на скачивание появится на [expo.dev](https://expo.dev) в разделе Builds.

### 4. Раздать тестировщикам

- Поделиться ссылкой с expo.dev (QR или прямая ссылка)
- Или скачать APK и отправить вручную
- Тестировщики регистрируются сами в приложении

### OTA-обновление (без пересборки)

Если изменился только JS-код (не нативные модули):

```bash
cd apps/mobile
eas update --branch preview --message "что изменилось"
```

Приложение подтянет обновление при следующем запуске. Пересылать APK не нужно.

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

Локальный anon key: `pnpm supabase status` → `ANON_KEY`.

### `apps/mobile/.env.production` (в git, прод)

```
EXPO_PUBLIC_SUPABASE_URL=https://unpldsztqntzybvnaais.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

`EXPO_PUBLIC_*` встраиваются в бандл — это нормально, anon key не секрет.
EAS Build автоматически использует `.env.production` для профилей `preview` и `production`.

### `apps/admin/.env` (gitignored, локальная разработка)

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<локальный anon key>
```

### `apps/admin/.env.production` (в git, прод)

```
VITE_SUPABASE_URL=https://unpldsztqntzybvnaais.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Используется только локально через `pnpm --filter admin dev -- --mode production`.
Admin app не деплоится на хостинг — запускается только локально для управления данными.

## Требования для сборки EAS

- `pnpm-lock.yaml` должен быть закоммичен (EAS запускает `--frozen-lockfile`)
- Корневой `.npmrc` должен содержать `node-linker=hoisted` (совместимость pnpm + Expo autolinking)
- Android keystore хранится в облаке EAS (не локально)

## Что не настроено

- iOS (нет Apple Developer аккаунта)
- Google Play submit
- Push notifications (FCM/APNs ключи)
- CI/CD автозапуск

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
