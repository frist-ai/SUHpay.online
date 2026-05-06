import { NextRequest, NextResponse } from 'next/server';
import { getTelegramBot, isBotConfigured } from '@/lib/telegram-bot';
import { verifyAdmin } from '@/lib/auth-helpers';

// GET /api/telegram-bot - Get bot info and status
export async function GET() {
  try {
    if (!isBotConfigured()) {
      return NextResponse.json({
        configured: false,
        message: 'Telegram bot token not configured. Add TELEGRAM_BOT_TOKEN to .env',
      });
    }

    const bot = getTelegramBot();
    if (!bot) {
      return NextResponse.json({ error: 'Failed to initialize bot' }, { status: 500 });
    }

    // Get bot info
    const meResponse = await bot.getMe();
    if (!meResponse.ok) {
      return NextResponse.json({
        configured: true,
        error: meResponse.description || 'Failed to get bot info',
      });
    }

    // Get webhook info
    const webhookResponse = await bot.getWebhookInfo();
    const webhookInfo = webhookResponse.ok ? webhookResponse.result : null;

    // Get commands
    const commandsResponse = await bot.getMyCommands();
    const commands = commandsResponse.ok ? commandsResponse.result : [];

    return NextResponse.json({
      configured: true,
      bot: meResponse.result,
      webhook: webhookInfo,
      commands,
      webhookSecretConfigured: !!process.env.TELEGRAM_WEBHOOK_SECRET,
    });
  } catch (error) {
    console.error('Error getting bot info:', error);
    return NextResponse.json({ error: 'Failed to get bot info' }, { status: 500 });
  }
}

// POST /api/telegram-bot - Configure bot
export async function POST(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    if (!isBotConfigured()) {
      return NextResponse.json({
        error: 'Telegram bot token not configured. Add TELEGRAM_BOT_TOKEN to .env',
      }, { status: 400 });
    }

    const bot = getTelegramBot();
    if (!bot) {
      return NextResponse.json({ error: 'Failed to initialize bot' }, { status: 500 });
    }

    const body = await request.json();
    const { action, webAppUrl, commands } = body;

    switch (action) {
      case 'setWebhook': {
        if (!webAppUrl) {
          return NextResponse.json({ error: 'webAppUrl is required' }, { status: 400 });
        }
        
        // For webhook, we need a server endpoint, not the mini app URL
        // This is for receiving updates from Telegram
        const webhookUrl = `${webAppUrl}/api/telegram/webhook`;
        const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
        const response = await bot.setWebhook(webhookUrl, webhookSecret);
        
        return NextResponse.json({
          success: response.ok,
          message: response.ok 
            ? `Webhook set to ${webhookUrl} (secret: ${webhookSecret ? '✓ configured' : '✗ NOT configured — set TELEGRAM_WEBHOOK_SECRET'})` 
            : response.description || 'Failed to set webhook',
          webhookSecretConfigured: !!webhookSecret,
        });
      }

      case 'deleteWebhook': {
        const response = await bot.deleteWebhook();
        return NextResponse.json({
          success: response.ok,
          message: response.ok ? 'Webhook deleted' : response.description || 'Failed to delete webhook',
        });
      }

      case 'setCommands': {
        const defaultCommands = [
          { command: 'start', description: '🛒 Открыть магазин' },
          { command: 'catalog', description: '📦 Каталог товаров' },
          { command: 'cart', description: '🛒 Моя корзина' },
          { command: 'orders', description: '📋 Мои заказы' },
          { command: 'help', description: '❓ Помощь' },
        ];
        
        const response = await bot.setMyCommands(commands || defaultCommands);
        return NextResponse.json({
          success: response.ok,
          commands: commands || defaultCommands,
          message: response.ok ? 'Commands updated' : response.description || 'Failed to set commands',
        });
      }

      case 'sendMessage': {
        const { chatId, text, webAppButton } = body;
        if (!chatId || !text) {
          return NextResponse.json({ error: 'chatId and text are required' }, { status: 400 });
        }

        let response;
        if (webAppButton?.text && webAppButton?.url) {
          response = await bot.sendMessageWithWebApp(chatId, text, webAppButton.text, webAppButton.url);
        } else {
          response = await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        }

        return NextResponse.json({
          success: response.ok,
          message: response.ok ? 'Message sent' : response.description || 'Failed to send message',
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error configuring bot:', error);
    return NextResponse.json({ error: 'Failed to configure bot' }, { status: 500 });
  }
}
