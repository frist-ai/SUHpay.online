import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// GET /api/product-requests - Get all product requests
export async function GET(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const popular = searchParams.get('popular') === 'true';
    const recent = searchParams.get('recent') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    let orderBy: Record<string, unknown> = { createdAt: 'desc' };
    if (popular) orderBy = { priority: 'desc' };

    const requests = await db.productRequest.findMany({
      where,
      orderBy,
      take: limit,
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching product requests:', error);
    return NextResponse.json({ error: 'Failed to fetch product requests' }, { status: 500 });
  }
}

// POST /api/product-requests - Create new product request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telegramId, userId, name, description, category, quantity } = body;

    if (!telegramId || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if similar request exists (by exact name match, case-insensitive for SQLite)
    const allRequests = await db.productRequest.findMany({
      where: { status: { not: 'rejected' } },
    });
    
    const normalizedName = name.trim().toLowerCase();
    const existingRequest = allRequests.find(
      (r: { name: string }) => r.name.toLowerCase() === normalizedName
    );

    if (existingRequest) {
      // Increment priority (popularity) of existing request
      const updated = await db.productRequest.update({
        where: { id: existingRequest.id },
        data: { priority: (existingRequest as { priority: number }).priority + 1 },
      });
      return NextResponse.json({ 
        ...updated, 
        isDuplicate: true,
        message: 'Запрос уже существует, мы увеличили его приоритет' 
      });
    }

    const productRequest = await db.productRequest.create({
      data: {
        telegramId,
        userId,
        name: name.trim(),
        description: description?.trim() || null,
        category: category?.trim() || null,
        quantity: quantity || null,
        priority: 1,
      },
    });

    return NextResponse.json(productRequest, { status: 201 });
  } catch (error) {
    console.error('Error creating product request:', error);
    return NextResponse.json({ error: 'Failed to create product request' }, { status: 500 });
  }
}
