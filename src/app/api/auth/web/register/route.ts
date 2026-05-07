import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateSessionToken, isAdminCredentials } from '@/lib/password';
import { awardWelcomeBonus } from '@/lib/loyalty';

export const dynamic = 'force-dynamic';

const SESSION_DURATION_DAYS = 30;

/**
 * POST /api/auth/web/register
 * 
 * Register a new web user with phone + password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, password, firstName, lastName } = body;

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'Телефон и пароль обязательны' },
        { status: 400 }
      );
    }

    // Normalize phone
    const normalizedPhone = phone.replace(/[\s\-()]/g, '');

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Пароль должен быть не менее 6 символов' },
        { status: 400 }
      );
    }

    if (!db) {
      return NextResponse.json({ error: 'База данных не настроена' }, { status: 500 });
    }

    // Check if phone is already registered
    const existingUser = await db.user.findFirst({ where: { phone: normalizedPhone } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Пользователь с таким номером уже зарегистрирован' },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);
    const referralCode = `REF-${Date.now().toString(36).toUpperCase()}`;
    
    const user = await db.user.create({
      data: {
        phone: normalizedPhone,
        firstName: firstName || null,
        lastName: lastName || null,
        passwordHash,
        authType: 'web',
        role: 'customer',
        referralCode,
        lastVisitAt: new Date(),
      },
    });

    // Welcome bonus
    try { await awardWelcomeBonus(user.id); } catch {}

    // Create session
    const token = generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

    await db.webSession.create({
      data: {
        token,
        userId: user.id,
        userAgent: request.headers.get('user-agent') || null,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        expiresAt,
      },
    });

    const finalUser = await db.user.findUnique({ where: { id: user.id } });

    const response = NextResponse.json({
      user: mapUser(finalUser!),
      isAdmin: false,
      isNewUser: true,
    });

    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Ошибка регистрации' }, { status: 500 });
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
