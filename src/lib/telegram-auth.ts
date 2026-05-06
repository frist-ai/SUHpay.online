/**
 * Telegram WebApp Authentication
 *
 * Validates requests from Telegram WebApp using multiple verification methods:
 * 1. HMAC-SHA256 hash verification (legacy)
 * 2. Ed25519 signature verification (v9+)
 *
 * initData is generated once on app open and does NOT auto-refresh.
 * Auth data older than 24h is rejected to prevent replay attacks.
 */

import { env } from './env';
import crypto from 'crypto';

export type VerifyResult =
  | { ok: true; user: { id: number; [key: string]: unknown }; authDate: number; hash: string }
  | { ok: false; reason: string; debug?: Record<string, unknown> };

/**
 * Parse Telegram WebApp initData string into key-value pairs.
 * Values are kept AS-IS (URL-encoded) from the initData string.
 */
function parseInitData(initData: string): Map<string, string> {
  const params = new Map<string, string>();
  const pairs = initData.split('&');

  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      const key = pair.substring(0, eqIndex);
      const value = pair.substring(eqIndex + 1);
      params.set(key, value);
    }
  }

  return params;
}

/**
 * Build data-check-string from params.
 * Sort all key=value pairs alphabetically, excluding specified keys, join with \n.
 */
function buildDataCheckString(params: Map<string, string>, excludeKeys: Set<string>, decodeValues = false): string {
  const entries: string[] = [];
  for (const [key, value] of params.entries()) {
    if (!excludeKeys.has(key)) {
      const finalValue = decodeValues ? safeDecodeURIComponent(value) : value;
      entries.push(`${key}=${finalValue}`);
    }
  }
  return entries.sort().join('\n');
}

/**
 * Safely decode URI component, returning original value on error.
 */
function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Derive secret key from bot token.
 * Uses HMAC-SHA256 with "WebAppData" as key.
 */
function deriveSecretKey(botToken: string): Buffer {
  return crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
}

/**
 * Compute HMAC-SHA256 hash for a data-check-string.
 */
function computeHash(secretKey: Buffer, dataCheckString: string): string {
  return crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
}

/**
 * Verify Ed25519 signature (Telegram Web App v9+)
 * The signature is base64-encoded Ed25519 signature.
 */
function verifyEd25519Signature(params: Map<string, string>): boolean {
  const signature = params.get('signature');
  if (!signature) return false;

  try {
    // Build data-check-string without hash and signature
    const dcs = buildDataCheckString(params, new Set(['hash', 'signature']), true);

    // Decode base64 signature to buffer
    const signatureBuffer = Buffer.from(signature, 'base64');

    // Verify using Node.js crypto (Ed25519)
    // Telegram uses Ed25519ph (pre-hashed) variant
    const dataHash = crypto.createHash('sha512').update(dcs).digest();

    // For Node.js 18+, we can use crypto.verify with Ed25519
    // The public key format is specific to Telegram
    const publicKeyBytes = Buffer.from([
      0x5f, 0xab, 0xaf, 0xbb, 0x45, 0x3f, 0x74, 0xf4,
      0x7c, 0x8c, 0x21, 0xf0, 0xb7, 0xe0, 0x52, 0x26,
      0x36, 0x34, 0xdf, 0x1d, 0x0c, 0x40, 0x63, 0x6c,
      0x3b, 0x75, 0x8b, 0x81, 0x8f, 0x87, 0xc8, 0xa6
    ]);

    // Create Ed25519 public key object
    const publicKey = crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from('MCowBQYDK2VwAyEA', 'base64'), // Ed25519 OID + prefix
        publicKeyBytes
      ]),
      format: 'der',
      type: 'spki'
    });

    // Verify signature
    return crypto.verify(null, dataHash, publicKey, signatureBuffer);
  } catch (e) {
    console.error('[auth] Ed25519 verification error:', e);
    return false;
  }
}

/**
 * Verify Telegram WebApp initData signature.
 *
 * Tries multiple verification methods:
 * 1. Ed25519 signature verification (v9+)
 * 2. Multiple HMAC-SHA256 strategies for different Telegram versions
 *
 * @param initData - The initData string from Telegram WebApp
 * @param botToken - The bot token (optional, uses env.TELEGRAM_BOT_TOKEN if not provided)
 * @returns VerifyResult with ok=true and user data, or ok=false with reason + debug
 */
export function verifyTelegramWebAppData(
  initData: string,
  botToken?: string
): VerifyResult {
  // Clean the bot token
  const rawToken = botToken || env.telegramBotToken;
  const token = rawToken ? rawToken.trim().replace(/^\uFEFF/, '').replace(/\r?\n/g, '') : '';

  if (!token) {
    console.error('[auth] TELEGRAM_BOT_TOKEN not configured');
    return { ok: false, reason: 'BOT_TOKEN_NOT_CONFIGURED' };
  }

  if (!initData || initData.trim().length === 0) {
    console.error('[auth] Empty initData');
    return { ok: false, reason: 'NO_INIT_DATA' };
  }

  try {
    const params = parseInitData(initData);
    const hash = params.get('hash');
    const signature = params.get('signature');

    if (!hash) {
      console.error('[auth] No hash in initData');
      return { ok: false, reason: 'NO_HASH' };
    }

    // --- Strategy 0: Ed25519 signature verification (v9+) ---
    if (signature) {
      try {
        if (verifyEd25519Signature(params)) {
          console.log('[auth] Ed25519 signature verification succeeded');
          return verifyAfterHashMatch(params);
        }
      } catch (e) {
        console.error('[auth] Ed25519 verification failed:', e);
      }
    }

    const secretKey = deriveSecretKey(token);
    const hasSignature = !!signature;

    // Define all strategies to try
    const strategies: { name: string; dcs: string; excludeKeys: Set<string>; decode: boolean; separator: string }[] = [];

    // Strategy 1: Raw values, exclude hash only
    strategies.push({
      name: 'excludeHash_only',
      dcs: buildDataCheckString(params, new Set(['hash']), false),
      excludeKeys: new Set(['hash']),
      decode: false,
      separator: '\n'
    });

    // Strategy 2: Raw values, exclude hash + signature
    if (hasSignature) {
      strategies.push({
        name: 'excludeHashAndSignature',
        dcs: buildDataCheckString(params, new Set(['hash', 'signature']), false),
        excludeKeys: new Set(['hash', 'signature']),
        decode: false,
        separator: '\n'
      });
    }

    // Strategy 3: URL-decoded values, exclude hash + signature
    if (hasSignature) {
      strategies.push({
        name: 'decoded_excludeHashSig',
        dcs: buildDataCheckString(params, new Set(['hash', 'signature']), true),
        excludeKeys: new Set(['hash', 'signature']),
        decode: true,
        separator: '\n'
      });
    }

    // Strategy 4: URL-decoded values, exclude hash only
    strategies.push({
      name: 'decoded_excludeHash',
      dcs: buildDataCheckString(params, new Set(['hash']), true),
      excludeKeys: new Set(['hash']),
      decode: true,
      separator: '\n'
    });

    // Strategy 5: CRLF separator
    strategies.push({
      name: 'crlf_separator',
      dcs: buildDataCheckString(params, hasSignature ? new Set(['hash', 'signature']) : new Set(['hash']), false).replace(/\n/g, '\r\n'),
      excludeKeys: hasSignature ? new Set(['hash', 'signature']) : new Set(['hash']),
      decode: false,
      separator: '\r\n'
    });

    // Strategy 6: Preserve original order (not sorted)
    const origEntries: string[] = [];
    for (const [key, value] of params.entries()) {
      if (key !== 'hash' && key !== 'signature') {
        origEntries.push(`${key}=${value}`);
      }
    }
    strategies.push({
      name: 'original_order',
      dcs: origEntries.join('\n'),
      excludeKeys: new Set(['hash', 'signature']),
      decode: false,
      separator: '\n'
    });

    // Try each strategy
    const results: Record<string, { matched: boolean; hashPrefix: string }> = {};

    for (const strategy of strategies) {
      const computedHash = computeHash(secretKey, strategy.dcs);
      results[strategy.name] = {
        matched: computedHash === hash,
        hashPrefix: computedHash.substring(0, 20) + '...'
      };

      if (computedHash === hash) {
        console.log(`[auth] Strategy matched: ${strategy.name}`);
        return verifyAfterHashMatch(params);
      }
    }

    // --- ALL strategies failed — build comprehensive diagnostics ---
    let debugUser: { id?: number; first_name?: string; username?: string } | null = null;
    try {
      const rawUser = params.get('user');
      if (rawUser) debugUser = JSON.parse(safeDecodeURIComponent(rawUser));
    } catch { /* ignore */ }

    const authDateStr = params.get('auth_date');
    const authAge = authDateStr ? Math.round(Date.now() / 1000 - parseInt(authDateStr, 10)) : null;
    const tokenSha256 = crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);

    const debugInfo: Record<string, unknown> = {
      strategies: results,
      tokenPrefix: token.substring(0, 10) + '...',
      tokenLength: token.length,
      tokenSha256Prefix: tokenSha256 + '...',
      hasSignatureField: hasSignature,
      paramKeys: Array.from(params.keys()),
      authDate: authDateStr,
      authDateAge: authAge != null ? authAge + 's' : null,
      userId: debugUser?.id,
      username: debugUser?.username,
      receivedHash: hash.substring(0, 20) + '...',
      dataCheckStringLength: strategies[0]?.dcs.length,
    };

    console.error('[auth] All verification strategies failed — DIAGNOSTIC:', JSON.stringify(debugInfo, null, 2));

    // Verify bot token async
    verifyBotTokenAsync(token).then(botInfo => {
      console.error('[auth] Bot token verification result:', JSON.stringify(botInfo));
    });

    return { ok: false, reason: 'HASH_MISMATCH', debug: debugInfo };
  } catch (error) {
    console.error('[auth] Error verifying Telegram initData:', error);
    return { ok: false, reason: 'INTERNAL_ERROR' };
  }
}

/**
 * After a successful hash match, parse user data and check auth_date.
 */
function verifyAfterHashMatch(params: Map<string, string>): VerifyResult {
  const userStr = params.get('user');
  if (!userStr) {
    console.error('[auth] No user data in initData');
    return { ok: false, reason: 'NO_USER_DATA' };
  }

  let user: Record<string, unknown>;
  try {
    user = JSON.parse(safeDecodeURIComponent(userStr));
  } catch {
    console.error('[auth] Failed to parse user JSON');
    return { ok: false, reason: 'INVALID_USER_DATA' };
  }

  const authDateStr = params.get('auth_date');
  if (!authDateStr) {
    console.error('[auth] No auth_date in initData');
    return { ok: false, reason: 'NO_AUTH_DATE' };
  }

  const authDate = parseInt(authDateStr, 10);
  const ageSeconds = Date.now() / 1000 - authDate;

  if (isNaN(authDate)) {
    console.error('[auth] Invalid auth_date format', { authDate: authDateStr });
    return { ok: false, reason: 'INVALID_AUTH_DATE' };
  }

  if (ageSeconds > 86400) {
    console.error('[auth] auth_date too old (>24h), possible replay', { ageSeconds: Math.round(ageSeconds) });
    return { ok: false, reason: 'AUTH_DATE_EXPIRED' };
  }

  return {
    ok: true,
    user: user as { id: number; [key: string]: unknown },
    authDate,
    hash: params.get('hash') || '',
  };
}

/**
 * Verify bot token by calling Telegram getMe API (async, non-blocking).
 */
async function verifyBotTokenAsync(token: string): Promise<{ valid: boolean; botInfo?: Record<string, unknown> }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    if (data.ok) {
      return {
        valid: true,
        botInfo: {
          id: data.result.id,
          username: data.result.username,
          first_name: data.result.first_name,
        },
      };
    }
    return { valid: false, botInfo: { error: data.description } };
  } catch (e) {
    return { valid: false, botInfo: { error: String(e) } };
  }
}

/**
 * Extract user info from verified initData.
 */
export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export function extractUserFromInitData(initData: string): TelegramUser | null {
  const result = verifyTelegramWebAppData(initData);
  if (!result.ok) return null;
  return result.user as TelegramUser;
}

/**
 * Check if request is from Telegram WebApp by verifying initData.
 */
export function verifyTelegramRequest(initData: string): {
  valid: boolean;
  user: TelegramUser | null;
  error?: string;
} {
  if (!initData) {
    return { valid: false, user: null, error: 'No initData provided' };
  }
  const result = verifyTelegramWebAppData(initData);
  if (!result.ok) {
    return { valid: false, user: null, error: result.reason };
  }
  return { valid: true, user: result.user as TelegramUser };
}

/**
 * Verify admin access with Telegram signature.
 */
export function verifyAdminAccess(initData: string): {
  valid: boolean;
  isAdmin: boolean;
  user: TelegramUser | null;
  error?: string;
} {
  const result = verifyTelegramRequest(initData);
  if (!result.valid) {
    return { ...result, isAdmin: false };
  }
  const isAdmin = result.user ? env.isAdmin(result.user.id) : false;
  return { valid: true, isAdmin, user: result.user };
}
