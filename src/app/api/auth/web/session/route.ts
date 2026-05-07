import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/web/session
 * 
 * Check if user has a valid session and return user data.
 * Used to restore session on page load.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Find session
    const session = await db.webSession.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: true,
      },
    });

    if (!session || !session.user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Check if user is blocked
    if (session.user.blockedAt) {
      // Delete session
      await db.webSession.deleteMany({ where: { token } });
      return NextResponse.json({ authenticated: false, reason: 'blocked' }, { status: 401 });
    }

    // Update last visit
    await db.user.update({
      where: { id: session.user.id },
      data: { lastVisitAt: new Date() },
    });

    // Check admin status
    const isAdmin = env.isAdmin(session.user.telegramId || '') || session.user.role === 'admin';

    return NextResponse.json({
      authenticated: true,
      user: mapUser(session.user),
      isAdmin,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

function mapUser(user: any) {
  return {
    id: user.id,
    telegramId: user.telegramId || null,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    email: user.email,
    photoUrl: user.photoUrl,
    languageCode: user.languageCode,
    role: user.role,
    authType: user.authType || 'web',
    loyaltyPoints: user.loyaltyPoints || 0,
    totalSpent: user.totalSpent || 0,
    ordersCount: user.ordersCount || 0,
    referralCode: user.referralCode,
    referredBy: user.referredBy,
    birthday: user.birthday?.toISOString() || null,
    lastVisitAt: user.lastVisitAt?.toISOString(),
    createdAt: user.createdAt?.toISOString(),
  };
}
