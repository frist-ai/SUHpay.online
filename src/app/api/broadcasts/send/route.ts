import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// POST /api/broadcasts/send - Send broadcast to subscribers
export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { broadcastId } = body;
    
    if (!broadcastId) {
      return NextResponse.json({ error: 'Broadcast ID required' }, { status: 400 });
    }
    
    const broadcast = await db.broadcast.findUnique({
      where: { id: broadcastId },
    });
    
    if (!broadcast) {
      return NextResponse.json({ error: 'Broadcast not found' }, { status: 404 });
    }
    
    if (broadcast.status === 'sent' || broadcast.status === 'sending') {
      return NextResponse.json({ error: 'Broadcast already sent or in progress' }, { status: 400 });
    }
    
    // Get recipients based on targetType
    let recipients: { telegramId: string }[] = [];
    
    if (broadcast.targetType === 'all') {
      // All users who interacted with bot
      recipients = await db.user.findMany({
        select: { telegramId: true },
      });
    } else if (broadcast.targetType === 'registered') {
      // Registered users (have phone or email)
      recipients = await db.user.findMany({
        where: {
          OR: [
            { phone: { not: null } },
            { email: { not: null } },
          ],
        },
        select: { telegramId: true },
      });
    } else if (broadcast.targetType === 'buyers') {
      // Users who made purchases
      recipients = await db.user.findMany({
        where: {
          orders: {
            some: {
              status: { not: 'cancelled' },
            },
          },
        },
        select: { telegramId: true },
      });
    }
    
    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients found' }, { status: 400 });
    }
    
    // Update broadcast status
    await db.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: 'sending',
        totalRecipients: recipients.length,
      },
    });
    
    // Get bot token from settings
    const botTokenSetting = await db.setting.findUnique({
      where: { key: 'telegram_bot_token' },
    });
    
    const botToken = botTokenSetting?.value || process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      // Simulate sending for demo
      await db.broadcast.update({
        where: { id: broadcastId },
        data: {
          status: 'sent',
          sentCount: recipients.length,
          sentAt: new Date(),
        },
      });
      
      return NextResponse.json({
        success: true,
        message: 'Broadcast sent (demo mode - no bot token)',
        sentCount: recipients.length,
      });
    }
    
    // Send to Telegram (in background for large lists)
    let sentCount = 0;
    let failedCount = 0;
    
    const message = broadcast.imageUrl 
      ? `${broadcast.title}\n\n${broadcast.message}${broadcast.linkUrl ? `\n\n${broadcast.linkUrl}` : ''}`
      : `${broadcast.title}\n\n${broadcast.message}${broadcast.linkUrl ? `\n\n${broadcast.linkUrl}` : ''}`;
    
    for (const recipient of recipients) {
      try {
        const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        
        let response;
        if (broadcast.imageUrl) {
          // Send photo
          response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: recipient.telegramId,
              photo: broadcast.imageUrl,
              caption: message,
              parse_mode: 'HTML',
            }),
          });
        } else {
          // Send text
          response = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: recipient.telegramId,
              text: message,
              parse_mode: 'HTML',
            }),
          });
        }
        
        if (response.ok) {
          sentCount++;
        } else {
          failedCount++;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        failedCount++;
      }
    }
    
    // Update broadcast status
    await db.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: 'sent',
        sentCount,
        failedCount,
        sentAt: new Date(),
      },
    });
    
    return NextResponse.json({
      success: true,
      sentCount,
      failedCount,
      totalRecipients: recipients.length,
    });
  } catch (error) {
    console.error('Error sending broadcast:', error);
    return NextResponse.json({ error: 'Failed to send broadcast' }, { status: 500 });
  }
}
