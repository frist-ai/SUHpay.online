import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { verifyAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Telegram API helper
async function telegramApi(method: string, params?: Record<string, unknown>) {
  if (!env.telegramBotToken) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
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

// Save or update user in database
async function saveUser(telegramUser: {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}) {
  if (!db) {
    console.warn('Database not configured, skipping user save');
    return null;
  }

  try {
    const telegramId = telegramUser.id.toString();
    const isAdmin = env.isAdmin(telegramId);
    
    // Upsert user
    const user = await db.user.upsert({
      where: { telegramId },
      create: {
        telegramId,
        username: telegramUser.username || null,
        firstName: telegramUser.first_name || null,
        lastName: telegramUser.last_name || null,
        languageCode: telegramUser.language_code || null,
        role: isAdmin ? 'admin' : 'customer',
        lastVisitAt: new Date(),
        authDate: new Date(),
      },
      update: {
        username: telegramUser.username || null,
        firstName: telegramUser.first_name || null,
        lastName: telegramUser.last_name || null,
        languageCode: telegramUser.language_code || null,
        role: isAdmin ? 'admin' : 'customer',
        lastVisitAt: new Date(),
      },
    });

    // User saved
    return user;
  } catch (error) {
    console.error('Error saving user:', error);
    return null;
  }
}

// Get base URL (without timestamp)
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

// Get Web App URL with timestamp for cache busting
function getWebAppUrl(request: NextRequest): string {
  const baseUrl = getBaseUrl(request);
  // Add timestamp to force Telegram to reload the app every time
  const timestamp = Date.now();
  return `${baseUrl}?t=${timestamp}`;
}

// GET - Setup webhook (admin only)
export async function GET(request: NextRequest) {
  // Require admin authentication
  const { user: adminUser, error: authError } = await verifyAdmin(request);
  if (authError) return authError;

  if (!env.isBotConfigured) {
    return NextResponse.json({
      error: 'Bot not configured',
      message: 'Set TELEGRAM_BOT_TOKEN environment variable',
    }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const webAppUrl = getWebAppUrl(request);

  // Get webhook info
  if (action === 'info') {
    const info = await telegramApi('getWebhookInfo');
    return NextResponse.json({
      ...info,
      webAppUrl,
    });
  }

  // Delete webhook
  if (action === 'delete') {
    const result = await telegramApi('deleteWebhook');
    return NextResponse.json(result);
  }

  // Set webhook
  const baseUrl = getBaseUrl(request);
  const webhookUrl = `${baseUrl}/api/telegram/webhook`;

  const webhookParams: Record<string, unknown> = { url: webhookUrl };
  const webhookSecret = env.telegramWebhookSecret;
  if (webhookSecret) {
    webhookParams.secret_token = webhookSecret;
  }

  const webhookResult = await telegramApi('setWebhook', webhookParams);
  
  // Set bot commands
  await telegramApi('setMyCommands', {
    commands: [
      { command: 'start', description: '🛒 Открыть магазин' },
      { command: 'help', description: '📚 Справка' },
      { command: 'admin', description: '🔐 Админ-панель (только для админов)' },
    ]
  });

  // Set bot description
  await telegramApi('setMyDescription', {
    description: '🛒 СУХ[pay] - доставка качественных продуктов питания. Заказывайте легко через Telegram!',
  });

  await telegramApi('setMyShortDescription', {
    short_description: '🛒 Магазин продуктов с доставкой',
  });

  return NextResponse.json({
    ok: true,
    webhook: webhookResult,
    webhookUrl,
    webAppUrl,
    webhookSecretConfigured: !!webhookSecret,
    message: webhookSecret 
      ? 'Webhook configured successfully with secret token ✓' 
      : 'Webhook configured but WITHOUT secret token ⚠️ Set TELEGRAM_WEBHOOK_SECRET for security',
  });
}

// POST - Handle Telegram updates
export async function POST(request: NextRequest) {
  if (!env.isBotConfigured) {
    return NextResponse.json({ ok: true, error: 'Bot not configured' });
  }

  // ── Validate webhook secret token ──
  // TELEGRAM_WEBHOOK_SECRET must be set as an environment variable.
  // Telegram sends it back in the X-Telegram-Bot-Api-Secret-Token header.
  // If no secret is configured on the server, requests are rejected for security.
  const incomingSecret = request.headers.get('x-telegram-bot-api-secret-token');
  const expectedSecret = env.telegramWebhookSecret;

  if (!expectedSecret) {
    console.error('TELEGRAM_WEBHOOK_SECRET not configured — rejecting webhook request');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  if (!incomingSecret || incomingSecret !== expectedSecret) {
    console.warn('Webhook request with invalid secret — rejected');
    return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 403 });
  }

  try {
    const update = await request.json();
    
    // Handle message
    if (update.message?.text) {
      return handleMessage(update.message, request);
    }
    
    // Handle callback query
    if (update.callback_query) {
      return handleCallback(update.callback_query);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

// Handle incoming messages
async function handleMessage(message: any, request: NextRequest) {
  const chatId = message.chat.id;
  const user = message.from;
  const text = message.text;
  const webAppUrl = getWebAppUrl(request);

  // Save user to database
  await saveUser(user);

  const isAdmin = env.isAdmin(user.id);
  const telegramId = user.id.toString();

  // /start command
  if (text.startsWith('/start')) {
    return handleStartCommand(chatId, user, webAppUrl, text);
  }

  // /help command
  if (text === '/help') {
    return handleHelpCommand(chatId, isAdmin);
  }

  // /admin command
  if (text === '/admin') {
    return handleAdminCommand(chatId, user, webAppUrl);
  }

  // Unknown command - show menu
  return handleUnknownCommand(chatId, webAppUrl, isAdmin);
}

// Handle /start command
async function handleStartCommand(
  chatId: number, 
  user: any, 
  webAppUrl: string,
  text: string
) {
  const isAdmin = env.isAdmin(user.id);
  const startParam = text.split(' ')[1]; // Deep linking parameter
  
  // Build Web App URL with user data (NO is_admin - security: determined by server only)
  const webAppData = new URLSearchParams({
    user_id: user.id.toString(),
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    username: user.username || '',
    auth_date: Math.floor(Date.now() / 1000).toString(),
  });

  if (startParam) {
    webAppData.set('start_param', startParam);
  }

  const fullWebAppUrl = `${webAppUrl}&${webAppData.toString()}`;

  // Admin gets direct access to both store and admin panel
  if (isAdmin) {
    const adminWelcomeText = `
🔐 <b>Добро пожаловать, Администратор!</b>

${user.first_name ? user.first_name + ', в' : 'В'}ы вошли как <b>администратор</b>.

<b>Роль: Администратор</b>
Доступ предоставлен сразу в <b>Магазин</b> и <b>Админ-панель</b>.

<b>Ваши права:</b>
✅ Управление товарами и категориями
✅ Обработка заказов
✅ Настройка доставки
✅ Рассылки и опросы
✅ Просмотр статистики

<i>Переключение между режимами — через меню внизу экрана</i>
    `.trim();

    // Single button for admin - opens app with full access
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: adminWelcomeText,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { 
            text: '🚀 Открыть', 
            web_app: { url: fullWebAppUrl }
          }
        ]],
      }
    });
  } else {
    // Regular user message
    const userWelcomeText = `
🛒 <b>Добро пожаловать в СУХ[pay]!</b>

${user.first_name ? user.first_name + ', в' : 'В'}аш личный магазин продуктов с доставкой.

<b>Что умеет бот:</b>
📦 Просмотр каталога товаров
🛒 Добавление в корзину
🚚 Оформление заказов
❤️ Избранные товары
📋 История заказов

<b>Нажмите кнопку ниже, чтобы открыть магазин:</b>
    `.trim();

    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: userWelcomeText,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { 
            text: '🛒 Открыть магазин', 
            web_app: { url: fullWebAppUrl }
          }
        ]],
      }
    });
  }

  return NextResponse.json({ ok: true });
}

// Handle /help command
async function handleHelpCommand(chatId: number, isAdmin: boolean) {
  let helpText = `
📚 <b>Справка по боту СУХ[pay]</b>

<b>Основные команды:</b>
/start — Открыть магазин
/help — Эта справка

<b>Как сделать заказ:</b>
1️⃣ Нажмите "Открыть магазин"
2️⃣ Выберите товары в каталоге
3️⃣ Добавьте в корзину
4️⃣ Оформите заказ

<b>Доставка:</b>
🚚 Курьером по городу
📍 Самовывоз из пунктов выдачи

<b>Оплата:</b>
💳 Telegram Payments
💳 Банковская карта

<b>Нужна помощь?</b>
Обратитесь к администратору магазина.
  `.trim();

  if (isAdmin) {
    helpText += `

🔐 <b>Команды администратора:</b>
/admin — Открыть админ-панель
• Управление товарами
• Обработка заказов
• Статистика и аналитика
• Рассылки клиентам
    `;
  }

  await telegramApi('sendMessage', {
    chat_id: chatId,
    text: helpText,
    parse_mode: 'HTML',
  });

  return NextResponse.json({ ok: true });
}

// Handle /admin command
async function handleAdminCommand(
  chatId: number, 
  user: any, 
  webAppUrl: string
) {
  const isAdmin = env.isAdmin(user.id);

  if (!isAdmin) {
    await telegramApi('sendMessage', {
      chat_id: chatId,
      text: `
⛔ <b>Доступ запрещён</b>

У вас нет прав для доступа к админ-панели.

Если вы считаете, что это ошибка, обратитесь к владельцу бота.
      `.trim(),
      parse_mode: 'HTML',
    });
    return NextResponse.json({ ok: true });
  }

  // Build admin Web App URL (NO is_admin - security: determined by server only)
  const webAppData = new URLSearchParams({
    user_id: user.id.toString(),
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    username: user.username || '',
    auth_date: Math.floor(Date.now() / 1000).toString(),
  });

  const fullWebAppUrl = `${webAppUrl}&${webAppData.toString()}`;

  await telegramApi('sendMessage', {
    chat_id: chatId,
    text: `
🔐 <b>Админ-панель</b>

Вы вошли как: <b>${user.first_name || 'Администратор'}</b>
Telegram ID: <code>${user.id}</code>

<b>Роль: Администратор</b>
Доступ предоставлен сразу в <b>Магазин</b> и <b>Админ-панель</b>.

<i>Переключение между режимами — через меню внизу экрана</i>
    `.trim(),
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { 
          text: '🚀 Открыть', 
          web_app: { url: fullWebAppUrl }
        }
      ]],
    }
  });

  return NextResponse.json({ ok: true });
}

// Handle unknown commands
async function handleUnknownCommand(
  chatId: number, 
  webAppUrl: string,
  isAdmin: boolean
) {
  // NO is_admin in URL - security: determined by server only
  const fullWebAppUrl = webAppUrl;

  await telegramApi('sendMessage', {
    chat_id: chatId,
    text: isAdmin 
      ? '🤖 Нажмите кнопку ниже, чтобы открыть приложение:'
      : '🤒 Выберите действие:',
    reply_markup: {
      inline_keyboard: [[
        { 
          text: isAdmin ? '🚀 Открыть' : '🛒 Открыть магазин', 
          web_app: { url: fullWebAppUrl }
        }
      ]],
    }
  });

  return NextResponse.json({ ok: true });
}

// Handle callback queries
async function handleCallback(callbackQuery: any) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  // Answer callback query to remove loading state
  await telegramApi('answerCallbackQuery', {
    callback_query_id: callbackQuery.id,
  });

  // Handle different callback actions
  // Add more callback handlers as needed

  return NextResponse.json({ ok: true });
}
