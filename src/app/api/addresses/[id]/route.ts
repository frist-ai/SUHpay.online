import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyUser } from '@/lib/auth-helpers';

// GET /api/addresses/[id] - Get single address
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }
    
    const { id } = await params;
    const address = await db.address.findUnique({
      where: { id },
    });

    if (!address) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    return NextResponse.json(address);
  } catch (error) {
    console.error('Error fetching address:', error);
    return NextResponse.json({ error: 'Failed to fetch address' }, { status: 500 });
  }
}

// PUT /api/addresses/[id] - Update address
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }
    
    const { id } = await params;
    const data = await request.json();
    const { label, city, street, house, apartment, postalCode, entrance, floor, comment, isDefault } = data;

    // Get current address to verify ownership
    const currentAddress = await db.address.findUnique({
      where: { id },
    });

    if (!currentAddress) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    // Verify ownership
    if (currentAddress.userId !== authedUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const effectiveUserId = currentAddress.userId;

    // If setting as default, unset other defaults
    if (isDefault && effectiveUserId) {
      await db.address.updateMany({
        where: { userId: effectiveUserId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (label !== undefined) updateData.label = label;
    if (city !== undefined) {
      if (!city.trim()) return NextResponse.json({ error: 'Укажите город' }, { status: 400 });
      if (!/^[А-ЯЁа-яёA-Za-z\s\-\.]+$/.test(city.trim())) return NextResponse.json({ error: 'Некорректный город' }, { status: 400 });
      updateData.city = city.trim();
    }
    if (street !== undefined) {
      if (!street.trim()) return NextResponse.json({ error: 'Укажите улицу' }, { status: 400 });
      if (!/^[А-ЯЁа-яёA-Za-z0-9\s\-\.]+$/.test(street.trim())) return NextResponse.json({ error: 'Некорректная улица' }, { status: 400 });
      updateData.street = street.trim();
    }
    if (house !== undefined) {
      if (!house.trim()) return NextResponse.json({ error: 'Укажите номер дома' }, { status: 400 });
      if (!/^[А-ЯЁа-яёA-Za-z0-9\s\-\/]+$/.test(house.trim())) return NextResponse.json({ error: 'Некорректный номер дома' }, { status: 400 });
      updateData.house = house.trim();
    }
    if (apartment !== undefined) {
      if (apartment.trim() && !/^[А-ЯЁа-яёA-Za-z0-9\s\-]+$/.test(apartment.trim())) return NextResponse.json({ error: 'Некорректный номер квартиры' }, { status: 400 });
      updateData.apartment = apartment;
    }
    if (postalCode !== undefined) {
      if (postalCode.trim() && !/^\d{6}$/.test(postalCode.trim())) return NextResponse.json({ error: 'Индекс должен содержать 6 цифр' }, { status: 400 });
      updateData.postalCode = postalCode;
    }
    if (entrance !== undefined) updateData.entrance = entrance;
    if (floor !== undefined) updateData.floor = floor;
    if (comment !== undefined) updateData.comment = comment;
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    const address = await db.address.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(address);
  } catch (error) {
    console.error('Error updating address:', error);
    return NextResponse.json({ error: 'Failed to update address' }, { status: 500 });
  }
}

// DELETE /api/addresses/[id] - Delete address
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }
    
    const { id } = await params;

    // Verify ownership
    const address = await db.address.findUnique({
      where: { id },
    });

    if (!address) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    if (address.userId !== authedUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.address.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting address:', error);
    return NextResponse.json({ error: 'Failed to delete address' }, { status: 500 });
  }
}
