import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

// Demo products directly in the route for fallback
const DEMO_PRODUCTS = [
  { id: '1', sku: 'SUP-001', name: 'Гречка "Алтайская" 800г', slug: 'grechka-altayskaya-800g', description: 'Гречневая крупа высшего сорта', price: 120, purchasePrice: 75, discountPrice: 99, currency: 'RUB', categoryId: '1', stock: 150, skuCount: 50, rating: 4.8, reviewCount: 24, isActive: true, isFeatured: true, isNew: false, attributes: null, images: '[]', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), category: { id: '1', name: 'Еда', slug: 'edy', description: 'Продукты питания', imageUrl: null, parentId: null, sortOrder: 1, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
  { id: '2', sku: 'SUP-002', name: 'Тушёнка говяжья 525г', slug: 'tushenka-govyazhya-525g', description: 'Натуральная говяжья тушёнка', price: 350, purchasePrice: 220, discountPrice: null, currency: 'RUB', categoryId: '1', stock: 80, skuCount: 30, rating: 4.9, reviewCount: 56, isActive: true, isFeatured: true, isNew: true, attributes: null, images: '[]', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), category: { id: '1', name: 'Еда', slug: 'edy', description: 'Продукты питания', imageUrl: null, parentId: null, sortOrder: 1, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
  { id: '3', sku: 'SUP-003', name: 'Чай чёрный 100г', slug: 'chay-chernyy-100g', description: 'Качественный чёрный чай', price: 85, purchasePrice: 40, discountPrice: null, currency: 'RUB', categoryId: '2', stock: 200, skuCount: 100, rating: 4.5, reviewCount: 18, isActive: true, isFeatured: false, isNew: false, attributes: null, images: '[]', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), category: { id: '2', name: 'Напитки', slug: 'napitki', description: 'Чай, кофе, соки', imageUrl: null, parentId: null, sortOrder: 2, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
  { id: '4', sku: 'SUP-004', name: 'Сгущёнка 380г', slug: 'sgushchenka-380g', description: 'Сгущённое молоко с сахаром', price: 95, purchasePrice: 55, discountPrice: null, currency: 'RUB', categoryId: '3', stock: 120, skuCount: 60, rating: 4.7, reviewCount: 32, isActive: true, isFeatured: false, isNew: true, attributes: null, images: '[]', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), category: { id: '3', name: 'Сладости', slug: 'sladosti', description: 'Конфеты и сладости', imageUrl: null, parentId: null, sortOrder: 3, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
  { id: '5', sku: 'SUP-005', name: 'Сухарики "Кириешки" 100г', slug: 'suhariki-kirieshki-100g', description: 'Сухарики со вкусом бекона', price: 45, purchasePrice: 22, discountPrice: null, currency: 'RUB', categoryId: '1', stock: 0, skuCount: 0, rating: 4.2, reviewCount: 8, isActive: true, isFeatured: false, isNew: false, attributes: null, images: '[]', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), category: { id: '1', name: 'Еда', slug: 'edy', description: 'Продукты питания', imageUrl: null, parentId: null, sortOrder: 1, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
];

// GET /api/products - Get all products
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ids = searchParams.get('ids');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  const search = searchParams.get('search');
  const categoryId = searchParams.get('categoryId');
  const excludeId = searchParams.get('excludeId');
  const includeInactive = searchParams.get('all') === 'true';
  const includeCategory = searchParams.get('includeCategory') !== 'false'; // default true for backward compat
  const featuredOnly = searchParams.get('featured') === 'true';
  
  try {
    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      // No DATABASE_URL, returning demo products
      // Filter by IDs if provided
      let products = DEMO_PRODUCTS;
      if (ids) {
        const idList = ids.split(',').filter(Boolean);
        products = DEMO_PRODUCTS.filter(p => idList.includes(p.id));
      }
      // Filter by categoryId if provided
      if (categoryId) {
        products = products.filter(p => p.categoryId === categoryId);
      }
      // Exclude specific product ID if provided
      if (excludeId) {
        products = products.filter(p => p.id !== excludeId);
      }
      // Filter by stock for regular users (not admin)
      if (!includeInactive) {
        products = products.filter(p => p.stock > 0);
      }
      // Filter featured only
      if (featuredOnly) {
        products = products.filter(p => p.isFeatured);
      }
      return NextResponse.json({
        products,
        total: products.length,
        limit,
        offset,
        hasMore: false,
      });
    }

    // Try to use database
    const { db } = await import('@/lib/db');
    
    if (!db) {
      // No db client, returning demo products
      let products = DEMO_PRODUCTS;
      if (ids) {
        const idList = ids.split(',').filter(Boolean);
        products = DEMO_PRODUCTS.filter(p => idList.includes(p.id));
      }
      // Filter by categoryId if provided
      if (categoryId) {
        products = products.filter(p => p.categoryId === categoryId);
      }
      // Exclude specific product ID if provided
      if (excludeId) {
        products = products.filter(p => p.id !== excludeId);
      }
      // Filter by stock for regular users (not admin)
      if (!includeInactive) {
        products = products.filter(p => p.stock > 0);
      }
      return NextResponse.json({
        products,
        total: products.length,
        limit,
        offset,
        hasMore: false,
      });
    }

    const where: Record<string, unknown> = {};
    
    // Filter by IDs (for favorites)
    if (ids) {
      const idList = ids.split(',').filter(Boolean);
      where.id = { in: idList };
    }
    
    // Filter by categoryId
    if (categoryId) {
      where.categoryId = categoryId;
    }

    // Exclude specific product ID (e.g., current product for related products)
    if (excludeId) {
      where.id = { ...((where.id as Record<string, unknown>) || {}), not: excludeId };
    }
    
    // For admin panel, show all products including inactive and out of stock
    if (!includeInactive) {
      where.isActive = true;
      // Hide products out of stock for regular users
      where.stock = { gt: 0 };
    }
    
    // Filter featured only
    if (featuredOnly) {
      where.isFeatured = true;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Only include category when needed (saves DB query time)
    const include = includeCategory ? { category: true } : undefined;

    const products = await db.product.findMany({
      where,
      include,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const total = await db.product.count({ where });

    return NextResponse.json({
      products,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Products error:', error);
    // Return demo data on error, filtered by IDs if provided
    let products = DEMO_PRODUCTS;
    if (ids) {
      const idList = ids.split(',').filter(Boolean);
      products = DEMO_PRODUCTS.filter(p => idList.includes(p.id));
    }
    // Filter by categoryId if provided
    if (categoryId) {
      products = products.filter(p => p.categoryId === categoryId);
    }
    // Exclude specific product ID if provided
    if (excludeId) {
      products = products.filter(p => p.id !== excludeId);
    }
    // Filter by stock for regular users (not admin)
    if (!includeInactive) {
      products = products.filter(p => p.stock > 0);
    }
    return NextResponse.json({
      products,
      total: products.length,
      limit,
      offset,
      hasMore: false,
    });
  }
}

// Generate unique ID
function generateId(): string {
  return `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Convert name to slug
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Helper function to generate a unique slug
async function generateUniqueSlug(db: any, baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db.product.findFirst({
      where: { slug },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// POST /api/products - Create new product
export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { db } = await import('@/lib/db');
    
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    const body = await request.json();
    
    // Generate slug from name if not provided, ensure uniqueness
    const baseSlug = body.slug
      ? nameToSlug(body.slug)
      : nameToSlug(body.name || '');
    const slug = await generateUniqueSlug(db, baseSlug || `p-${Date.now().toString(36)}`);

    const product = await db.product.create({
      data: {
        id: generateId(),
        sku: body.sku,
        name: body.name,
        slug,
        description: body.description || null,
        price: parseFloat(body.price) || 0,
        purchasePrice: body.purchasePrice ? parseFloat(body.purchasePrice) : null,
        discountPrice: body.discountPrice ? parseFloat(body.discountPrice) : null,
        currency: body.currency || 'RUB',
        categoryId: body.categoryId,
        stock: parseInt(body.stock) || 0,
        skuCount: parseInt(body.skuCount) || 0,
        isActive: body.isActive ?? true,
        isFeatured: body.isFeatured ?? false,
        isNew: body.isNew ?? false,
        images: body.images || null,
        attributes: body.attributes || null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { error: 'Failed to create product', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
