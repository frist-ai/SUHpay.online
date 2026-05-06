import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { verifyTelegramWebAppData, type TelegramUser } from '@/lib/telegram-auth';

export const dynamic = 'force-dynamic';

/**
 * Check if user is admin (from env or database)
 */
async function isAdminUser(telegramId: string): Promise<boolean> {
  if (env.isAdmin(telegramId)) return true;
  
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
 * Get list of admin IDs from database
 */
async function getAdminIds(): Promise<string[]> {
  if (!db) return env.adminTelegramIds;
  
  try {
    const setting = await db.setting.findUnique({
      where: { key: 'admin_telegram_ids' },
    });
    
    if (!setting) return env.adminTelegramIds;
    
    const dbAdminIds = JSON.parse(setting.value) as string[];
    
    // Merge with env admin IDs
    const allIds = new Set([...env.adminTelegramIds, ...dbAdminIds]);
    return Array.from(allIds);
  } catch {
    return env.adminTelegramIds;
  }
}

/**
 * Save admin IDs to database
 */
async function saveAdminIds(ids: string[]): Promise<void> {
  if (!db) return;
  
  // Filter out IDs that are in env (they can't be removed)
  const envIds = new Set(env.adminTelegramIds);
  const additionalIds = ids.filter(id => !envIds.has(id));
  
  await db.setting.upsert({
    where: { key: 'admin_telegram_ids' },
    create: {
      key: 'admin_telegram_ids',
      value: JSON.stringify(additionalIds),
    },
    update: {
      value: JSON.stringify(additionalIds),
    },
  });
}

/**
 * GET /api/admin-ids
 * Get list of admin Telegram IDs
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const initData = searchParams.get('initData');

    // Verify admin access
    if (!initData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = verifyTelegramWebAppData(initData);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'Invalid signature', reason: result.reason },
        { status: 401 }
      );
    }

    const telegramId = (result.user as TelegramUser).id.toString();
    
    if (!await isAdminUser(telegramId)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const adminIds = await getAdminIds();
    const envIds = env.adminTelegramIds;
    const dbIds = adminIds.filter(id => !envIds.includes(id));

    return NextResponse.json({
      adminIds,
      envAdminIds: envIds, // IDs from environment (cannot be removed)
      dbAdminIds: dbIds,   // IDs from database (can be managed)
    });
  } catch (error) {
    console.error('Error getting admin IDs:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin-ids
 * Add a new admin Telegram ID
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData, newAdminId } = body;

    // Verify admin access
    if (!initData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = verifyTelegramWebAppData(initData);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'Invalid signature', reason: result.reason },
        { status: 401 }
      );
    }

    const telegramId = (result.user as TelegramUser).id.toString();
    
    if (!await isAdminUser(telegramId)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    if (!newAdminId || typeof newAdminId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid Telegram ID' },
        { status: 400 }
      );
    }

    // Clean the ID
    const cleanId = newAdminId.trim();
    
    // Validate format (should be numeric)
    if (!/^\d+$/.test(cleanId)) {
      return NextResponse.json(
        { error: 'Telegram ID must be numeric' },
        { status: 400 }
      );
    }

    // Check if already admin
    const currentIds = await getAdminIds();
    if (currentIds.includes(cleanId)) {
      return NextResponse.json(
        { error: 'This ID is already an admin' },
        { status: 400 }
      );
    }

    // Add new admin
    const newIds = [...currentIds, cleanId];
    await saveAdminIds(newIds);

    // Update user role in database
    if (db) {
      await db.user.updateMany({
        where: { telegramId: cleanId },
        data: { role: 'admin' },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Added ${cleanId} as admin`,
      adminIds: newIds,
    });
  } catch (error) {
    console.error('Error adding admin ID:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin-ids
 * Remove an admin Telegram ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { initData, removeAdminId } = body;

    // Verify admin access
    if (!initData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = verifyTelegramWebAppData(initData);
    if (!result.ok) {
      return NextResponse.json(
        { error: 'Invalid signature', reason: result.reason },
        { status: 401 }
      );
    }

    const telegramId = (result.user as TelegramUser).id.toString();
    
    if (!await isAdminUser(telegramId)) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    if (!removeAdminId || typeof removeAdminId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid Telegram ID' },
        { status: 400 }
      );
    }

    // Can't remove env admins
    if (env.isAdmin(removeAdminId)) {
      return NextResponse.json(
        { error: 'Cannot remove admin from environment configuration' },
        { status: 400 }
      );
    }

    // Remove admin
    const currentIds = await getAdminIds();
    const newIds = currentIds.filter(id => id !== removeAdminId);
    await saveAdminIds(newIds);

    // Update user role in database
    if (db) {
      await db.user.updateMany({
        where: { telegramId: removeAdminId },
        data: { role: 'customer' },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Removed ${removeAdminId} from admins`,
      adminIds: newIds,
    });
  } catch (error) {
    console.error('Error removing admin ID:', error);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}
