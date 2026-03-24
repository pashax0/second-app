# Deploy — Mobile (EAS Build)

## Before answering any mobile deploy question

1. Fetch актуальную документацию:
   - EAS: `https://docs.expo.dev/llms-eas.txt`
   - SDK/пакеты (если вопрос про зависимости): `https://docs.expo.dev/llms-sdk.txt`
2. Проверь реальное состояние проекта: `apps/mobile/eas.json`, `apps/mobile/app.json`, `apps/mobile/package.json`
3. Только после этого — предлагай решение

## Scope

Это правило только для деплоя мобильного приложения (EAS Build, EAS Update, APK/AAB).
Деплой бекенда (Supabase) — отдельная задача, отдельные правила.

## Контекст проекта

- Конфиг: `docs/deploy.md`
- EAS аккаунт: `@pashax0`, free tier
- MCP (`mcp.expo.dev`) не активен на free tier — используй `llms-eas.txt`
