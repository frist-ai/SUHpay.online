import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// GET /api/product-requests/[id] - Get single product request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productRequest = await db.productRequest.findUnique({
      where: { id },
    });

    if (!productRequest) {
      return NextResponse.json({ error: 'Product request not found' }, { status: 404 });
    }

    return NextResponse.json(productRequest);
  } catch (error) {
    console.error('Error fetching product request:', error);
    return NextResponse.json({ error: 'Failed to fetch product request' }, { status: 500 });
  }
}

// PUT /api/product-requests/[id] - Update product request
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();

    const productRequest = await db.productRequest.update({
      where: { id },
      data: {
        status: body.status,
        adminNote: body.adminNote,
        priority: body.priority,
      },
    });

    return NextResponse.json(productRequest);
  } catch (error) {
    console.error('Error updating product request:', error);
    return NextResponse.json({ error: 'Failed to update product request' }, { status: 500 });
  }
}

// DELETE /api/product-requests/[id] - Delete product request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const { id } = await params;
    await db.productRequest.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product request:', error);
    return NextResponse.json({ error: 'Failed to delete product request' }, { status: 500 });
  }
}
