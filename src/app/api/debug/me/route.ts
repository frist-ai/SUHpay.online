import { NextRequest, NextResponse } from 'next/server';

// GET /api/debug/me - Get current user info from Telegram WebApp
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const adminIds = process.env.ADMIN_TELEGRAM_IDS?.split(',').map(id => id.trim()).filter(Boolean) || [];
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const databaseUrl = process.env.DATABASE_URL;
  
  return NextResponse.json({
    env: {
      hasBotToken: !!botToken,
      hasDatabaseUrl: !!databaseUrl,
      adminIdsConfigured: adminIds,
    },
    instructions: {
      step1: "Откройте Web App через Telegram бота @Suhpaybot",
      step2: "Нажмите F12 -> Console",
      step3: "Посмотрите сообщение '✅ User authenticated via Telegram:'",
      step4: "Ваш telegramId должен быть в ADMIN_TELEGRAM_IDS",
    },
    currentAdminIds: adminIds,
  });
}

// POST /api/debug/me - Check if telegramId is admin
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { telegramId } = body;
    
    const adminIds = process.env.ADMIN_TELEGRAM_IDS?.split(',').map(id => id.trim()).filter(Boolean) || [];
    const isAdmin = adminIds.includes(telegramId);
    
    return NextResponse.json({
      telegramId,
      isAdmin,
      adminIdsConfigured: adminIds,
      message: isAdmin 
        ? `✅ Telegram ID ${telegramId} является администратором` 
        : `❌ Telegram ID ${telegramId} НЕ в списке администраторов. Добавьте ${telegramId} в ADMIN_TELEGRAM_IDS в Vercel`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
