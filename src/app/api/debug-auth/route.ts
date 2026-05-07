import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { verifyAdmin } from '@/lib/auth-helpers';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * GET /api/debug-auth
 *
 * Diagnostic endpoint for Telegram HMAC verification.
 * ONLY available in development mode. Requires admin authentication.
 * Returns detailed info about bot token, initData, and hash verification.
 */
export async function GET(request: NextRequest) {
  // Security: Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is disabled in production' },
      { status: 403 }
    );
  }

  // Security: Require admin authentication
  const { user: adminUser, error: authError } = await verifyAdmin(request);
  if (authError) return authError;
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const headerData = request.headers.get('x-telegram-init-data');
  const queryData = request.nextUrl.searchParams.get('initData');
  const initData = headerData || queryData;

  // Bot token info (safe — only prefix/length, never the full token)
  const botToken = env.telegramBotToken;
  const tokenPrefix = botToken ? botToken.substring(0, 8) + '...' : 'NOT SET';
  const tokenLength = botToken ? botToken.length : 0;

  // Check if token is valid by calling Telegram Bot API
  let botInfo: Record<string, unknown> | null = null;
  let tokenValid = false;
  if (botToken) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      botInfo = await res.json() as Record<string, unknown>;
      tokenValid = botInfo.ok as boolean;
    } catch (e) {
      botInfo = { error: String(e) };
    }
  }

  // If initData is present, run full HMAC verification with diagnostics
  let verifyResult: Record<string, unknown> | null = null;

  if (initData && botToken) {
    try {
      const params = new Map<string, string>();
      const pairs = initData.split('&');
      for (const pair of pairs) {
        const [key, ...valueParts] = pair.split('=');
        if (key) {
          params.set(key, valueParts.join('='));
        }
      }

      const hash = params.get('hash');
      const user = params.get('user');
      const authDate = params.get('auth_date');

      // Build data-check string per Telegram docs (exclude 'hash' and 'signature')
      const entries: string[] = [];
      for (const [key, value] of params.entries()) {
        if (key !== 'hash' && key !== 'signature') {
          entries.push(`${key}=${value}`);
        }
      }
      const dataCheckString = entries.sort().join('\n');

      // Derive secret key: HMAC-SHA256(key="WebAppData", data=bot_token)
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      // Compute expected hash: HMAC-SHA256(key=secretKey, data=dataCheckString)
      const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      // Parse user for diagnostics
      let parsedUser: Record<string, unknown> | null = null;
      if (user) {
        try {
          parsedUser = JSON.parse(decodeURIComponent(user));
        } catch {
          parsedUser = { parseError: true };
        }
      }

      verifyResult = {
        hashMatch: hash === expectedHash,
        receivedHashPrefix: hash?.substring(0, 16) + '...',
        expectedHashPrefix: expectedHash.substring(0, 16) + '...',
        paramKeys: Array.from(params.keys()),
        authDate,
        authDateAge: authDate ? Math.round(Date.now() / 1000 - parseInt(authDate, 10)) + 's ago' : null,
        user: parsedUser ? { id: parsedUser.id, first_name: parsedUser.first_name } : null,
        initDataLength: initData.length,
        dataCheckStringLength: dataCheckString.length,
        dataCheckStringPrefix: dataCheckString.substring(0, 200),
        secretKeyDerived: true,
      };
    } catch (e) {
      verifyResult = { error: String(e) };
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    botToken: {
      configured: !!botToken,
      prefix: tokenPrefix,
      length: tokenLength,
      valid: tokenValid,
      botInfo: tokenValid ? {
        id: (botInfo?.result as Record<string, unknown>)?.id,
        username: (botInfo?.result as Record<string, unknown>)?.username,
        first_name: (botInfo?.result as Record<string, unknown>)?.first_name,
      } : botInfo,
    },
    initData: {
      source: headerData ? 'header' : queryData ? 'query' : 'none',
      present: !!initData,
      length: initData?.length || 0,
    },
    verifyResult,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      vercel: process.env.VERCEL || 'not vercel',
      platform: process.platform,
    },
  });
}
