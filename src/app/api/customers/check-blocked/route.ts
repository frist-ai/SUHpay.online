import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

// Telegram Bot API error codes
const TELEGRAM_ERROR_BLOCKED = 403;
const TELEGRAM_ERROR_USER_NOT_FOUND = 400;

// POST /api/customers/check-blocked - Check if user has blocked the bot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telegramId } = body;

    if (!telegramId) {
      return NextResponse.json({ error: 'telegramId required' }, { status: 400 });
    }

    const botToken = env.telegramBotToken;
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    // Try to send a chat action (typing) - this doesn't send a visible message
    // but will fail if the user has blocked the bot
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendChatAction`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId,
          action: 'typing',
        }),
      }
    );

    const data = await response.json();

    if (!data.ok) {
      const errorCode = data.error_code;
      const description = data.description || '';

      // Chat action result

      // User has blocked the bot
      if (errorCode === TELEGRAM_ERROR_BLOCKED || 
          description.includes('bot was blocked') ||
          description.includes('user is deactivated') ||
          description.includes('Forbidden')) {
        
        // Update user in database
        await db.user.update({
          where: { telegramId },
          data: { 
            blockedAt: new Date(),
            isActive: false,
          },
        });

        return NextResponse.json({ 
          blocked: true, 
          reason: description,
        });
      }

      // User not found or other error
      if (errorCode === TELEGRAM_ERROR_USER_NOT_FOUND ||
          description.includes('chat not found')) {
        return NextResponse.json({ 
          blocked: false, 
          notFound: true,
          reason: description,
        });
      }

      // Other error
      return NextResponse.json({ 
        blocked: false, 
        error: description,
      });
    }

    // Success - user has NOT blocked the bot
    // Clear blockedAt if it was set
    await db.user.update({
      where: { telegramId },
      data: { 
        blockedAt: null,
        isActive: true,
      },
    });

    return NextResponse.json({ blocked: false });

  } catch (error) {
    console.error('Error checking blocked status:', error);
    return NextResponse.json({ 
      error: 'Failed to check blocked status' 
    }, { status: 500 });
  }
}

// GET /api/customers/check-blocked - Bulk check blocked status
export async function GET(request: NextRequest) {
  try {
    const botToken = env.telegramBotToken;
    if (!botToken) {
      return NextResponse.json({ error: 'Bot token not configured' }, { status: 500 });
    }

    // Get all users with telegramId
    const users = await db.user.findMany({
      where: {
        telegramId: { not: null as any },
      },
      select: { id: true, telegramId: true, blockedAt: true },
    });

    let blockedCount = 0;
    let activeCount = 0;
    const blockedUsers: string[] = [];

    // Check each user
    for (const user of users) {
      if (!user.telegramId) continue;

      try {
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/sendChatAction`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: user.telegramId,
              action: 'typing',
            }),
          }
        );

        const data = await response.json();

        if (!data.ok && (data.error_code === 403 || data.description?.includes('blocked'))) {
          blockedCount++;
          blockedUsers.push(user.telegramId);
          
          // Update database
          await db.user.update({
            where: { id: user.id },
            data: { blockedAt: new Date(), isActive: false },
          });
        } else {
          activeCount++;
          
          // Clear blocked status if was set
          if (user.blockedAt) {
            await db.user.update({
              where: { id: user.id },
              data: { blockedAt: null, isActive: true },
            });
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch {
        // Skip on error
      }
    }

    return NextResponse.json({
      checked: users.length,
      blocked: blockedCount,
      active: activeCount,
      blockedUsers,
    });
  } catch (error) {
    console.error('Error in bulk blocked check:', error);
    return NextResponse.json({ 
      error: 'Failed to perform bulk check' 
    }, { status: 500 });
  }
}
