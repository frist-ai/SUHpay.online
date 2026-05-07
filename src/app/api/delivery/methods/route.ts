import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/delivery/methods - Get all delivery methods
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = {};
    if (serviceId) where.serviceId = serviceId;
    if (!includeInactive) where.isActive = true;

    const methods = await db.deliveryMethod.findMany({
      where,
      include: {
        deliveryService: {
          select: { id: true, name: true, code: true },
        },
        deliveryTariffs: {
          where: includeInactive ? {} : { isActive: true },
          select: { id: true, name: true, basePrice: true, freeFrom: true },
        },
      },
      orderBy: [{ deliveryService: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });

    return NextResponse.json(methods);
  } catch (error) {
    console.error('Error fetching delivery methods:', error);
    return NextResponse.json({ error: 'Failed to fetch delivery methods' }, { status: 500 });
  }
}

// POST /api/delivery/methods - Create new delivery method
export async function POST(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const body = await request.json();

    const method = await db.deliveryMethod.create({
      data: {
        name: body.name,
        code: body.code.toLowerCase().replace(/\s+/g, '_'),
        serviceId: body.serviceId,
        description: body.description,
        isActive: body.isActive ?? true,
        minHours: body.minHours ?? 1,
        maxHours: body.maxHours ?? 7,
        hasTracking: body.hasTracking ?? true,
        requiresAddress: body.requiresAddress ?? false,
        requiresPickup: body.requiresPickup ?? false,
        sortOrder: body.sortOrder ?? 0,
      },
      include: { deliveryService: true },
    });

    return NextResponse.json(method, { status: 201 });
  } catch (error) {
    console.error('Error creating delivery method:', error);
    return NextResponse.json({ error: 'Failed to create delivery method' }, { status: 500 });
  }
}

// PUT /api/delivery/methods - Update delivery method
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
    if (data.code) {
      updateData.code = data.code.toLowerCase().replace(/\s+/g, '_');
    }

    const method = await db.deliveryMethod.update({
      where: { id },
      data: updateData,
      include: { deliveryService: true },
    });

    return NextResponse.json(method);
  } catch (error) {
    console.error('Error updating delivery method:', error);
    return NextResponse.json({ error: 'Failed to update delivery method' }, { status: 500 });
  }
}

// DELETE /api/delivery/methods - Delete delivery method
export async function DELETE(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await db.deliveryMethod.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting delivery method:', error);
    return NextResponse.json({ error: 'Failed to delete delivery method' }, { status: 500 });
  }
}
