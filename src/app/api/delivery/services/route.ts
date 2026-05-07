import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/delivery/services - Get all delivery services
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const services = await db.deliveryService.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        _count: {
          select: { deliveryMethods: true, pickupPoints: true, deliveryZones: true },
        },
        deliveryMethods: {
          where: includeInactive ? {} : { isActive: true },
          select: { id: true, name: true, code: true, isActive: true },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching delivery services:', error);
    return NextResponse.json({ error: 'Failed to fetch delivery services' }, { status: 500 });
  }
}

// POST /api/delivery/services - Create new delivery service
export async function POST(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const body = await request.json();

    const service = await db.deliveryService.create({
      data: {
        name: body.name,
        code: body.code.toLowerCase().replace(/\s+/g, '_'),
        description: body.description,
        logoUrl: body.logoUrl,
        type: body.type || 'courier',
        apiUrl: body.apiUrl,
        apiKey: body.apiKey,
        account: body.account,
        password: body.password,
        isActive: body.isActive ?? true,
        isDefault: body.isDefault ?? false,
        sortOrder: body.sortOrder ?? 0,
        settings: body.settings ? JSON.stringify(body.settings) : null,
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error('Error creating delivery service:', error);
    return NextResponse.json({ error: 'Failed to create delivery service' }, { status: 500 });
  }
}

// PUT /api/delivery/services - Update delivery service
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
    if (data.settings && typeof data.settings === 'object') {
      updateData.settings = JSON.stringify(data.settings);
    }
    if (data.code) {
      updateData.code = data.code.toLowerCase().replace(/\s+/g, '_');
    }

    const service = await db.deliveryService.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(service);
  } catch (error) {
    console.error('Error updating delivery service:', error);
    return NextResponse.json({ error: 'Failed to update delivery service' }, { status: 500 });
  }
}

// DELETE /api/delivery/services - Delete delivery service
export async function DELETE(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await db.deliveryService.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting delivery service:', error);
    return NextResponse.json({ error: 'Failed to delete delivery service' }, { status: 500 });
  }
}
