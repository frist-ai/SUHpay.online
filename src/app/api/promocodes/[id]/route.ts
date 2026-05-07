import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// GET single promocode
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const promocode = await db.promocode.findUnique({
      where: { id },
    });

    if (!promocode) {
      return NextResponse.json({ error: 'Promocode not found' }, { status: 404 });
    }

    return NextResponse.json(promocode);
  } catch (error) {
    console.error('Error fetching promocode:', error);
    return NextResponse.json({ error: 'Error fetching promocode' }, { status: 500 });
  }
}

// PUT update promocode
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const data = await request.json();

    // Check if new code conflicts with existing
    if (data.code) {
      const existing = await db.promocode.findFirst({
        where: {
          code: data.code.toUpperCase(),
          NOT: { id },
        },
      });

      if (existing) {
        return NextResponse.json({ error: 'Промокод уже существует' }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    
    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.discountType !== undefined) updateData.discountType = data.discountType;
    if (data.discountValue !== undefined) updateData.discountValue = data.discountValue;
    if (data.minOrder !== undefined) updateData.minOrder = data.minOrder;
    if (data.maxDiscount !== undefined) updateData.maxDiscount = data.maxDiscount;
    if (data.usageLimit !== undefined) updateData.usageLimit = data.usageLimit;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.startsAt !== undefined) updateData.startsAt = data.startsAt ? new Date(data.startsAt) : null;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

    const promocode = await db.promocode.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(promocode);
  } catch (error) {
    console.error('Error updating promocode:', error);
    return NextResponse.json({ error: 'Error updating promocode' }, { status: 500 });
  }
}

// DELETE promocode
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    
    await db.promocode.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting promocode:', error);
    return NextResponse.json({ error: 'Error deleting promocode' }, { status: 500 });
  }
}
