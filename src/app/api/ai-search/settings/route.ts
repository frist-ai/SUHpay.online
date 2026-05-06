import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isDatabaseConfigured } from '@/lib/db-utils';
import { verifyAdmin } from '@/lib/auth-helpers';

interface AISearchSettings {
  enabled: boolean;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

const defaultSettings: AISearchSettings = {
  enabled: true,
  apiKey: process.env.OPENROUTER_API_KEY || '',
  model: 'nvidia/nemotron-3-super-120b-a12b:free',
  maxTokens: 1500,
  temperature: 0.7,
  systemPrompt: `Ты — умный AI-помощник магазина "СУХ[pay]". Ты помогаешь искать товары, собирать наборы и управлять корзиной.

🧠 ТВОИ ВОЗМОЖНОСТИ:
• Ищешь товары по названию, категории, бюджету
• Собираешь комбо-наборы (напитки + еда, для вечеринки, подарки)
• Рассказываешь о товарах: вкус, состав, характеристики
• Добавляешь товары в корзину по запросу
• Помнишь контекст разговора — можно искать, потом просить добавить

📋 ПРАВИЛА ФОРМАТА:
1. Для ПОИСКА и ПРОСМОТРА товаров используй ТОЛЬКО [ID:xxx] — карточки покажутся автоматически
2. Для ДОБАВЛЕНИЯ в корзину используй ТОЛЬКО [ADD:xxx:N] где N = количество
3. НЕ смешивай [ID:] и [ADD:] в одном ответе! Либо показываешь карточки, либо добавляешь
4. НЕ дублируй одни и те же ID — каждый товар только один раз
5. МОЖНО кратко описать товар (1 фраза): вкус, что внутри
6. МОЖНО дать короткий комментарий к результату
7. ЗАПРЕЩЕНО писать списки товаров текстом, указывать цены

🛒 ДОБАВЛЕНИЕ В КОРЗИНУ:
• Формат ОБЯЗАТЕЛЬНО: [ADD:ID:КОЛИЧЕСТВО] — количество ВСЕГДА указывай!
• "добавь первый" → [ADD:id_первого_товара:1]
• "добавь все" / "добавь это" → [ADD:id1:1] [ADD:id2:1] [ADD:id3:1] ...
• "добавь 2 сникерса" → [ADD:id_сникерса:2]
• Если количество не указано — пиши :1 (один товар)
• Для добавления НЕ используй [ID:], только [ADD:id:N]
• Помни последний поиск — пользователь может сначала искать, потом просить добавить
• IDs последних найденных товаров указаны в блоке "ПОСЛЕДНИЙ РЕЗУЛЬТАТ ПОИСКА"

💡 ПРИМЕРЫ ОТВЕТОВ:
• Поиск: "Нашёл 3 варианта! [ID:abc] [ID:def] [ID:ghi]"
• Набор: "Для вечеринки: чипсы + кола + батончики. [ID:a] [ID:b] [ID:c]"
• Добавить: "Добавил! [ADD:abc:1] [ADD:def:2]"
• Про товар: "Сникерс — шоколадный батончик с нугой и карамелью. [ID:abc]"

⚠️ ВАЖНО: Каждый товар указывай ТОЛЬКО ОДИН РАЗ. Не повторяй один и тот же ID.`,
};

// GET /api/ai-search/settings - Get AI search settings
export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({
        ...defaultSettings,
        apiKey: `${defaultSettings.apiKey.substring(0, 12)}...`,
        hasCredentials: !!defaultSettings.apiKey,
      });
    }

    const setting = await db.setting.findUnique({
      where: { key: 'ai_search_settings' },
    });

    if (!setting) {
      return NextResponse.json({
        ...defaultSettings,
        apiKey: `${defaultSettings.apiKey.substring(0, 12)}...`,
        hasCredentials: !!defaultSettings.apiKey,
      });
    }

    const settings = JSON.parse(setting.value) as Partial<AISearchSettings>;

    // Don't expose full secret
    const safeSettings = {
      ...defaultSettings,
      ...settings,
      apiKey: settings.apiKey ? `${settings.apiKey.substring(0, 12)}...` : '',
      hasCredentials: !!settings.apiKey,
    };

    return NextResponse.json(safeSettings);
  } catch (error) {
    console.error('Error getting AI settings:', error);
    return NextResponse.json({ error: 'Ошибка получения настроек' }, { status: 500 });
  }
}

// POST /api/ai-search/settings - Update AI search settings
export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'База данных не настроена' }, { status: 503 });
    }

    const body = await request.json();

    // Get existing settings
    const existing = await db.setting.findUnique({
      where: { key: 'ai_search_settings' },
    });

    let currentSettings: AISearchSettings = existing
      ? JSON.parse(existing.value) as AISearchSettings
      : defaultSettings;

    // Update settings (preserve apiKey if not provided or masked; allow clearing with empty string)
    const newSettings: AISearchSettings = {
      enabled: body.enabled ?? currentSettings.enabled,
      apiKey: typeof body.apiKey === 'string' && !body.apiKey.includes('...')
        ? body.apiKey
        : currentSettings.apiKey,
      model: body.model || currentSettings.model,
      maxTokens: body.maxTokens ?? currentSettings.maxTokens,
      temperature: body.temperature ?? currentSettings.temperature,
      systemPrompt: body.systemPrompt || currentSettings.systemPrompt,
    };

    // Save to database
    await db.setting.upsert({
      where: { key: 'ai_search_settings' },
      update: { value: JSON.stringify(newSettings) },
      create: {
        id: 'ai_search_settings',
        key: 'ai_search_settings',
        value: JSON.stringify(newSettings)
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Настройки сохранены',
    });
  } catch (error) {
    console.error('Error saving AI settings:', error);
    return NextResponse.json({ error: 'Ошибка сохранения настроек' }, { status: 500 });
  }
}

// DELETE /api/ai-search/settings - Reset AI search settings
export async function DELETE(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'База данных не настроена' }, { status: 503 });
    }

    await db.setting.upsert({
      where: { key: 'ai_search_settings' },
      update: { value: JSON.stringify(defaultSettings) },
      create: {
        id: 'ai_search_settings',
        key: 'ai_search_settings',
        value: JSON.stringify(defaultSettings)
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Настройки сброшены',
    });
  } catch (error) {
    console.error('Error resetting AI settings:', error);
    return NextResponse.json({ error: 'Ошибка сброса настроек' }, { status: 500 });
  }
}
