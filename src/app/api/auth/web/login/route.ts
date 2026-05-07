import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateSessionToken, isAdminCredentials, hashPassword } from '@/lib/password';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const SESSION_DURATION_DAYS = 30;

/**
 * POST /api/auth/web/login
 * 
 * Login with phone + password.
 * Supports both regular users and admin credentials.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, password } = body;

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'Телефон и пароль обязательны' },
        { status: 400 }
      );
    }

    // Normalize phone
    const normalizedPhone = phone.replace(/[\s\-()]/g, '');

    if (!db) {
      return NextResponse.json({ error: 'База данных не настроена' }, { status: 500 });
    }

    // ─── Check admin credentials ───
    if (isAdminCredentials(normalizedPhone, password)) {
      // Find or create admin user with this phone
      let adminUser = await db.user.findFirst({ where: { phone: normalizedPhone } });
      
      if (!adminUser) {
        // Create admin user
        const passwordHash = hashPassword(password);
        adminUser = await db.user.create({
          data: {
            phone: normalizedPhone,
            firstName: 'Администратор',
            passwordHash,
            authType: 'web',
            role: 'admin',
            loyaltyPoints: 0,
            referralCode: `REF-${Date.now().toString(36).toUpperCase()}`,
            lastVisitAt: new Date(),
          },
        });
      } else {
        // Ensure role is admin
        if (adminUser.role !== 'admin') {
          adminUser = await db.user.update({
            where: { id: adminUser.id },
            data: { role: 'admin' },
          });
        }
        // Update password hash if not set
        if (!adminUser.passwordHash) {
          await db.user.update({
            where: { id: adminUser.id },
            data: { passwordHash: hashPassword(password) },
          });
        }
      }

      // Update last visit
      await db.user.update({
        where: { id: adminUser.id },
        data: { lastVisitAt: new Date() },
      });

      // Create session
      const token = generateSessionToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

      await db.webSession.create({
        data: {
          token,
          userId: adminUser.id,
          userAgent: request.headers.get('user-agent') || null,
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          expiresAt,
        },
      });

      const response = NextResponse.json({
        user: mapUser(adminUser),
        isAdmin: true,
        isNewUser: false,
      });

      response.cookies.set('session_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      });

      return response;
    }

    // ─── Check regular user credentials ───
    const user = await db.user.findFirst({
      where: { phone: normalizedPhone, authType: 'web' },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'Неверный номер телефона или пароль' },
        { status: 401 }
      );
    }

    // Check if user is blocked
    if (user.blockedAt) {
      return NextResponse.json(
        { error: 'Аккаунт заблокирован' },
        { status: 403 }
      );
    }

    // Verify password
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: 'Неверный номер телефона или пароль' },
        { status: 401 }
      );
    }

    // Update last visit
    await db.user.update({
      where: { id: user.id },
      data: { lastVisitAt: new Date() },
    });

    // Check admin status (via Telegram IDs or database settings)
    const isAdmin = env.isAdmin(user.telegramId || '') || await checkAdminInDB(user.id);

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

    const response = NextResponse.json({
      user: mapUser(user),
      isAdmin,
      isNewUser: false,
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
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Ошибка входа' }, { status: 500 });
  }
}

async function checkAdminInDB(userId: string): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === 'admin';
  } catch {
    return false;
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
