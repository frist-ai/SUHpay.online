// Telegram Bot API utilities
// https://core.telegram.org/bots/api

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
  error_code?: number;
}

interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
}

interface MenuButton {
  type: 'commands' | 'web_app' | 'default';
  text?: string;
  web_app?: {
    url: string;
  };
}

interface BotCommand {
  command: string;
  description: string;
}

interface InlineKeyboardButton {
  text: string;
  web_app?: {
    url: string;
  };
  url?: string;
  callback_data?: string;
}

interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

interface ReplyKeyboardMarkup {
  keyboard: Array<Array<{
    text: string;
    web_app?: {
      url: string;
    };
  }>>;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
}

interface Message {
  message_id: number;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  date: number;
  text?: string;
  entities?: Array<{
    type: string;
    offset: number;
    length: number;
    url?: string;
  }>;
}

interface Update {
  update_id: number;
  message?: Message;
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    message?: Message;
    data?: string;
  };
}

class TelegramBot {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(method: string, params?: Record<string, unknown>): Promise<TelegramResponse<T>> {
    const url = `${TELEGRAM_API_BASE}${this.token}/${method}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: params ? JSON.stringify(params) : undefined,
    });

    return response.json();
  }

  async getMe() {
    return this.request<{
      id: number;
      is_bot: boolean;
      first_name: string;
      username: string;
      can_join_groups: boolean;
      can_read_all_group_messages: boolean;
      supports_inline_queries: boolean;
    }>('getMe');
  }

  async setWebhook(url: string, secretToken?: string) {
    const params: Record<string, unknown> = { url };
    if (secretToken) {
      params.secret_token = secretToken;
    }
    return this.request<boolean>('setWebhook', params);
  }

  async deleteWebhook() {
    return this.request<boolean>('deleteWebhook');
  }

  async getWebhookInfo() {
    return this.request<WebhookInfo>('getWebhookInfo');
  }

  async setMyCommands(commands: BotCommand[]) {
    return this.request<boolean>('setMyCommands', { commands });
  }

  async getMyCommands() {
    return this.request<BotCommand[]>('getMyCommands');
  }

  async setChatMenuButton(chatId?: number, menuButton?: MenuButton) {
    const params: Record<string, unknown> = {};
    if (chatId) params.chat_id = chatId;
    if (menuButton) params.menu_button = menuButton;
    return this.request<boolean>('setChatMenuButton', params);
  }

  async sendMessage(
    chatId: number | string,
    text: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
      disable_web_page_preview?: boolean;
      disable_notification?: boolean;
      reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup;
    }
  ) {
    return this.request<Message>('sendMessage', {
      chat_id: chatId,
      text,
      ...options,
    });
  }

  async sendMessageWithWebApp(
    chatId: number | string,
    text: string,
    buttonText: string,
    webAppUrl: string
  ) {
    return this.request<Message>('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: buttonText,
              web_app: { url: webAppUrl },
            },
          ],
        ],
      },
    });
  }

  async sendPhoto(
    chatId: number | string,
    photo: string,
    caption?: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    }
  ) {
    return this.request<Message>('sendPhoto', {
      chat_id: chatId,
      photo,
      caption,
      ...options,
    });
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert?: boolean) {
    return this.request<boolean>('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  }

  async getUpdates(offset?: number, limit?: number, timeout?: number) {
    const params: Record<string, unknown> = {};
    if (offset) params.offset = offset;
    if (limit) params.limit = limit;
    if (timeout) params.timeout = timeout;
    return this.request<Update[]>('getUpdates', params);
  }
}

let botInstance: TelegramBot | null = null;

export function getTelegramBot(): TelegramBot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return null;
  }
  if (!botInstance) {
    botInstance = new TelegramBot(token);
  }
  return botInstance;
}

export function isBotConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

export type { 
  TelegramBot, 
  TelegramResponse, 
  WebhookInfo, 
  MenuButton, 
  BotCommand, 
  Message, 
  Update,
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup 
};
