import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// Generate unique ID
function generateId(): string {
  return `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Demo categories directly in the route
const DEMO_CATEGORIES = [
  { id: '1', name: 'Еда', slug: 'edy', description: 'Продукты питания', imageUrl: null, parentId: null, sortOrder: 1, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { products: 2 } },
  { id: '2', name: 'Напитки', slug: 'napitki', description: 'Чай, кофе, соки', imageUrl: null, parentId: null, sortOrder: 2, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { products: 1 } },
  { id: '3', name: 'Сладости', slug: 'sladosti', description: 'Конфеты и сладости', imageUrl: null, parentId: null, sortOrder: 3, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), _count: { products: 1 } },
];

// GET /api/categories
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';
    
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(DEMO_CATEGORIES);
    }

    // Try to get categories with product count
    let categories;
    const whereClause = includeInactive ? {} : { isActive: true };
    
    try {
      categories = await db.category.findMany({
        where: whereClause,
        include: {
          _count: { select: { products: true } },
        },
        orderBy: { sortOrder: 'asc' },
      });
    } catch {
      // Fallback for SQLite uppercase naming
      try {
        categories = await db.category.findMany({
          where: whereClause,
          include: {
            _count: { select: { Product: true } } as any,
          },
          orderBy: { sortOrder: 'asc' },
        });
      } catch {
        // Final fallback without count
        categories = await db.category.findMany({
          where: whereClause,
          orderBy: { sortOrder: 'asc' },
        });
      }
    }

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Categories error:', error);
    return NextResponse.json(DEMO_CATEGORIES);
  }
}

// POST /api/categories - Create new category
export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    // Create category

    // Generate slug if not provided
    const slug = body.slug || body.name?.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') || `category-${Date.now()}`;

    // Check if slug already exists
    const existingCategory = await db.category.findUnique({
      where: { slug },
    });

    if (existingCategory) {
      return NextResponse.json({ 
        error: 'Категория с таким slug уже существует' 
      }, { status: 400 });
    }

    // Create category
    const category = await db.category.create({
      data: {
        id: generateId(),
        name: body.name,
        slug: slug,
        description: body.description || null,
        imageUrl: body.imageUrl || null,
        parentId: body.parentId || null,
        sortOrder: body.sortOrder || 0,
        isActive: body.isActive ?? true,
        updatedAt: new Date(),
      },
    });

    // Category created
    return NextResponse.json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ 
      error: 'Не удалось создать категорию',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
