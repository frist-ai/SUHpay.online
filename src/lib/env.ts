/**
 * Environment Configuration
 * 
 * Required environment variables:
 * - TELEGRAM_BOT_TOKEN: Telegram Bot Token for API calls
 * - ADMIN_TELEGRAM_IDS: Comma-separated list of admin Telegram IDs
 * - DATABASE_URL: Database connection URL (SQLite file path or PostgreSQL URL)
 * - TELEGRAM_WEBHOOK_SECRET: Secret token for Telegram webhook verification (optional but recommended)
 */

// Validate required environment variables
function validateEnv() {
  const errors: string[] = [];
  
  // DATABASE_URL validation
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }
  
  // ADMIN_TELEGRAM_IDS validation
  const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
  
  if (adminIds.length === 0) {
    errors.push('ADMIN_TELEGRAM_IDS is required (comma-separated Telegram user IDs)');
  }
  
  // TELEGRAM_BOT_TOKEN is optional for basic functionality
  // but required for bot features
  const hasBotToken = !!process.env.TELEGRAM_BOT_TOKEN;
  
  return {
    isValid: errors.length === 0,
    errors,
    hasBotToken,
    adminIds,
  };
}

// Get environment variables with type safety
export const env = {
  // Database
  get databaseUrl(): string {
    return process.env.DATABASE_URL || '';
  },
  
  // Telegram Bot
  get telegramBotToken(): string | undefined {
    return process.env.TELEGRAM_BOT_TOKEN;
  },

  // Telegram Webhook Secret
  get telegramWebhookSecret(): string | undefined {
    return process.env.TELEGRAM_WEBHOOK_SECRET;
  },

  get isWebhookSecretConfigured(): boolean {
    return !!process.env.TELEGRAM_WEBHOOK_SECRET;
  },
  
  get isBotConfigured(): boolean {
    return !!process.env.TELEGRAM_BOT_TOKEN;
  },
  
  // Admin IDs
  get adminTelegramIds(): string[] {
    return (process.env.ADMIN_TELEGRAM_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean);
  },
  
  get hasAdminIds(): boolean {
    return this.adminTelegramIds.length > 0;
  },
  
  // Dev mode
  get isDevMode(): boolean {
    return process.env.NEXT_PUBLIC_DEV_MODE === 'true' || process.env.NODE_ENV === 'development';
  },
  
  // Node environment
  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  },
  
  // Validation
  validate: validateEnv,
  
  // Check if admin by Telegram ID
  isAdmin(telegramId: string | number): boolean {
    return this.adminTelegramIds.includes(telegramId.toString());
  },
} as const;

// Log configuration status on startup (server-side only)
if (typeof window === 'undefined') {
  const { isValid, errors, hasBotToken, adminIds } = validateEnv();
  
  if (!isValid) {
    console.error('❌ Environment configuration errors:');
    errors.forEach(err => console.error(`   - ${err}`));
  } else {
    // Environment configured correctly
  }
}
