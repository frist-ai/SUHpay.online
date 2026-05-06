import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// POST /api/polls/[id]/send - Send poll to subscribers
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    
    const poll = await db.poll.findUnique({
      where: { id },
      include: {
        pollOptions: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }
    
    if (poll.status !== 'draft') {
      return NextResponse.json({ error: 'Poll already sent or closed' }, { status: 400 });
    }
    
    // Get recipients based on targetType
    let recipients: { telegramId: string }[] = [];
    
    if (poll.targetType === 'all') {
      // All users who interacted with bot
      recipients = await db.user.findMany({
        select: { telegramId: true },
      });
    } else if (poll.targetType === 'registered') {
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
    } else if (poll.targetType === 'buyers') {
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
    
    // Update poll status
    await db.poll.update({
      where: { id },
      data: {
        status: 'active',
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
      return NextResponse.json({
        success: true,
        message: 'Poll sent (demo mode - no bot token)',
        sentCount: recipients.length,
        totalRecipients: recipients.length,
      });
    }
    
    // Send to Telegram
    let sentCount = 0;
    let failedCount = 0;
    
    // Create inline keyboard for poll options
    const inlineKeyboard = {
      inline_keyboard: poll.pollOptions.map((option, index) => [
        {
          text: option.text,
          callback_data: `poll_${poll.id}_${option.id}`,
        },
      ]),
    };
    
    for (const recipient of recipients) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: recipient.telegramId,
            text: `📊 *${poll.question}*\n\nВыберите вариант ответа:`,
            parse_mode: 'Markdown',
            reply_markup: inlineKeyboard,
          }),
        });
        
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
    
    // Update poll with sent count
    await db.poll.update({
      where: { id },
      data: {
        sentCount,
      },
    });
    
    return NextResponse.json({
      success: true,
      sentCount,
      failedCount,
      totalRecipients: recipients.length,
    });
  } catch (error) {
    console.error('Error sending poll:', error);
    return NextResponse.json({ error: 'Failed to send poll' }, { status: 500 });
  }
}
