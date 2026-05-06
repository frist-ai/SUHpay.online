import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { verifyAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// Demo banners for fallback
const DEMO_BANNERS = [
  { id: '1', title: 'Добро пожаловать в СУХ[pay]', subtitle: 'Доставка качественных продуктов питания', imageUrl: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=800', linkUrl: '/catalog', linkType: 'category', sortOrder: 1, isActive: true, startDate: null, endDate: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: '2', title: 'Акция! Скидки на тушёнку', subtitle: 'Только свежая продукция', imageUrl: 'https://images.unsplash.com/photo-1594282684113-015fe34c20f7?w=800', linkUrl: '/catalog', linkType: 'category', sortOrder: 2, isActive: true, startDate: null, endDate: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

// GET /api/banners - Get active banners
export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(DEMO_BANNERS);
    }

    const banners = await db.banner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(banners);
  } catch (error) {
    console.error('Banners error:', error);
    return NextResponse.json(DEMO_BANNERS);
  }
}

// POST /api/banners - Create new banner
export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    const banner = await db.banner.create({
      data: {
        id: nanoid(),
        title: body.title,
        subtitle: body.subtitle || null,
        imageUrl: body.imageUrl,
        linkUrl: body.linkUrl || null,
        linkType: body.linkType || 'category',
        sortOrder: body.sortOrder || 0,
        isActive: body.isActive ?? true,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(banner);
  } catch (error) {
    console.error('Error creating banner:', error);
    return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 });
  }
}
