import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { verifyTelegramWebAppData, type TelegramUser } from '@/lib/telegram-auth';
import { awardWelcomeBonus } from '@/lib/loyalty';

export const dynamic = 'force-dynamic';

// Generate unique ID
function generateId(): string {
  return `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * POST /api/auth/telegram
 * 
 * Authenticates user via Telegram WebApp initData with HMAC signature verification.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData } = body;

    // Method 1: Verify Telegram WebApp signature (most secure)
    if (initData) {
      const result = verifyTelegramWebAppData(initData);

      if (!result.ok) {
        console.error('❌ Invalid Telegram signature:', result.reason);
        return NextResponse.json(
          { error: 'Invalid authentication - signature verification failed', reason: result.reason },
          { status: 401 }
        );
      }

      const telegramUser = result.user as TelegramUser;
      const tgId = telegramUser.id.toString();
      const isAdmin = env.isAdmin(tgId);

      return await createOrUpdateUser(tgId, telegramUser, isAdmin);
    }

    // No valid auth method
    return NextResponse.json(
      { error: 'Authentication required - no valid auth method provided' },
      { status: 401 }
    );

  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

/**
 * Create or update user in database
 */
async function createOrUpdateUser(telegramId: string, telegramUser: TelegramUser, isAdmin: boolean) {
  const newRole = isAdmin ? 'admin' : 'customer';

  // If database is not configured, return user data
  if (!db) {
    console.warn('Database not configured, returning user data');
    return NextResponse.json({
      user: {
        id: `demo-${telegramId}`,
        telegramId: telegramId,
        username: telegramUser.username || null,
        firstName: telegramUser.first_name || 'User',
        lastName: telegramUser.last_name || null,
        phone: null,
        email: null,
        photoUrl: telegramUser.photo_url || null,
        languageCode: telegramUser.language_code || null,
        role: newRole,
        loyaltyPoints: 100,
        totalSpent: 0,
        ordersCount: 0,
        referralCode: null,
        referredBy: null,
        birthday: null,
        lastVisitAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      isAdmin,
      isNewUser: true,
      verified: true,
    });
  }

  // Check if user exists
  const existingUser = await db.user.findUnique({
    where: { telegramId: telegramId },
  });

  let user;
  let isNewUser = false;

  if (existingUser) {
    // Update existing user
    user = await db.user.update({
      where: { telegramId: telegramId },
      data: {
        username: telegramUser.username || existingUser.username,
        firstName: telegramUser.first_name || existingUser.firstName,
        lastName: telegramUser.last_name || existingUser.lastName,
        languageCode: telegramUser.language_code || existingUser.languageCode,
        photoUrl: telegramUser.photo_url || existingUser.photoUrl,
        role: newRole, // Always sync role
        lastVisitAt: new Date(),
        updatedAt: new Date(),
      },
    });
    
    if (existingUser.role !== newRole) {
      // Role updated
    }
  } else {
    // Create new user
    isNewUser = true;
    const userId = generateId();
    const referralCode = `REF-${userId.slice(-8).toUpperCase()}`;
    
    user = await db.user.create({
      data: {
        id: userId,
        telegramId: telegramId,
        username: telegramUser.username || null,
        firstName: telegramUser.first_name || null,
        lastName: telegramUser.last_name || null,
        languageCode: telegramUser.language_code || null,
        photoUrl: telegramUser.photo_url || null,
        phone: null,
        role: newRole,
        loyaltyPoints: 0, // Will be set by awardWelcomeBonus
        totalSpent: 0,
        ordersCount: 0,
        referralCode: referralCode,
        lastVisitAt: new Date(),
        updatedAt: new Date(),
      },
    });
    
    // Award welcome bonus
    await awardWelcomeBonus(userId);
    
    // Refetch user to get updated loyalty points
    user = await db.user.findUnique({
      where: { id: userId },
    });
  }

  return NextResponse.json({
    user: {
      id: user!.id,
      telegramId: user!.telegramId,
      username: user!.username,
      firstName: user!.firstName,
      lastName: user!.lastName,
      phone: user!.phone,
      email: user!.email,
      photoUrl: user!.photoUrl,
      languageCode: user!.languageCode,
      role: user!.role,
      loyaltyPoints: user!.loyaltyPoints,
      totalSpent: user!.totalSpent || 0,
      ordersCount: user!.ordersCount || 0,
      referralCode: user!.referralCode,
      referredBy: user!.referredBy,
      birthday: user!.birthday?.toISOString() || null,
      lastVisitAt: user!.lastVisitAt?.toISOString(),
      createdAt: user!.createdAt.toISOString(),
    },
    isAdmin,
    isNewUser,
    verified: true,
  });
}
