/**
 * Server-side authentication helpers
 * Supports both Telegram WebApp auth and Web session (cookie) auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { verifyTelegramWebAppData, type TelegramUser } from '@/lib/telegram-auth';

/**
 * Check if user is admin in database settings
 */
async function checkAdminInDatabase(telegramId: string): Promise<boolean> {
  if (!db) return false;
  try {
    const setting = await db.setting.findUnique({
      where: { key: 'admin_telegram_ids' },
    });
    if (!setting) return false;
    const adminIds = JSON.parse(setting.value) as string[];
    return adminIds.includes(telegramId);
  } catch {
    return false;
  }
}

/**
 * Authenticate via web session cookie
 */
async function verifySessionAuth(request: NextRequest): Promise<{
  valid: boolean;
  user: { id: string; telegramId: string | null; role: string; phone: string | null } | null;
  error?: NextResponse;
}> {
  try {
    const token = request.cookies.get('session_token')?.value;

    if (!token || !db) {
      return { valid: false, user: null };
    }

    const session = await db.webSession.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            role: true,
            phone: true,
            blockedAt: true,
            authType: true,
          },
        },
      },
    });

    if (!session || !session.user) {
      return { valid: false, user: null };
    }

    // Check if blocked
    if (session.user.blockedAt) {
      await db.webSession.deleteMany({ where: { token } });
      return { valid: false, user: null };
    }

    // Update last visit
    await db.user.update({
      where: { id: session.user.id },
      data: { lastVisitAt: new Date() },
    });

    return {
      valid: true,
      user: {
        id: session.user.id,
        telegramId: session.user.telegramId,
        role: session.user.role,
        phone: session.user.phone,
      },
    };
  } catch (error) {
    console.error('[auth] Session verification error:', error);
    return { valid: false, user: null };
  }
}

/**
 * Extract and verify Telegram initData from request
 */
async function verifyTelegramAuth(request: NextRequest): Promise<{
  valid: boolean;
  user: TelegramUser | null;
  telegramId: string | null;
  error?: NextResponse;
}> {
  try {
    let initData: string | null = null;
    
    // 1. Check header
    const headerData = request.headers.get('x-telegram-init-data');
    if (headerData) {
      initData = headerData;
    }
    
    // 2. Check query params
    if (!initData) {
      initData = request.nextUrl.searchParams.get('initData');
    }
    
    // 3. Check JSON body
    if (!initData && request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const cloned = request.clone();
        const body = await cloned.json();
        if (body?.initData) {
          initData = body.initData;
        }
      } catch {}
    }

    if (!initData) {
      return { valid: false, user: null, telegramId: null };
    }

    const result = verifyTelegramWebAppData(initData);

    if (result.ok) {
      const user = result.user as TelegramUser;
      return { valid: true, user, telegramId: user.id.toString() };
    }

    console.error('[auth] Telegram verification rejected:', result.reason);
    return { valid: false, user: null, telegramId: null };
  } catch (error) {
    console.error('[auth] Telegram verification error:', error);
    return { valid: false, user: null, telegramId: null };
  }
}

/**
 * Get authenticated user from request.
 * Tries Telegram auth first, then falls back to session cookie auth.
 * Returns null if neither auth method succeeds (request continues without auth).
 */
export async function getOptionalUser(request: NextRequest): Promise<{
  user: { id: string; telegramId: string | null; role: string; phone: string | null } | null;
  authMethod: 'telegram' | 'web' | null;
}> {
  // Try Telegram auth first
  const tgResult = await verifyTelegramAuth(request);
  if (tgResult.valid && tgResult.user && tgResult.telegramId) {
    const telegramId = tgResult.telegramId;
    
    if (db) {
      const user = await db.user.findUnique({
        where: { telegramId },
        select: { id: true, telegramId: true, role: true, phone: true },
      });
      if (user) {
        return { user, authMethod: 'telegram' };
      }
    }
    
    return {
      user: {
        id: `tg-${telegramId}`,
        telegramId,
        role: env.isAdmin(telegramId) ? 'admin' : 'customer',
        phone: null,
      },
      authMethod: 'telegram',
    };
  }

  // Try session auth
  const sessionResult = await verifySessionAuth(request);
  if (sessionResult.valid && sessionResult.user) {
    return { user: sessionResult.user, authMethod: 'web' };
  }

  return { user: null, authMethod: null };
}

/**
 * Verify if the requesting user is authenticated (required).
 * Returns error if no auth method succeeds.
 */
export async function verifyRequestAuth(request: NextRequest): Promise<{
  valid: boolean;
  user: { id: string; telegramId: string | null; role: string; phone: string | null } | null;
  telegramId: string | null;
  authMethod: 'telegram' | 'web' | null;
  error?: NextResponse;
}> {
  // Try Telegram auth first
  const tgResult = await verifyTelegramAuth(request);
  if (tgResult.valid && tgResult.user && tgResult.telegramId) {
    const telegramId = tgResult.telegramId;

    if (db) {
      const user = await db.user.findUnique({
        where: { telegramId },
        select: { id: true, telegramId: true, role: true, phone: true },
      });
      if (user) {
        // Sync admin role
        const shouldBeAdmin = env.isAdmin(telegramId) || await checkAdminInDatabase(telegramId);
        if (user.role !== (shouldBeAdmin ? 'admin' : 'customer')) {
          await db.user.update({
            where: { id: user.id },
            data: { role: shouldBeAdmin ? 'admin' : 'customer' },
          });
        }
        return {
          valid: true,
          user: { ...user, role: shouldBeAdmin ? 'admin' : user.role },
          telegramId,
          authMethod: 'telegram',
        };
      }
    }

    return {
      valid: true,
      user: {
        id: `tg-${telegramId}`,
        telegramId,
        role: env.isAdmin(telegramId) ? 'admin' : 'customer',
        phone: null,
      },
      telegramId,
      authMethod: 'telegram',
    };
  }

  // Try session auth
  const sessionResult = await verifySessionAuth(request);
  if (sessionResult.valid && sessionResult.user) {
    return {
      valid: true,
      user: sessionResult.user,
      telegramId: sessionResult.user.telegramId,
      authMethod: 'web',
    };
  }

  // Neither auth method succeeded
  // Only return error if it was specifically a Telegram auth attempt
  const hasTgHeader = request.headers.get('x-telegram-init-data');
  if (hasTgHeader && tgResult.error) {
    return {
      valid: false,
      user: null,
      telegramId: null,
      authMethod: null,
      error: tgResult.error,
    };
  }

  return {
    valid: false,
    user: null,
    telegramId: null,
    authMethod: null,
    error: NextResponse.json(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 }
    ),
  };
}

/**
 * Verify if the requesting user is an admin
 */
export async function verifyAdmin(request: NextRequest): Promise<{
  user: { id: string; telegramId: string | null; role: string } | null;
  error?: NextResponse;
}> {
  const authResult = await verifyRequestAuth(request);
  
  if (authResult.error && authResult.valid === false) {
    return { user: null, error: authResult.error };
  }
  
  if (!authResult.valid || !authResult.user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { user } = authResult;
  
  // Check admin status
  let isAdmin = user.role === 'admin';
  if (!isAdmin && user.telegramId) {
    isAdmin = env.isAdmin(user.telegramId) || await checkAdminInDatabase(user.telegramId);
  }
  
  if (!isAdmin) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }),
    };
  }

  // Verify user exists in database
  if (db) {
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, telegramId: true, role: true },
    });

    if (!dbUser) {
      return {
        user: null,
        error: NextResponse.json({ error: 'User not found' }, { status: 404 }),
      };
    }

    // Sync role if needed
    if (dbUser.role !== 'admin') {
      await db.user.update({
        where: { id: dbUser.id },
        data: { role: 'admin' },
      });
    }

    return { user: dbUser };
  }

  return { user };
}

/**
 * Verify if the requesting user exists and return their data
 */
export async function verifyUser(request: NextRequest): Promise<{
  user: { id: string; telegramId: string | null; role: string } | null;
  error?: NextResponse;
}> {
  const authResult = await verifyRequestAuth(request);
  
  if (authResult.error && authResult.valid === false) {
    return { user: null, error: authResult.error };
  }
  
  if (!authResult.valid || !authResult.user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { user } = authResult;

  if (db) {
    const whereClause = user.telegramId
      ? { telegramId: user.telegramId }
      : { id: user.id };
    
    const dbUser = await db.user.findUnique({
      where: whereClause,
      select: { id: true, telegramId: true, role: true },
    });

    if (!dbUser) {
      return {
        user: null,
        error: NextResponse.json({ error: 'User not found' }, { status: 404 }),
      };
    }

    // Verify role matches admin status
    const shouldBeAdmin = (user.telegramId && (env.isAdmin(user.telegramId) || await checkAdminInDatabase(user.telegramId))) || dbUser.role === 'admin';
    const correctRole = shouldBeAdmin ? 'admin' : 'customer';
    
    if (dbUser.role !== correctRole) {
      const updatedUser = await db.user.update({
        where: { id: dbUser.id },
        data: { role: correctRole },
        select: { id: true, telegramId: true, role: true },
      });
      return { user: updatedUser };
    }

    return { user: dbUser };
  }

  return { user };
}

/**
 * Middleware-like function to check admin access for API routes
 */
export async function withAdminCheck<T>(
  request: NextRequest,
  handler: (userId: string) => Promise<T>
): Promise<T | NextResponse> {
  const { user, error } = await verifyAdmin(request);
  
  if (error) return error;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  return handler(user.id);
}

/**
 * Check if a telegramId is a collector in the Staff table
 */
export async function checkIsCollector(telegramId: string): Promise<boolean> {
  if (!db) return false;
  try {
    const staff = await db.staff.findUnique({
      where: { telegramId },
      select: { role: true, isActive: true },
    });
    return staff?.role === 'collector' && staff.isActive !== false;
  } catch {
    return false;
  }
}

/**
 * Verify user and return extended info including collector status
 */
export async function verifyUserWithCollector(request: NextRequest): Promise<{
  user: { id: string; telegramId: string | null; role: string } | null;
  isCollector: boolean;
  error?: NextResponse;
}> {
  const result = await verifyUser(request);
  
  if (result.error || !result.user) {
    return { user: null, isCollector: false, error: result.error };
  }
  
  const isCollector = result.user.telegramId ? await checkIsCollector(result.user.telegramId) : false;
  
  return { user: result.user, isCollector };
}
