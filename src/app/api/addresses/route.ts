import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyUser } from '@/lib/auth-helpers';

// Generate unique ID
function generateId(): string {
  return `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// GET /api/addresses - Get user addresses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json([]);
    }

    if (!db) {
      return NextResponse.json([]);
    }

    // Try to find user by ID or telegramId
    let user = await db.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) {
      // Try by telegramId
      user = await db.user.findUnique({
        where: { telegramId: userId },
      });
    }
    
    if (!user) {
      return NextResponse.json([]);
    }

    const addresses = await db.address.findMany({
      where: { userId: user.id },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json(addresses);
  } catch (error) {
    console.error('Error fetching addresses:', error);
    return NextResponse.json({ error: 'Failed to fetch addresses' }, { status: 500 });
  }
}

// POST /api/addresses - Create new address
export async function POST(request: NextRequest) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await request.json();
    const { label, city, street, house, apartment, postalCode, entrance, floor, comment, isDefault } = data;
    const userId = authedUser.id;

    if (!city || !street || !house) {
      return NextResponse.json({ error: 'Missing required fields: city, street, house' }, { status: 400 });
    }

    // Server-side address format validation
    if (!/^[А-ЯЁа-яёA-Za-z\s\-\.]+$/.test(city.trim())) {
      return NextResponse.json({ error: 'Некорректный город' }, { status: 400 });
    }
    if (!/^[А-ЯЁа-яёA-Za-z0-9\s\-\.]+$/.test(street.trim())) {
      return NextResponse.json({ error: 'Некорректная улица' }, { status: 400 });
    }
    if (!/^[А-ЯЁа-яёA-Za-z0-9\s\-\/]+$/.test(house.trim())) {
      return NextResponse.json({ error: 'Некорректный номер дома' }, { status: 400 });
    }
    if (apartment && !/^[А-ЯЁа-яёA-Za-z0-9\s\-]+$/.test(apartment.trim())) {
      return NextResponse.json({ error: 'Некорректный номер квартиры' }, { status: 400 });
    }
    if (postalCode && !/^\d{6}$/.test(postalCode.trim())) {
      return NextResponse.json({ error: 'Индекс должен содержать 6 цифр' }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // verifyUser already found or validated the user — use authedUser.id directly
    const effectiveUserId = userId;

    // If setting as default, unset other defaults
    if (isDefault) {
      await db.address.updateMany({
        where: { userId: effectiveUserId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await db.address.create({
      data: {
        id: generateId(),
        userId: effectiveUserId,
        label,
        city,
        street,
        house,
        apartment,
        postalCode,
        entrance,
        floor,
        comment,
        isDefault: isDefault || false,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(address);
  } catch (error) {
    console.error('Error creating address:', error);
    return NextResponse.json({ error: 'Failed to create address' }, { status: 500 });
  }
}
