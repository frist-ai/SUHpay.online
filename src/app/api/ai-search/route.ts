import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isDatabaseConfigured, demoProducts } from '@/lib/db-utils';
import { openRouterChat } from '@/lib/openrouter';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ConversationMemory {
  messages: Message[];
  lastActivity: number;
  userId: string;
  lastFoundProducts: string[]; // Formatted "ID: Name" for "добавь" continuity
  lastFoundProductIds: string[]; // Raw IDs for DB lookups
}

interface AISearchSettings {
  enabled: boolean;
  apiKey: string;       // OpenRouter API key
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

// ─── In-memory conversation storage ────────────────────────────────────────────
const conversations = new Map<string, ConversationMemory>();
const MAX_MEMORY_SIZE = 10;
const MEMORY_TTL = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, conv] of conversations) {
    if (now - conv.lastActivity > MEMORY_TTL) conversations.delete(key);
  }
}, 60000);

// ─── Smart Query Parser ───────────────────────────────────────────────────────
interface ParsedQuery {
  intent: 'search' | 'combo' | 'cheap' | 'expensive' | 'new' | 'category' | 'help' | 'gift' | 'party' | 'add_to_cart' | 'cart_info' | 'product_info' | 'general';
  keywords: string[];
  maxPrice?: number;
  minPrice?: number;
  category?: string;
  count?: number;
  originalQuery: string;
}

function parseSmartQuery(query: string): ParsedQuery {
  const q = query.trim().toLowerCase();
  const result: ParsedQuery = {
    intent: 'search',
    keywords: [],
    originalQuery: query.trim(),
  };

  // Help
  if (/^(\/help|помощь|что умеешь|команды|что можешь)/i.test(q)) {
    return { ...result, intent: 'help' };
  }

  // Cart actions — "добавь", "убери", "положи в корзину"
  if (/^(?:добавь|положи|в корзину|добавить|добавить в корзину|закинь|положи в)/i.test(q) ||
      /(?:все|всё|это|их)\s*(?:в корзин|добавь|положи)/i.test(q) ||
      /(?:добавь|положи)\s*(?:все|всё|это|их|тоже|ещё)/i.test(q)) {
    return { ...result, intent: 'add_to_cart', keywords: q.replace(/^(?:добавь|положи|добавить|закинь)\s*(?:в\s*корзин[уы]?)?\s*/i, '').split(/\s+/).filter(w => w.length >= 2) };
  }

  // Cart info — "что в корзине", "покажи корзину", "сумма"
  if (/(?:что.*корзин|покажи.*корзин|мо[яй].*корзин|сумм[ау].*корзин|сколько.*корзин|итого)/i.test(q)) {
    return { ...result, intent: 'cart_info' };
  }

  // Product info — "расскажи про", "что за", "описание"
  if (/(?:расскажи.*про|что.*за\s|описани|характеристик|из чего|состав|расскаж|опиши)/i.test(q)) {
    return { ...result, intent: 'product_info' };
  }

  // Combo / набор
  if (/(?:набор|комбо|собери|подбери.*набор|собери.*комбо|комбинаци|ассорти)/i.test(q)) {
    result.intent = 'combo';
    const countMatch = q.match(/(\d+)\s*(?:шт|товар|позиций?|штук)/);
    if (countMatch) result.count = parseInt(countMatch[1]);
  }

  // Gift
  if (/(?:подарок|подарить|подари|для.*подарк)/i.test(q)) {
    result.intent = 'gift';
  }

  // Party
  if (/(?:компания|вечеринк|гости|на\s*компани|для\s*гостей|на\s*вечерин|праздник)/i.test(q)) {
    result.intent = 'party';
    const countMatch = q.match(/(\d+)\s*(?:человек|гостей|чел)/);
    if (countMatch) result.count = parseInt(countMatch[1]);
  }

  // Cheap
  if (/(?:дешевл|недорог|по\s*дешев|скидк|выгодн|эконом|распродаж|акция)/i.test(q)) {
    result.intent = 'cheap';
  }

  // Expensive
  if (/(?:дорог|премиум|элит|люкс|лучший|топовый|эксклюзив)/i.test(q)) {
    result.intent = 'expensive';
  }

  // New
  if (/(?:новинк|новые?\s*товар|что\s*нового|новое\s*поступлен)/i.test(q)) {
    result.intent = 'new';
  }

  // Price extraction
  const pricePatterns = [
    /(?:до|макс|не\s*дорож(?:е|е)|не\s*более|бюджет|в\s*пределах?)\s*(\d+)/i,
    /(?:от|мин)\s*(\d+)\s*(?:до|по)\s*(\d+)/i,
    /(?:по)\s*(\d+)\s*руб/i,
    /(\d+)\s*[₽руб]/i,
  ];
  for (const pattern of pricePatterns) {
    const match = q.match(pattern);
    if (match) {
      if (match[2]) {
        result.minPrice = parseInt(match[1]);
        result.maxPrice = parseInt(match[2]);
      } else {
        result.maxPrice = parseInt(match[1]);
      }
    }
  }

  // Category detection
  const categoryMap: Record<string, string[]> = {
    'напитки': ['напитк', 'сок', 'вод', 'газирован', 'лимонад', 'чай', 'кофе', 'какао', 'молок', 'кефир', 'ряженк', 'йогурт', 'смузи', 'энергетик', 'кол', 'пепси', 'спрайт', 'фанта', 'айран', 'компот', 'морс', 'квас', 'пить', 'попить', 'напиться'],
    'снеки': ['снек', 'чипс', 'сухарик', 'крекер', 'попкорн', 'орех', 'семечк', 'сушк', 'претцель', 'нагетс'],
    'сладости': ['сладост', 'шоколад', 'конфет', 'мармелад', 'зефир', 'пастил', 'халв', 'нуга', 'ириск', 'карамел', 'желейн', 'вафл', 'печень', 'пряник', 'торт', 'пирожн', 'блинчик'],
    'батончики': ['батончик', 'сникерс', 'марс', 'твикс', 'баунти', 'милквэй', 'nout', 'кофет', 'шокобар', 'cornline', 'sprint', 'yarche', 'wild'],
    'макароны/лапша': ['лапш', 'макарон', 'роллтон', 'доширак', 'бифстр', 'quick', 'круп', 'гречк', 'рис', 'овсян', 'манк', 'доширак'],
    'соусы и приправы': ['соус', 'кетчуп', 'майонез', 'горчиц', 'уксус', 'приправ', 'специи', 'соль', 'перец', 'аджик'],
    'молочная продукция': ['сыр', 'творог', 'сметан', 'сливк', 'масл', 'сузьм', 'кумыс'],
    'консервы': ['консерв', 'тушёнк', 'сард', 'сайр', 'шпрот', 'горошек', 'кукуруз', 'фасол', 'томаты', 'огурц', 'гриб'],
    'замороженное': ['заморожен', 'пельмен', 'вареник', 'пицц', 'котлет', 'фрикадел', 'замороз'],
    'хлеб и выпечка': ['хлеб', 'батон', 'лаваш', 'тортиль', 'хлебц', 'сухар'],
  };

  for (const [catName, keywords] of Object.entries(categoryMap)) {
    for (const kw of keywords) {
      if (q.includes(kw)) {
        result.category = catName;
        if (result.intent === 'search') result.intent = 'category';
        break;
      }
    }
    if (result.category) break;
  }

  // Extract keywords — keep descriptive words (остренькое, сладкое, попить), remove only grammatical filler
  const stopWords = new Set([
    'что', 'какой', 'какая', 'какие', 'где', 'есть', 'найди', 'покажи',
    'подскажи', 'посоветуй', 'хочу', 'мне', 'могу', 'можно', 'нужно', 'нужен',
    'пожалуйста', 'тоже', 'самый', 'самая', 'самое',
    'в', 'с', 'к', 'за', 'шт',
    'товаров', 'товара',
    'что-нибудь', 'что-то', 'который', 'которые',
    'может', 'могут', 'будет', 'будут', 'был', 'были', 'было',
    'этот', 'эта', 'это', 'эти', 'тот', 'того', 'как', 'так',
  ]);
  result.keywords = q
    .replace(/[/\d.,:;!?'"()\[\]{}₽]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !stopWords.has(w))
    .slice(0, 8);

  return result;
}

// ─── System Prompt ────────────────────────────────────────────────────────────
const defaultSettings: AISearchSettings = {
  enabled: true,
  apiKey: process.env.OPENROUTER_API_KEY || '',
  model: 'nvidia/nemotron-3-super-120b-a12b:free',
  maxTokens: 1200,
  temperature: 0.4,
  systemPrompt: `Ты — AI-помощник магазина "СУХ[pay]". Отвечай ТОЛЬКО на русском.

ПРАВИЛА (СТРОГО):
1. Используй ТОЛЬКО ID из списка товаров ниже. НЕ придумывай ID!
2. Выбирай товары которые ТОЧНО подходят под запрос.
3. Для показа: [ID:xxx] — покажутся карточки автоматически.
4. Для добавления в корзину: [ADD:xxx:N] — N = количество, если не указано пиши 1.
5. НЕ пиши цены, НЕ пиши текстовые списки товаров.
6. Каждый ID — только ОДИН раз.
7. Давай краткий комментарий (1-2 предложения), затем ID.
8. НЕ смешивай [ID:] и [ADD:] в одном ответе.
9. Для "добавь" используй ТОЛЬКО [ADD:], а не [ID:].
10. Отвечай КОРОТКО. Максимум 2 предложения + ID.`,
};

// ─── Settings helpers ─────────────────────────────────────────────────────────
async function getAISettings(): Promise<AISearchSettings> {
  try {
    if (!isDatabaseConfigured()) return defaultSettings;
    const setting = await db.setting.findUnique({ where: { key: 'ai_search_settings' } });
    if (!setting) return defaultSettings;
    const dbSettings = JSON.parse(setting.value) as Partial<AISearchSettings>;
    return {
      ...defaultSettings,
      ...dbSettings,
      // Prefer DB-saved API key over env var; respect user's model choice
      apiKey: dbSettings.apiKey || defaultSettings.apiKey,
      model: dbSettings.model || defaultSettings.model,
    };
  } catch (error) {
    console.error('[AI Settings] Error loading:', error);
    return defaultSettings;
  }
}

// ─── Conversation helpers ─────────────────────────────────────────────────────
function getConversation(userId: string): ConversationMemory {
  let conv = conversations.get(userId);
  if (!conv || Date.now() - conv.lastActivity > MEMORY_TTL) {
    conv = { messages: [], lastActivity: Date.now(), userId, lastFoundProducts: [], lastFoundProductIds: [] };
    conversations.set(userId, conv);
  }
  return conv;
}

function addMessage(userId: string, role: 'user' | 'assistant' | 'system', content: string) {
  const conv = getConversation(userId);
  conv.messages.push({ role, content });
  conv.lastActivity = Date.now();
  if (conv.messages.length > MAX_MEMORY_SIZE) {
    conv.messages = conv.messages.slice(-MAX_MEMORY_SIZE);
  }
}

// ─── Extract IDs & Actions ────────────────────────────────────────────────────
function extractProductIds(text: string): string[] {
  const ids: string[] = [];
  const closedRegex = /\[ID:([a-zA-Z0-9_-]+)\]/g;
  let match;
  while ((match = closedRegex.exec(text)) !== null) {
    if (!ids.includes(match[1])) ids.push(match[1]);
  }
  const unclosedRegex = /\[ID:([a-zA-Z0-9_-]+)[^\]]*$/gm;
  while ((match = unclosedRegex.exec(text)) !== null) {
    if (!ids.includes(match[1])) ids.push(match[1]);
  }
  return ids;
}

interface CartAction {
  type: 'add';
  productId: string;
  quantity: number;
  productName?: string;
  product?: any;
}

function extractCartActions(text: string, productsMap: Map<string, any>): CartAction[] {
  const actions: CartAction[] = [];
  // Match [ADD:id:N] or [ADD:id] (default qty = 1)
  const addRegex = /\[ADD:([a-zA-Z0-9_-]+)(?::(\d+))?\]/g;
  const seen = new Set<string>();
  let match;
  while ((match = addRegex.exec(text)) !== null) {
    const pid = match[1];
    if (seen.has(pid)) continue;
    seen.add(pid);
    const p = productsMap.get(pid);
    actions.push({
      type: 'add',
      productId: pid,
      quantity: match[2] ? parseInt(match[2]) : 1,
      productName: p?.name,
      product: p || null,
    });
  }
  return actions;
}

// ─── Clean response for display ───────────────────────────────────────────────
function cleanResponseForUser(text: string): string {
  let cleaned = text;
  // Remove [ADD:ID:QTY] and [ADD:ID] commands
  cleaned = cleaned.replace(/\[ADD:[a-zA-Z0-9_-]+(?::\d+)?\]/g, '');
  // Remove [ID:xxx] markers
  cleaned = cleaned.replace(/\[ID:[a-zA-Z0-9_-]+\]?/g, '');
  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '');
  // Remove article/barcode patterns
  cleaned = cleaned.replace(/(?:арт\.?|артикул|штрихкод|ean|sku)[:\s]*[\w-]+/gi, '');
  // Remove bullet-point list items (but keep short descriptions)
  cleaned = cleaned.replace(/^\s*[-•*]\s+.+$/gm, '');
  // Remove numbered lists
  cleaned = cleaned.replace(/^\s*\d+[.)]\s+.+$/gm, '');
  // Remove any price-like patterns
  cleaned = cleaned.replace(/\d[\d\s,.]*\s*[₽руб.$€leiлейу.е]+/gi, '');
  // Remove price dash patterns
  cleaned = cleaned.replace(/[—\-–]\s*\d/g, '');
  // Clean up whitespace
  cleaned = cleaned.replace(/^\s*[\n\r]+/gm, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n');
  cleaned = cleaned.replace(/^\s+|\s+$/gm, '');
  cleaned = cleaned.trim();
  if (!cleaned || cleaned.length < 3) return '';
  // Limit to 200 chars to keep it as a "comment"
  if (cleaned.length > 200) {
    const firstSentence = cleaned.match(/^[^.!?]+[.!?]/);
    cleaned = firstSentence ? firstSentence[0].trim() : cleaned.slice(0, 180).trim() + '...';
  }
  return cleaned;
}

// ─── Build intent-specific prompt ──────────────────────────────────────────────
function buildIntentPrompt(parsed: ParsedQuery, categories: string[]): string {
  switch (parsed.intent) {
    case 'combo':
      return `🎯 ЗАДАНИЕ: Собрать набор из ${parsed.count || '3-5'} товаров.
${parsed.maxPrice ? `💰 Бюджет: до ${parsed.maxPrice}₽` : ''}
${parsed.keywords.length ? `🔍 Предпочтения: ${parsed.keywords.join(', ')}` : ''}
Выбери товары которые хорошо сочетаются. Кратко опиши что за набор, затем укажи [ID:xxx] для каждого.`;

    case 'gift':
      return `🎁 ЗАДАНИЕ: Подобрать товары для подарка.
${parsed.maxPrice ? `💰 Бюджет: до ${parsed.maxPrice}₽` : ''}
${parsed.keywords.length ? `🔍 Предпочтения: ${parsed.keywords.join(', ')}` : ''}
Выбери 3-5 товаров. Кратко опиши, затем [ID:xxx].`;

    case 'party':
      return `🎉 ЗАДАНИЕ: Подобрать товары для компании${parsed.count ? ` (${parsed.count} человек)` : ''}.
${parsed.maxPrice ? `💰 Бюджет: до ${parsed.maxPrice}₽` : ''}
Снеки + напитки + сладости. Кратко опиши набор, затем [ID:xxx].`;

    case 'add_to_cart':
      return `🛒 ЗАДАНИЕ: Добавить товар(ы) в корзину.
${parsed.keywords.length ? `🔍 Что добавить: ${parsed.keywords.join(', ')}` : 'Добавь товары из предыдущего поиска пользователя.'}
Если пользователь указал конкретный товар — найди его в списке товаров и используй [ADD:ID:КОЛ].
Если сказал "все" / "это" / "всё" — добавь ВСЕ товары из раздела "ПОСЛЕДНИЙ РЕЗУЛЬТАТ ПОИСКА", по одному [ADD:ID:1] на каждый.
Если сказал "первый" / "второй" — добавь соответствующий товар из последнего результата.
НЕ используй [ID:] — только [ADD:ID:КОЛ].
Отвечай коротко: "Добавил!" + [ADD:id:N] для каждого товара.`;

    case 'cart_info':
      return `🛒 ЗАДАНИЕ: Показать содержимое корзины.
Используй [SHOW_CART]. Кратко скажи что в корзине.`;

    case 'product_info':
      return `ℹ️ ЗАДАНИЕ: Рассказать о товаре.
${parsed.keywords.length ? `🔍 Товар: ${parsed.keywords.join(', ')}` : ''}
Расскажи 1-2 предложениями: вкус, состав, для чего подходит. Укажи [ID:xxx].`;

    case 'cheap':
      return `💰 ЗАДАНИЕ: Найти самые выгодные товары.
${parsed.keywords.length ? `🔍 Тип: ${parsed.keywords.join(', ')}` : ''}
Покажи 3-5 вариантов. Кратко опиши, затем [ID:xxx].`;

    case 'expensive':
      return `✨ ЗАДАНИЕ: Найти премиум товары.
${parsed.keywords.length ? `🔍 Тип: ${parsed.keywords.join(', ')}` : ''}
Покажи 3-5 вариантов. [ID:xxx].`;

    case 'new':
      return `🆕 ЗАДАНИЕ: Показать новинки.
Укажи [ID:xxx] для найденных товаров.`;

    case 'category':
      return `📂 ЗАДАНИЕ: Найти товары в категории "${parsed.category}".
${parsed.maxPrice ? `💰 Максимум: ${parsed.maxPrice}₽` : ''}
Кратко опиши категорию/товары, затем [ID:xxx].`;

    default: {
      let prompt = `🔍 ЗАДАНИЕ: Найти товары.`;
      if (parsed.keywords.length) prompt += `\nКлючевые слова: ${parsed.keywords.join(', ')}`;
      if (parsed.maxPrice) prompt += `\n💰 Максимум: ${parsed.maxPrice}₽`;
      if (parsed.minPrice) prompt += `\n💰 Минимум: ${parsed.minPrice}₽`;
      if (parsed.category) prompt += `\n📂 Категория: ${parsed.category}`;
      prompt += `\nДай короткий комментарий, затем [ID:xxx].`;
      return prompt;
    }
  }
}

// ─── Generate AI response ─────────────────────────────────────────────────────
async function generateAIResponse(
  query: string,
  products: string,
  settings: AISearchSettings,
  userId: string,
  parsed: ParsedQuery,
  categoryNames: string[],
  clearMemory: boolean = false
): Promise<{ response: string; reasoning: string; isError?: boolean }> {
  const conv = getConversation(userId);

  if (clearMemory) {
    conv.messages = [];
  }

  // Build memory context with last found products info
  const lastFoundInfo = conv.lastFoundProducts.length > 0
    ? `\n📦 ПОСЛЕДНИЙ РЕЗУЛЬТАТ ПОИСКА (для команды "добавь"):\n${conv.lastFoundProducts.map((id, i) => `${i + 1}. ${id}`).join('\n')}`
    : '';

  const memoryContext = conv.messages.length > 0
    ? `\n\n📝 ИСТОРИЯ РАЗГОВОРА:\n${conv.messages.slice(-MAX_MEMORY_SIZE).map(m =>
        m.role === 'user' ? `👤 ${m.content}` : `🤖 ${m.content}`
      ).join('\n')}`
    : '';

  const intentPrompt = buildIntentPrompt(parsed, categoryNames);

  const userPrompt = `${memoryContext}
${lastFoundInfo}

📂 КАТЕГОРИИ: ${categoryNames.join(', ')}

📦 ТОВАРЫ:
${products}

${intentPrompt}

👤 ЗАПРОС: "${query}"`;

  try {
    const response = await openRouterChat(
      {
        apiKey: settings.apiKey,
        model: settings.model,
        maxTokens: settings.maxTokens,
        temperature: settings.temperature,
      },
      [
        { role: 'system', content: settings.systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: settings.maxTokens, temperature: settings.temperature }
    );

    const fullResponse = response || 'Не удалось получить ответ.';
    const isAPIError = fullResponse.startsWith('ERROR:');
    let readableError = '';
    if (fullResponse === 'ERROR:UNAUTHORIZED') readableError = 'AI: ошибка авторизации. Проверьте API-ключ.';
    else if (fullResponse === 'ERROR:PAYMENT_REQUIRED') readableError = 'AI: исчерпан лимит запросов.';
    else if (fullResponse === 'Не удалось получить ответ.') readableError = fullResponse;

    let reasoning = '';
    let mainResponse = fullResponse;
    const thinkingMatch = fullResponse.match(/(?:думаю|рассуждаю|анализ)[:\s]*([^]+?)(?=\n\n|Ответ:|Рекомендую|$)/i);
    if (thinkingMatch) {
      reasoning = thinkingMatch[1].trim();
      mainResponse = fullResponse.replace(thinkingMatch[0], '').trim();
    }

    addMessage(userId, 'user', query);
    if (!isAPIError) {
      addMessage(userId, 'assistant', mainResponse);
    }

    if (isAPIError) {
      return { response: readableError, reasoning: '', isError: true } as { response: string; reasoning: string; isError?: boolean };
    }

    return { response: mainResponse, reasoning };
  } catch (error) {
    console.error('AI generation error:', error);
    return { response: 'Не удалось обработать запрос. Попробуйте позже.', reasoning: '' };
  }
}

// ─── Help text ─────────────────────────────────────────────────────────────────
const HELP_TEXT = `Что я умею:

🔍 Поиск по описанию: "что-нибудь остренькое"
💰 По бюджету: "до 100₽", "от 50 до 200₽"
🎯 Наборы: "собери попить и поесть до 400₽"
🎁 Подарки: "подарок другу", "что подарить маме"
🎉 Вечеринка: "для вечеринки 5 человек"
🛒 Корзина: "добавь первый", "добавь все"
ℹ️ О товаре: "расскажи про чипсы"
📂 Категории: "напитки", "снеки", "сладости"
🆕 Новинки: "что нового"

Попробуйте!`;

// ─── POST /api/ai-search ──────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, userId = 'default', clearMemory = false, testApiKey } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Запрос не указан' }, { status: 400 });
    }

    const settings = await getAISettings();

    // Allow overriding apiKey for test requests (frontend may send unsaved key)
    if (testApiKey && !testApiKey.includes('...')) {
      settings.apiKey = testApiKey;
    }

    if (!settings.enabled) {
      return NextResponse.json({ error: 'AI поиск отключен', enabled: false }, { status: 503 });
    }
    if (!settings.apiKey) {
      return NextResponse.json({ error: 'AI не настроен. Укажите API ключ.', configured: false }, { status: 503 });
    }

    const parsed = parseSmartQuery(query);

    if (parsed.intent === 'help') {
      return NextResponse.json({
        success: true,
        response: HELP_TEXT,
        reasoning: '',
        products: [],
        productIds: [],
        cartActions: [],
        memorySize: getConversation(userId).messages.length,
        intent: 'help',
      });
    }

    // Get products — smart pre-filtering: text search in DB before sending to AI
    let products: typeof demoProducts = [];
    if (isDatabaseConfigured()) {
      const whereClause: any = { isActive: true, stock: { gt: 0 } };

      if (parsed.maxPrice) whereClause.price = { ...(whereClause.price || {}), lte: parsed.maxPrice };
      if (parsed.minPrice) whereClause.price = { ...(whereClause.price || {}), gte: parsed.minPrice };

      if (parsed.category) {
        const category = await db.category.findFirst({
          where: { name: { contains: parsed.category.split('/')[0] }, isActive: true },
        });
        if (category) whereClause.categoryId = category.id;
      }

      // Text search: filter products by name/description/attributes using extracted keywords
      const searchTerms = parsed.keywords.filter(k => k.length >= 2);
      const skipTextFilter = ['combo', 'party', 'gift', 'help', 'cheap', 'expensive', 'new', 'add_to_cart', 'cart_info'].includes(parsed.intent);

      if (searchTerms.length > 0 && !skipTextFilter) {
        const textFilters = searchTerms.map(term => ({
          OR: [
            { name: { contains: term } },
            { description: { contains: term } },
            { attributes: { contains: term } },
          ],
        }));
        whereClause.AND = textFilters;
      }

      products = await db.product.findMany({
        where: whereClause,
        include: { category: true },
        take: 30,
        orderBy: parsed.intent === 'cheap' ? { price: 'asc' }
          : parsed.intent === 'expensive' ? { price: 'desc' }
          : parsed.intent === 'new' ? { createdAt: 'desc' }
          : undefined,
      }) as any;

      // Fallback: if text search returned < 3 results, broaden to category-only filter
      if (products.length < 3 && searchTerms.length > 0 && !skipTextFilter) {
        const broadClause: any = { isActive: true, stock: { gt: 0 } };
        if (parsed.maxPrice) broadClause.price = { ...(broadClause.price || {}), lte: parsed.maxPrice };
        if (parsed.minPrice) broadClause.price = { ...(broadClause.price || {}), gte: parsed.minPrice };
        if (parsed.category) {
          const category = await db.category.findFirst({
            where: { name: { contains: parsed.category.split('/')[0] }, isActive: true },
          });
          if (category) broadClause.categoryId = category.id;
        }
        products = await db.product.findMany({
          where: broadClause,
          include: { category: true },
          take: 50,
          orderBy: parsed.intent === 'cheap' ? { price: 'asc' }
            : parsed.intent === 'expensive' ? { price: 'desc' }
            : parsed.intent === 'new' ? { createdAt: 'desc' }
            : undefined,
        }) as any;
      }
    } else {
      products = demoProducts;
    }

    // Get category names
    let categoryNames: string[] = [];
    if (isDatabaseConfigured()) {
      const cats = await db.category.findMany({ where: { isActive: true }, select: { name: true }, take: 15 });
      categoryNames = cats.map(c => c.name);
    }

    // Format products for AI — compact: ID, name, category, price, weight only
    const productsContext = products
      .map((p) => {
        const price = p.discountPrice || p.price;
        const category = p.category?.name || '';
        // Extract weight/volume from attributes if available
        let weight = '';
        try {
          const attrs = p.attributes ? JSON.parse(p.attributes) : [];
          const w = attrs.find((a: any) => /вес|объём|объем|мл|гр|л\b/i.test(a.name || ''));
          if (w) weight = ` | ${w.value}`;
        } catch {}
        return `[ID:${p.id}] ${p.name} | ${category} | ${price}₽${weight}`;
      })
      .join('\n');

    // Generate AI response
    const aiResult = await generateAIResponse(
      query, productsContext, settings, userId, parsed, categoryNames, clearMemory
    );

    // If API error — return error message directly
    if (aiResult.isError) {
      return NextResponse.json({
        success: true,
        response: aiResult.response,
        reasoning: '',
        products: [],
        productIds: [],
        cartActions: [],
        memorySize: getConversation(userId).messages.length,
        intent: parsed.intent,
        isError: true,
      });
    }

    const response = aiResult.response;
    const reasoning = aiResult.reasoning;

    // Extract product IDs — deduplicate
    const rawProductIds = extractProductIds(response);
    const productIds = [...new Set(rawProductIds)];
    const matchedProducts = products.filter((p) => productIds.includes(p.id));

    // Build products map for action resolution (use ALL products, not just matched)
    const productsMap = new Map<string, any>();
    products.forEach(p => productsMap.set(p.id, p));
    const cartActions = extractCartActions(response, productsMap);

    // For add_to_cart intent: if AI returned [ADD:...] for products not in the current DB batch,
    // try to resolve from lastFoundProductIds in conversation memory
    if (parsed.intent === 'add_to_cart' && cartActions.length === 0) {
      const conv = getConversation(userId);
      if (conv.lastFoundProductIds.length > 0) {
        const prevProducts = isDatabaseConfigured()
          ? await db.product.findMany({
              where: { id: { in: conv.lastFoundProductIds }, isActive: true },
              include: { category: true },
            }) as any[]
          : [];
        prevProducts.forEach(p => productsMap.set(p.id, p));
        const newActions = extractCartActions(response, productsMap);
        cartActions.push(...newActions);
      }
    }

    // Save last found product IDs + names to conversation memory for "добавь" continuity
    if (matchedProducts.length > 0) {
      const conv = getConversation(userId);
      conv.lastFoundProductIds = matchedProducts.map(p => p.id);
      conv.lastFoundProducts = matchedProducts.map((p, i) => `${i + 1}. [${p.id}] ${p.name}`);
    }

    // For add_to_cart intent: return matched products too for frontend context
    const responseProducts = parsed.intent === 'add_to_cart' && matchedProducts.length === 0 && cartActions.length > 0
      ? cartActions.map(a => a.product).filter(Boolean)
      : matchedProducts;

    return NextResponse.json({
      success: true,
      response: cleanResponseForUser(response),
      reasoning,
      products: responseProducts,
      productIds,
      cartActions,
      memorySize: getConversation(userId).messages.length,
      intent: parsed.intent,
    });
  } catch (error) {
    console.error('AI search error:', error);
    return NextResponse.json({ error: 'Ошибка AI поиска' }, { status: 500 });
  }
}

// ─── DELETE /api/ai-search ─────────────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default';
    conversations.delete(userId);
    return NextResponse.json({ success: true, message: 'Память очищена' });
  } catch (error) {
    console.error('Error clearing memory:', error);
    return NextResponse.json({ error: 'Ошибка очистки памяти' }, { status: 500 });
  }
}

// ─── GET /api/ai-search ───────────────────────────────────────────────────────
export async function GET() {
  try {
    const settings = await getAISettings();
    return NextResponse.json({
      enabled: settings.enabled,
      configured: !!settings.apiKey,
      model: settings.model,
      memoryEnabled: true,
      maxMemorySize: MAX_MEMORY_SIZE,
      activeConversations: conversations.size,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Ошибка' }, { status: 500 });
  }
}
