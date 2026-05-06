---
Task ID: 1
Agent: main
Task: Transform SUHpay.online from Telegram-only Mini App to full e-commerce website

Work Log:
- Analyzed existing project structure: Telegram-only Mini App with rich e-commerce backend
- Updated Prisma schema: made telegramId nullable, added phone @unique, passwordHash, authType fields to User; created WebSession model
- Pushed schema to database with `bunx prisma db push`
- Created password utility: scrypt-based hashing, admin credentials check
- Created auth API routes:
  - /api/auth/web/register - phone+password registration with session cookie
  - /api/auth/web/login - login with admin credential detection (+79114872320 / 09Izagig$)
  - /api/auth/web/logout - session cleanup
  - /api/auth/web/session - session restoration check
- Rewrote auth-helpers.ts: dual auth support (Telegram HMAC + web session cookie)
- Updated shop-store.ts: made telegramId nullable in User type, added authMethod state
- Created AuthView component with login/register forms
- Rewrote page.tsx initialization flow: check web session → check Telegram → show auth screen
- Updated profile-view.tsx: web logout button, handleSave works without telegramId
- Updated layout.tsx: SEO metadata for web version
- Added responsive desktop layout: phone-frame centered design with max-w-lg
- 0 ESLint errors

Stage Summary:
- Project now works as standalone web store accessible from any browser
- Web users can register/login with phone + password
- Admin access: Telegram IDs (467790487, 367984633) OR login credentials (+79114872320 / 09Izagig$)
- Desktop: app shown in centered phone frame; Mobile: full screen as before
- Telegram Mini App integration preserved
