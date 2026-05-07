import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// GET all promocodes
export async function GET(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const promocodes = await db.promocode.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(promocodes);
  } catch (error) {
    console.error('Error fetching promocodes:', error);
    return NextResponse.json({ error: 'Error fetching promocodes' }, { status: 500 });
  }
}

// POST create promocode
export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await request.json();

    // Check if code already exists
    const existing = await db.promocode.findUnique({
      where: { code: data.code.toUpperCase() },
    });

    if (existing) {
      return NextResponse.json({ error: 'Промокод уже существует' }, { status: 400 });
    }

    const promocode = await db.promocode.create({
      data: {
        code: data.code.toUpperCase(),
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrder: data.minOrder || null,
        maxDiscount: data.maxDiscount || null,
        usageLimit: data.usageLimit || null,
        usageCount: 0,
        isActive: true,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });

    return NextResponse.json(promocode);
  } catch (error) {
    console.error('Error creating promocode:', error);
    return NextResponse.json({ error: 'Error creating promocode' }, { status: 500 });
  }
}
