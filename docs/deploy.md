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
