import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/delivery/pickup-points - Get all pickup points
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const city = searchParams.get('city');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = {};
    if (serviceId) where.serviceId = serviceId;
    if (city) where.city = { contains: city };
    if (!includeInactive) where.isActive = true;

    const pickupPoints = await db.pickupPoint.findMany({
      where,
      include: {
        deliveryService: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json(pickupPoints);
  } catch (error) {
    console.error('Error fetching pickup points:', error);
    return NextResponse.json({ error: 'Failed to fetch pickup points' }, { status: 500 });
  }
}

// POST /api/delivery/pickup-points - Create new pickup point
export async function POST(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const body = await request.json();

    const pickupPoint = await db.pickupPoint.create({
      data: {
        serviceId: body.serviceId,
        code: body.code,
        name: body.name,
        address: body.address,
        city: body.city,
        region: body.region,
        postalCode: body.postalCode,
        lat: body.lat,
        lng: body.lng,
        metro: body.metro,
        phone: body.phone,
        workHours: body.workHours ? JSON.stringify(body.workHours) : null,
        hasCard: body.hasCard ?? false,
        hasCash: body.hasCash ?? false,
        hasFitting: body.hasFitting ?? false,
        hasReturn: body.hasReturn ?? false,
        maxWeight: body.maxWeight,
        maxDimension: body.maxDimension,
        isActive: body.isActive ?? true,
      },
      include: { deliveryService: true },
    });

    return NextResponse.json(pickupPoint, { status: 201 });
  } catch (error) {
    console.error('Error creating pickup point:', error);
    return NextResponse.json({ error: 'Failed to create pickup point' }, { status: 500 });
  }
}

// PUT /api/delivery/pickup-points - Update pickup point
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
    if (data.workHours && typeof data.workHours === 'object') {
      updateData.workHours = JSON.stringify(data.workHours);
    }

    const pickupPoint = await db.pickupPoint.update({
      where: { id },
      data: updateData,
      include: { deliveryService: true },
    });

    return NextResponse.json(pickupPoint);
  } catch (error) {
    console.error('Error updating pickup point:', error);
    return NextResponse.json({ error: 'Failed to update pickup point' }, { status: 500 });
  }
}

// DELETE /api/delivery/pickup-points - Delete pickup point
export async function DELETE(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await db.pickupPoint.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pickup point:', error);
    return NextResponse.json({ error: 'Failed to delete pickup point' }, { status: 500 });
  }
}
