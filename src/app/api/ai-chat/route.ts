import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isDatabaseConfigured, demoProducts } from '@/lib/db-utils';
import { openRouterChat } from '@/lib/openrouter';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface ConversationMemory {
  messages: Message[];
  lastActivity: number;
  userId: string;
}

interface AIChatSettings {
  enabled: boolean;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  discountPrice: number | null;
  stock: number;
}

interface ParsedAction {
  type: 'add_to_cart' | 'remove_from_cart' | 'show_cart' | 'clear_cart' | 'search' | 'none';
  productId?: string;
  quantity?: number;
  query?: string;
}

// ─── In-memory conversation storage ────────────────────────────────────────────
const conversations = new Map<string, ConversationMemory>();
const MAX_MEMORY_SIZE = 10;
const MEMORY_TTL = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, conv] of conversations) {
    if (now - conv.lastActivity > MEMORY_TTL) {
      conversations.delete(key);
    }
  }
}, 60000);

// ─── System Prompt ────────────────────────────────────────────────────────────
const DEFAULT_SYSTEM_PROMPT = `Ты — умный AI-помощник магазина "СУХ[pay]" с памятью.

🧠 ТВОИ ВОЗМОЖНОСТИ:
• Запоминаешь контекст разговора (до 10 последних сообщений)
• Помогаешь с выбором товаров и даёшь рекомендации
• Управляешь корзиной: добавляешь и удаляешь товары
• Отвечаешь на вопросы о магазине, доставке, оплате
• Собираешь наборы и комбо
• Подбираешь подарки
• Помогаешь с выбором по бюджету

📋 АЛГОРИТМ РАБОТЫ:
1. Проанализируй запрос пользователя
2. Вспомни контекст предыдущих сообщений
3. Выполни действие если нужно (добавить в корзину, поиск)
4. Сформируй краткий ответ

🛒 УПРАВЛЕНИЕ КОРЗИНОЙ:
• "добавь чипсы" → [ADD:ID_ТОВАРА:1] (кол-во по умолчанию 1)
• "добавь 3 батончика" → [ADD:ID_ТОВАРА:3]
• "убери сникерс" → [REMOVE:ID_ТОВАРА]
• "что в корзине" / "покажи корзину" → [SHOW_CART]
• "очисти корзину" → [CLEAR_CART]
• "ещё один" / "+1" → добавь последний добавленный товар
• "добавь всё" → добавь все товары из последнего поиска

🔍 ПРАВИЛА ПОИСКА ТОВАРОВ:
• Найденные товары отмечай ТОЛЬКО через [ID:xxx] — карточки появятся автоматически
• ЗАПРЕЩЕНО перечислять товары текстом, списками или как-либо ещё
• ЗАПРЕЩЕНО указывать цены — они есть на карточках
• Предлагай альтернативы если точного совпадения нет

💬 ФОРМАТ ОТВЕТА:
• Кратко — 1-2 предложения
• Команды действий ставь в отдельной строке в конце ответа
• Используй эмодзи умеренно
• Для наборов/комбо: укажи все товары через [ID:xxx]

📦 ФОРМАТ КОМАНД (СТАВЬ В КОНЦЕ ОТВЕТА):
- [ADD:ID_ТОВАРА:КОЛИЧЕСТВО] — добавить товар
- [REMOVE:ID_ТОВАРА] — удалить товар
- [SHOW_CART] — показать корзину
- [CLEAR_CART] — очистить корзину
- [SEARCH:запрос] — выполнить поиск

🏪 ИНФОРМАЦИЯ О МАГАЗИНЕ:
• "СУХ[pay]" — доставка продуктов и товаров
• Оплата: наличными при получении, онлайн (карта, СБП)
• Доставка: курьер, самовывоз
• Время доставки: уточняй при заказе
• Если спрашивают про то чего не знаешь — честно скажи что не уверен и предложи связаться с поддержкой`;

// ─── Default Settings ─────────────────────────────────────────────────────────
const defaultSettings: AIChatSettings = {
  enabled: true,
  apiKey: process.env.OPENROUTER_API_KEY || '',
  model: 'nvidia/nemotron-3-super-120b-a12b:free',
  maxTokens: 1500,
  temperature: 0.7,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};

// ─── Settings helpers ─────────────────────────────────────────────────────────
async function getAISettings(): Promise<AIChatSettings> {
  try {
    if (!isDatabaseConfigured()) return defaultSettings;
    const setting = await db.setting.findUnique({ where: { key: 'ai_chat_settings' } });
    if (!setting) return defaultSettings;
    const dbSettings = JSON.parse(setting.value) as Partial<AIChatSettings>;
    return {
      ...defaultSettings,
      ...dbSettings,
      apiKey: defaultSettings.apiKey,
      model: dbSettings.model?.includes(':free') ? dbSettings.model : defaultSettings.model,
    };
  } catch (error) {
    console.error('[AI Chat] Error loading settings:', error);
    return defaultSettings;
  }
}

// ─── Conversation helpers ─────────────────────────────────────────────────────
function getConversation(userId: string): ConversationMemory {
  let conv = conversations.get(userId);
  if (!conv || Date.now() - conv.lastActivity > MEMORY_TTL) {
    conv = { messages: [], lastActivity: Date.now(), userId };
    conversations.set(userId, conv);
  }
  return conv;
}

function addMessage(userId: string, role: 'user' | 'assistant' | 'system', content: string) {
  const conv = getConversation(userId);
  conv.messages.push({ role, content, timestamp: Date.now() });
  conv.lastActivity = Date.now();
  if (conv.messages.length > MAX_MEMORY_SIZE) {
    conv.messages = conv.messages.slice(-MAX_MEMORY_SIZE);
  }
}

// ─── Action parser ────────────────────────────────────────────────────────────
function parseActions(text: string): { cleanedText: string; actions: ParsedAction[]; productIds: string[] } {
  const actions: ParsedAction[] = [];

  // [ADD:productId:quantity]
  const addRegex = /\[ADD:([a-zA-Z0-9_-]+):(\d+)\]/g;
  let match;
  while ((match = addRegex.exec(text)) !== null) {
    actions.push({ type: 'add_to_cart', productId: match[1], quantity: parseInt(match[2], 10) });
  }

  // [REMOVE:productId]
  const removeRegex = /\[REMOVE:([a-zA-Z0-9_-]+)\]/g;
  while ((match = removeRegex.exec(text)) !== null) {
    actions.push({ type: 'remove_from_cart', productId: match[1] });
  }

  // [SHOW_CART]
  if (/\[SHOW_CART\]/.test(text)) actions.push({ type: 'show_cart' });

  // [CLEAR_CART]
  if (/\[CLEAR_CART\]/.test(text)) actions.push({ type: 'clear_cart' });

  // [SEARCH:query]
  const searchRegex = /\[SEARCH:(.+?)\]/g;
  while ((match = searchRegex.exec(text)) !== null) {
    actions.push({ type: 'search', query: match[1] });
  }

  // Extract product IDs: [ID:xxx]
  const productIds: string[] = [];
  const idRegex = /\[ID:([a-zA-Z0-9_-]+)\]/g;
  while ((match = idRegex.exec(text)) !== null) {
    productIds.push(match[1]);
  }

  // Clean text
  const cleanedText = text
    .replace(/\[ADD:[a-zA-Z0-9_-]+:\d+\]/g, '')
    .replace(/\[REMOVE:[a-zA-Z0-9_-]+\]/g, '')
    .replace(/\[SHOW_CART\]/g, '')
    .replace(/\[CLEAR_CART\]/g, '')
    .replace(/\[SEARCH:.+?\]/g, '')
    .replace(/\[ID:[a-zA-Z0-9_-]+\]/g, '')
    .trim();

  return { cleanedText, actions, productIds };
}

// ─── Product fetcher ──────────────────────────────────────────────────────────
async function getProducts(): Promise<typeof demoProducts> {
  if (isDatabaseConfigured()) {
    return db.product.findMany({
      where: { isActive: true },
      include: { category: true },
      take: 100,
    }) as any;
  }
  return demoProducts;
}

// ─── Cart context builder ─────────────────────────────────────────────────────
function buildCartContext(cart: CartItem[]): string {
  if (cart.length === 0) return '🛒 Корзина пуста.';

  const total = cart.reduce((sum, item) => {
    const price = item.discountPrice || item.price;
    return sum + price * item.quantity;
  }, 0);

  const items = cart
    .map(item => {
      const price = item.discountPrice || item.price;
      const lineTotal = price * item.quantity;
      return `  • [ID:${item.productId}] ${item.name} — ${item.quantity}шт × ${price}₽ = ${lineTotal}₽`;
    })
    .join('\n');

  return `🛒 ТЕКУЩАЯ КОРЗИНА (${cart.length} товаров, итого: ${total.toLocaleString('ru-RU')}₽):\n${items}`;
}

// ─── Generate AI response ─────────────────────────────────────────────────────
async function generateAIResponse(
  query: string,
  products: string,
  cartContext: string,
  settings: AIChatSettings,
  userId: string,
): Promise<{ response: string; actions: ParsedAction[]; productIds: string[] }> {
  const conv = getConversation(userId);

  const memoryContext = conv.messages.length > 0
    ? `\n\n📝 ИСТОРИЯ РАЗГОВОРА:\n${conv.messages.slice(-MAX_MEMORY_SIZE).map(m =>
        m.role === 'user' ? `👤 Пользователь: ${m.content}` : `🤖 Помощник: ${m.content}`
      ).join('\n')}`
    : '';

  const userPrompt = `${memoryContext}

${cartContext}

👤 ЗАПРОС: "${query}"

📦 ДОСТУПНЫЕ ТОВАРЫ:
${products}

🤔 ЗАДАНИЕ:
1. Проанализируй запрос и контекст разговора
2. Если просят добавить/убрать товар → [ADD:ID:КОЛ] или [REMOVE:ID]
3. Если спрашивают про корзину → [SHOW_CART]
4. Найди подходящие товары → [ID:xxx]
5. Дай короткий ответ (1-2 предложения)
6. Команды basket ставь в конце ответа`;

  try {
    const response = await openRouterChat(
      settings,
      [
        { role: 'system', content: settings.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        model: settings.model,
        maxTokens: settings.maxTokens,
        temperature: settings.temperature,
      }
    );

    if (!response || response.startsWith('ERROR:')) {
      const errorMap: Record<string, string> = {
        'ERROR:UNAUTHORIZED': 'Неверный API ключ.',
        'ERROR:PAYMENT_REQUIRED': 'Исчерпан лимит запросов.',
      };
      const errorKey = response || '';
      const errorMsg = errorMap[errorKey] || 'Не удалось получить ответ от AI.';
      return { response: errorMsg, actions: [], productIds: [] };
    }

    const fullResponse = response;
    const { cleanedText, actions } = parseActions(fullResponse);
    const productIds: string[] = [];
    const idRegex = /\[ID:([a-zA-Z0-9_-]+)\]/g;
    let m;
    while ((m = idRegex.exec(fullResponse)) !== null) {
      productIds.push(m[1]);
    }

    addMessage(userId, 'user', query);
    addMessage(userId, 'assistant', cleanedText);

    return { response: cleanedText, actions, productIds };
  } catch (error) {
    console.error('[AI Chat] Generation error:', error);
    addMessage(userId, 'user', query);
    addMessage(userId, 'assistant', 'Произошла ошибка.');
    return { response: 'Не удалось обработать запрос. Попробуйте позже.', actions: [], productIds: [] };
  }
}

// ─── POST /api/ai-chat ───────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, userId = 'default', cart = [] } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Сообщение не указано' }, { status: 400 });
    }

    const settings = await getAISettings();
    if (!settings.enabled) {
      return NextResponse.json({ error: 'AI помощник отключён', enabled: false }, { status: 503 });
    }

    if (!settings.apiKey) {
      return NextResponse.json({
        error: 'AI не настроен. Укажите API ключ.',
        configured: false
      }, { status: 503 });
    }

    const products = await getProducts();
    const productsContext = products
      .filter(p => p.stock > 0)
      .map((p) => {
        const price = p.discountPrice || p.price;
        const category = p.category?.name || 'Без категории';
        const attrs = p.attributes ? ` | ${p.attributes}` : '';
        return `[ID:${p.id}] ${p.name} | ${category} | ${price}₽ | остаток: ${p.stock}${attrs}`;
      })
      .join('\n');

    const cartContext = buildCartContext(cart as CartItem[]);

    const { response, actions, productIds } = await generateAIResponse(
      message,
      productsContext,
      cartContext,
      settings,
      userId,
    );

    const matchedProducts = products.filter((p) => productIds.includes(p.id));

    const resolvedActions = actions.map(action => {
      if ((action.type === 'add_to_cart' || action.type === 'remove_from_cart') && action.productId) {
        const product = products.find(p => p.id === action.productId);
        if (product) {
          return {
            ...action,
            productName: product.name,
            price: product.discountPrice || product.price,
            stock: product.stock,
          };
        }
      }
      return action;
    });

    const conv = getConversation(userId);

    return NextResponse.json({
      success: true,
      response,
      actions: resolvedActions,
      products: matchedProducts,
      memorySize: conv.messages.length,
      memoryTTL: MEMORY_TTL,
    });
  } catch (error) {
    console.error('[AI Chat] Error:', error);
    return NextResponse.json({ error: 'Ошибка AI помощника' }, { status: 500 });
  }
}

// ─── GET /api/ai-chat ────────────────────────────────────────────────────────
export async function GET() {
  try {
    const settings = await getAISettings();
    const hasCredentials = !!settings.apiKey;
    return NextResponse.json({
      enabled: settings.enabled,
      configured: hasCredentials,
      model: settings.model,
      memoryEnabled: true,
      maxMemorySize: MAX_MEMORY_SIZE,
      memoryTTL: MEMORY_TTL,
      activeConversations: conversations.size,
    });
  } catch (error) {
    console.error('[AI Chat] Error:', error);
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 });
  }
}

// ─── DELETE /api/ai-chat — Clear memory ──────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default';
    conversations.delete(userId);
    return NextResponse.json({ success: true, message: 'Память очищена' });
  } catch (error) {
    console.error('[AI Chat] Error clearing memory:', error);
    return NextResponse.json({ error: 'Ошибка очистки памяти' }, { status: 500 });
  }
}
