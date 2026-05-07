import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { verifyAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// Telegram API helper
async function telegramApi(method: string, params?: Record<string, unknown>) {
  if (!env.telegramBotToken) {
    return { ok: false, error: 'Bot not configured' };
  }
  
  const url = `https://api.telegram.org/bot${env.telegramBotToken}/${method}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: params ? JSON.stringify(params) : undefined,
  });
  
  return response.json();
}

// POST /api/telegram/sync-users - Sync users from Telegram getUpdates
export async function POST(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    if (!env.isBotConfigured) {
      return NextResponse.json({ 
        error: 'Bot not configured',
        message: 'Set TELEGRAM_BOT_TOKEN environment variable'
      }, { status: 503 });
    }

    // Get updates from Telegram (last 24 hours)
    const updates = await telegramApi('getUpdates', {
      allowed_updates: ['message', 'callback_query', 'my_chat_member'],
      limit: 100,
    });

    if (!updates.ok) {
      return NextResponse.json({ 
        error: 'Failed to get updates',
        details: updates 
      }, { status: 500 });
    }

    const users = new Map<string, {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    }>();

    // Extract unique users from updates
    for (const update of updates.result || []) {
      // From message
      if (update.message?.from) {
        const u = update.message.from;
        users.set(u.id.toString(), u);
      }
      // From callback query
      if (update.callback_query?.from) {
        const u = update.callback_query.from;
        users.set(u.id.toString(), u);
      }
      // From chat member update
      if (update.my_chat_member?.from) {
        const u = update.my_chat_member.from;
        users.set(u.id.toString(), u);
      }
    }

    let newUsers = 0;
    let updatedUsers = 0;
    const errors: string[] = [];

    // Sync each user to database
    for (const [telegramId, userData] of users) {
      try {
        const isAdmin = env.isAdmin(telegramId);
        
        const existingUser = await db.user.findUnique({
          where: { telegramId },
        });

        if (existingUser) {
          // Update existing user
          await db.user.update({
            where: { telegramId },
            data: {
              username: userData.username || existingUser.username,
              firstName: userData.first_name || existingUser.firstName,
              lastName: userData.last_name || existingUser.lastName,
              languageCode: userData.language_code || existingUser.languageCode,
              role: isAdmin ? 'admin' : existingUser.role,
              lastVisitAt: new Date(),
              isActive: true,
            },
          });
          updatedUsers++;
        } else {
          // Create new user
          await db.user.create({
            data: {
              id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              telegramId,
              username: userData.username || null,
              firstName: userData.first_name || null,
              lastName: userData.last_name || null,
              languageCode: userData.language_code || null,
              role: isAdmin ? 'admin' : 'customer',
              lastVisitAt: new Date(),
              authDate: new Date(),
              loyaltyPoints: 100, // Welcome bonus
            },
          });
          newUsers++;
        }
      } catch (err) {
        errors.push(`User ${telegramId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // Get total users count
    const totalUsers = await db.user.count();

    return NextResponse.json({
      success: true,
      message: `Синхронизация завершена`,
      stats: {
        foundInUpdates: users.size,
        newUsers,
        updatedUsers,
        totalUsers,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error syncing users:', error);
    return NextResponse.json({ 
      error: 'Failed to sync users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET /api/telegram/sync-users - Get sync status
export async function GET() {
  try {
    const totalUsers = await db.user.count();
    const recentUsers = await db.user.findMany({
      select: {
        telegramId: true,
        firstName: true,
        lastName: true,
        username: true,
        lastVisitAt: true,
      },
      orderBy: { lastVisitAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      botConfigured: env.isBotConfigured,
      totalUsers,
      recentUsers,
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
