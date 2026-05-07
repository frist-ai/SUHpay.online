import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// GET /api/categories/[id] - Get single category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const category = await db.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
        children: true,
      },
    });

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    return NextResponse.json({ error: 'Failed to fetch category' }, { status: 500 });
  }
}

// PUT /api/categories/[id] - Update category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    // Check for circular reference (parent can't be a descendant)
    if (body.parentId) {
      const checkCircular = async (catId: string, parentId: string): Promise<boolean> => {
        if (catId === parentId) return true;
        const parent = await db.category.findUnique({
          where: { id: parentId },
          select: { parentId: true },
        });
        if (!parent || !parent.parentId) return false;
        return checkCircular(catId, parent.parentId);
      };

      const isCircular = await checkCircular(id, body.parentId);
      if (isCircular) {
        return NextResponse.json(
          { error: 'Circular reference detected - a category cannot be its own descendant' },
          { status: 400 }
        );
      }
    }

    const category = await db.category.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        imageUrl: body.imageUrl,
        parentId: body.parentId || null,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }
}

// DELETE /api/categories/[id] - Delete category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Check if category has children
    const children = await db.category.count({
      where: { parentId: id },
    });

    if (children > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with subcategories' },
        { status: 400 }
      );
    }

    // Check if category has products
    const products = await db.product.count({
      where: { categoryId: id },
    });

    if (products > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with products. Remove or reassign products first.' },
        { status: 400 }
      );
    }

    await db.category.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 });
  }
}
