import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-helpers';

// Demo settings
const DEMO_SETTINGS = {
  siteName: 'СУХ[pay]',
  siteDescription: 'Доставка качественных продуктов питания',
  deliveryMinAmount: '1000',
  deliveryCost: '300',
  freeDeliveryAmount: '5000',
  contactPhone: '+7 (999) 123-45-67',
  contactEmail: 'info@suhpay.ru',
  workingHours: 'Пн-Вс: 9:00 - 21:00',
  telegramBot: '@SuhpayBot',
};

// GET settings by keys
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keys = searchParams.get('keys')?.split(',') || [];

    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      // No DATABASE_URL, returning demo settings
      if (keys.length > 0) {
        const filtered: Record<string, string> = {};
        keys.forEach(key => {
          if (DEMO_SETTINGS[key as keyof typeof DEMO_SETTINGS]) {
            filtered[key] = DEMO_SETTINGS[key as keyof typeof DEMO_SETTINGS];
          }
        });
        return NextResponse.json(filtered);
      }
      return NextResponse.json(DEMO_SETTINGS);
    }

    // Try to use database
    const { db } = await import('@/lib/db');
    
    if (!db) {
      // No db client, returning demo settings
      if (keys.length > 0) {
        const filtered: Record<string, string> = {};
        keys.forEach(key => {
          if (DEMO_SETTINGS[key as keyof typeof DEMO_SETTINGS]) {
            filtered[key] = DEMO_SETTINGS[key as keyof typeof DEMO_SETTINGS];
          }
        });
        return NextResponse.json(filtered);
      }
      return NextResponse.json(DEMO_SETTINGS);
    }

    const settings = await db.setting.findMany({
      where: keys.length > 0 ? { key: { in: keys } } : undefined,
    });

    const result: Record<string, string> = {};
    settings.forEach((s) => {
      result[s.key] = s.value;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching settings:', error);
    // Return demo data on any error
    return NextResponse.json(DEMO_SETTINGS);
  }
}

// POST save setting
export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await request.json();

    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      // No DATABASE_URL, returning demo setting save
      return NextResponse.json({
        key: data.key,
        value: data.value,
        type: data.type || 'json',
      });
    }

    // Try to use database
    const { db } = await import('@/lib/db');
    
    if (!db) {
      // No db client, returning demo setting save
      return NextResponse.json({
        key: data.key,
        value: data.value,
        type: data.type || 'json',
      });
    }

    const setting = await db.setting.upsert({
      where: { key: data.key },
      update: { value: data.value },
      create: {
        key: data.key,
        value: data.value,
        type: data.type || 'json',
      },
    });

    return NextResponse.json(setting);
  } catch (error) {
    console.error('Error saving setting:', error);
    return NextResponse.json({ error: 'Error saving setting' }, { status: 500 });
  }
}
