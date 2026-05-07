/**
 * Server-side authentication helpers
 * Telegram WebApp auth only
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
 * Get authenticated user from request (Telegram auth only).
 * Returns null if auth fails (request continues without auth).
 */
export async function getOptionalUser(request: NextRequest): Promise<{
  user: { id: string; telegramId: string | null; role: string; phone: string | null } | null;
  authMethod: 'telegram' | null;
}> {
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

  return { user: null, authMethod: null };
}

/**
 * Verify if the requesting user is authenticated via Telegram (required).
 * Returns error if Telegram auth fails.
 */
export async function verifyRequestAuth(request: NextRequest): Promise<{
  valid: boolean;
  user: { id: string; telegramId: string | null; role: string; phone: string | null } | null;
  telegramId: string | null;
  authMethod: 'telegram' | null;
  error?: NextResponse;
}> {
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

  // Telegram auth failed
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
      { error: 'Unauthorized - Telegram authentication required' },
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
