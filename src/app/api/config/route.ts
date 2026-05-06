import { NextResponse } from 'next/server';
import { env } from '@/lib/env';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

// App version - update this when releasing new version
const APP_VERSION = '0.6.05.26';
const DEPLOY_ID = `deploy-${Date.now()}`;

/**
 * GET /api/config - Get current configuration status
 * Returns configuration status without exposing sensitive data
 */
export async function GET() {
  const { isValid, errors, hasBotToken, adminIds } = env.validate();
  
  const responseBody = {
    status: isValid ? 'ok' : 'error',
    version: APP_VERSION,
    deployId: DEPLOY_ID,
    buildTime: new Date().toISOString(),
    timestamp: Date.now(),
    serverTime: new Date().toUTCString(),
    config: {
      database: {
        configured: !!env.databaseUrl,
        type: env.databaseUrl?.startsWith('file:') ? 'sqlite' : 'postgresql',
      },
      telegramBot: {
        configured: hasBotToken,
        webhookSecret: !!process.env.TELEGRAM_WEBHOOK_SECRET,
      },
      admin: {
        configured: adminIds.length > 0,
        count: adminIds.length,
      },
      devMode: env.isDevMode,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
  
  const response = NextResponse.json(responseBody);
  
  // Aggressive no-cache headers for Vercel
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Surrogate-Control', 'no-store');
  response.headers.set('CDN-Cache-Control', 'no-store');
  response.headers.set('Vercel-CDN-Cache-Control', 'no-store');
  response.headers.set('X-App-Version', APP_VERSION);
  response.headers.set('X-Deploy-Id', DEPLOY_ID);
  
  return response;
}
