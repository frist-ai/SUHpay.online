import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// GET /api/staff - List all staff members or check by telegramId
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const telegramId = searchParams.get('telegramId');

    if (telegramId) {
      // Check if a specific telegramId is in the staff table
      const staff = await db.staff.findUnique({
        where: { telegramId: String(telegramId) },
      });
      return NextResponse.json(staff || null);
    }

    const staff = await db.staff.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
  }
}

// POST /api/staff - Create new staff member
export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { telegramId, role, name } = body;

    if (!telegramId) {
      return NextResponse.json({ error: 'Telegram ID обязателен' }, { status: 400 });
    }

    // Check for duplicate telegram ID
    const existing = await db.staff.findUnique({
      where: { telegramId: String(telegramId) },
    });

    if (existing) {
      return NextResponse.json({ error: 'Уже существует участник с таким Telegram ID' }, { status: 409 });
    }

    const staff = await db.staff.create({
      data: {
        telegramId: String(telegramId),
        role: role || 'collector',
        name: name || null,
      },
    });

    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 });
  }
}

// DELETE /api/staff - Remove staff member by ID
export async function DELETE(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID обязателен' }, { status: 400 });
    }

    await db.staff.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting staff:', error);
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 });
  }
}
