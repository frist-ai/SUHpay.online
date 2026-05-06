import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash, createHmac } from 'crypto';

export const dynamic = 'force-dynamic';

// ADMIN_IDS from environment
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

/**
 * Validate Telegram Login Widget data
 * https://core.telegram.org/widgets/login#checking-authorization
 */
function validateTelegramWidgetData(data: {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
}, botToken: string): { 
  valid: boolean;
  error?: string;
} {
  try {
    const { hash, ...fields } = data;
    
    if (!hash) {
      return { valid: false, error: 'Missing hash' };
    }

    // Check auth_date (max 24 hours old)
    const authDate = parseInt(data.auth_date, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const maxAge = 86400; // 24 hours
    
    if (currentTime - authDate > maxAge) {
      return { valid: false, error: 'Auth data expired' };
    }

    // Create data-check-string (sorted alphabetically)
    const dataCheckString = Object.entries(fields)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Calculate secret key: SHA256(botToken)
    const secretKey = createHash('sha256')
      .update(botToken)
      .digest();

    // Calculate hash: HMAC-SHA256(secretKey, dataCheckString)
    const calculatedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Compare hashes
    if (calculatedHash !== hash) {
      console.error('Hash mismatch:', { calculated: calculatedHash, provided: hash });
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true };
  } catch (error) {
    console.error('Validation error:', error);
    return { valid: false, error: 'Validation failed' };
  }
}

/**
 * Check if telegramId is admin
 */
function isAdmin(telegramId: string): boolean {
  return ADMIN_IDS.includes(telegramId);
}

/**
 * POST /api/auth/widget - Authenticate via Telegram Login Widget
 */
export async function POST(request: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      return NextResponse.json(
        { authenticated: false, error: 'Bot not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = body;

    if (!id || !auth_date || !hash) {
      return NextResponse.json(
        { authenticated: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate signature
    const validation = validateTelegramWidgetData({
      id,
      first_name,
      last_name,
      username,
      photo_url,
      auth_date,
      hash,
    }, botToken);

    if (!validation.valid) {
      console.warn('Widget auth failed:', validation.error);
      return NextResponse.json(
        { authenticated: false, error: validation.error },
        { status: 401 }
      );
    }

    const telegramId = id.toString();
    const shouldBeAdmin = isAdmin(telegramId);

    // Check database
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        authenticated: true,
        user: {
          id: `user-${telegramId}`,
          telegramId,
          username: username || null,
          firstName: first_name || null,
          lastName: last_name || null,
          photoUrl: photo_url || null,
          languageCode: 'ru',
          role: shouldBeAdmin ? 'admin' : 'customer',
          loyaltyPoints: 100,
          isActive: true,
        },
      });
    }

    // Get or create user in database
    const existingUser = await db.user.findUnique({
      where: { telegramId },
    });

    let user;

    if (existingUser) {
      // Update user
      user = await db.user.update({
        where: { telegramId },
        data: {
          username: username || existingUser.username,
          firstName: first_name || existingUser.firstName,
          lastName: last_name || existingUser.lastName,
          photoUrl: photo_url || existingUser.photoUrl,
          role: shouldBeAdmin ? 'admin' : 'customer',
          lastVisitAt: new Date(),
          isActive: true,
        },
      });
    } else {
      // Create new user
      user = await db.user.create({
        data: {
          telegramId,
          username: username || null,
          firstName: first_name || null,
          lastName: last_name || null,
          photoUrl: photo_url || null,
          languageCode: 'ru',
          role: shouldBeAdmin ? 'admin' : 'customer',
          loyaltyPoints: 100,
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      authenticated: true,
      user,
    });

  } catch (error) {
    console.error('Widget auth error:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
