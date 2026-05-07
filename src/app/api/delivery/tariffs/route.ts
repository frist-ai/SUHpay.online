import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/delivery/tariffs - Get all delivery tariffs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const methodId = searchParams.get('methodId');
    const zoneId = searchParams.get('zoneId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = {};
    if (methodId) where.methodId = methodId;
    if (zoneId) where.zoneId = zoneId;
    if (!includeInactive) where.isActive = true;

    const tariffs = await db.deliveryTariff.findMany({
      where,
      include: {
        deliveryMethod: {
          select: { id: true, name: true, code: true, serviceId: true },
        },
        deliveryZone: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(tariffs);
  } catch (error) {
    console.error('Error fetching delivery tariffs:', error);
    return NextResponse.json({ error: 'Failed to fetch delivery tariffs' }, { status: 500 });
  }
}

// POST /api/delivery/tariffs - Create new delivery tariff
export async function POST(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const body = await request.json();

    const tariff = await db.deliveryTariff.create({
      data: {
        methodId: body.methodId,
        zoneId: body.zoneId,
        name: body.name,
        basePrice: body.basePrice ?? 0,
        freeFrom: body.freeFrom,
        weightLimit: body.weightLimit,
        volumeLimit: body.volumeLimit,
        pricePerKg: body.pricePerKg,
        minPrice: body.minPrice,
        maxPrice: body.maxPrice,
        priceBySize: body.priceBySize ? JSON.stringify(body.priceBySize) : null,
        isActive: body.isActive ?? true,
      },
      include: { deliveryMethod: true, deliveryZone: true },
    });

    return NextResponse.json(tariff, { status: 201 });
  } catch (error) {
    console.error('Error creating delivery tariff:', error);
    return NextResponse.json({ error: 'Failed to create delivery tariff' }, { status: 500 });
  }
}

// PUT /api/delivery/tariffs - Update delivery tariff
export async function PUT(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { ...data };
    if (data.priceBySize && typeof data.priceBySize === 'object') {
      updateData.priceBySize = JSON.stringify(data.priceBySize);
    }

    const tariff = await db.deliveryTariff.update({
      where: { id },
      data: updateData,
      include: { deliveryMethod: true, deliveryZone: true },
    });

    return NextResponse.json(tariff);
  } catch (error) {
    console.error('Error updating delivery tariff:', error);
    return NextResponse.json({ error: 'Failed to update delivery tariff' }, { status: 500 });
  }
}

// DELETE /api/delivery/tariffs - Delete delivery tariff
export async function DELETE(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await db.deliveryTariff.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting delivery tariff:', error);
    return NextResponse.json({ error: 'Failed to delete delivery tariff' }, { status: 500 });
  }
}
