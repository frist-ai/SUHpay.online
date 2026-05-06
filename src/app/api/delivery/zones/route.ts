import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/delivery/zones - Get all delivery zones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = {};
    if (serviceId) where.serviceId = serviceId;
    if (!includeInactive) where.isActive = true;

    const zones = await db.deliveryZone.findMany({
      where,
      include: {
        deliveryService: {
          select: { id: true, name: true, code: true },
        },
        deliveryTariffs: {
          where: includeInactive ? {} : { isActive: true },
          select: { id: true, name: true, basePrice: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(zones);
  } catch (error) {
    console.error('Error fetching delivery zones:', error);
    return NextResponse.json({ error: 'Failed to fetch delivery zones' }, { status: 500 });
  }
}

// POST /api/delivery/zones - Create new delivery zone
export async function POST(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const body = await request.json();

    const zone = await db.deliveryZone.create({
      data: {
        serviceId: body.serviceId,
        name: body.name,
        code: body.code,
        cities: body.cities ? JSON.stringify(body.cities) : null,
        regions: body.regions ? JSON.stringify(body.regions) : null,
        isActive: body.isActive ?? true,
      },
      include: { deliveryService: true },
    });

    return NextResponse.json(zone, { status: 201 });
  } catch (error) {
    console.error('Error creating delivery zone:', error);
    return NextResponse.json({ error: 'Failed to create delivery zone' }, { status: 500 });
  }
}

// PUT /api/delivery/zones - Update delivery zone
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
    if (data.cities && Array.isArray(data.cities)) {
      updateData.cities = JSON.stringify(data.cities);
    }
    if (data.regions && Array.isArray(data.regions)) {
      updateData.regions = JSON.stringify(data.regions);
    }

    const zone = await db.deliveryZone.update({
      where: { id },
      data: updateData,
      include: { deliveryService: true },
    });

    return NextResponse.json(zone);
  } catch (error) {
    console.error('Error updating delivery zone:', error);
    return NextResponse.json({ error: 'Failed to update delivery zone' }, { status: 500 });
  }
}

// DELETE /api/delivery/zones - Delete delivery zone
export async function DELETE(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await db.deliveryZone.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting delivery zone:', error);
    return NextResponse.json({ error: 'Failed to delete delivery zone' }, { status: 500 });
  }
}
