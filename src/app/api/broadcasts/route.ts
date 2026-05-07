import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// GET /api/broadcasts - Get all broadcasts
export async function GET(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    const where = status ? { status } : {};
    
    const broadcasts = await db.broadcast.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json(broadcasts);
  } catch (error) {
    console.error('Error fetching broadcasts:', error);
    return NextResponse.json({ error: 'Failed to fetch broadcasts' }, { status: 500 });
  }
}

// POST /api/broadcasts - Create new broadcast
export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    
    const broadcast = await db.broadcast.create({
      data: {
        title: body.title,
        message: body.message,
        imageUrl: body.imageUrl,
        linkUrl: body.linkUrl,
        targetType: body.targetType || 'all',
        status: 'draft',
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      },
    });
    
    return NextResponse.json(broadcast, { status: 201 });
  } catch (error) {
    console.error('Error creating broadcast:', error);
    return NextResponse.json({ error: 'Failed to create broadcast' }, { status: 500 });
  }
}
