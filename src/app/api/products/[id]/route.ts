import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import path from 'path';
import { verifyAdmin } from '@/lib/auth-helpers';

// Helper function to generate a unique slug
async function generateUniqueSlug(baseSlug: string, excludeId?: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db.product.findFirst({
      where: {
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
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

// GET /api/products/[id] - Get product by ID or slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const product = await db.product.findFirst({
      where: {
        OR: [
          { id },
          { slug: id },
          { sku: id },
        ],
        isActive: true,
      },
      include: {
        category: true,
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get related products from same category (only active + in stock)
    const relatedProducts = await db.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: product.id },
        isActive: true,
        stock: { gt: 0 },
      },
      take: 6,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ...product, relatedProducts });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

// PUT /api/products/[id] - Update product
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

    // Get current product
    const currentProduct = await db.product.findUnique({
      where: { id },
    });

    if (!currentProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Handle slug update
    let slug = currentProduct.slug;
    
    if (body.name && body.name !== currentProduct.name) {
      // Name changed — новый slug только если получилась непустая строка (кириллица даёт «пустой» slug)
      const baseSlug = body.slug ? nameToSlug(body.slug) : nameToSlug(body.name);
      if (baseSlug) {
        slug = await generateUniqueSlug(baseSlug, id);
      }
    } else if (body.slug && body.slug !== currentProduct.slug) {
      const baseSlug = nameToSlug(body.slug);
      if (baseSlug) {
        slug = await generateUniqueSlug(baseSlug, id);
      }
    }
    
    // Handle image deletion - delete files that are no longer in the list
    if (body.images !== undefined && currentProduct.images) {
      try {
        const oldImages: string[] = JSON.parse(currentProduct.images);
        const newImages: string[] = JSON.parse(body.images || '[]');
        
        // Find images that were removed
        const removedImages = oldImages.filter(img => !newImages.includes(img));
        
        // Delete removed image files
        for (const imageUrl of removedImages) {
          if (imageUrl.startsWith('/uploads/')) {
            const filePath = path.join(process.cwd(), 'public', imageUrl);
            
            if (existsSync(filePath)) {
              await unlink(filePath);
            }
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }

    // undefined в Prisma = «не менять поле»; null = явно очистить. Нельзя подставлять null, если ключ не пришёл в теле (массовые PATCH только с isActive).
    const purchasePrice =
      body.purchasePrice === undefined
        ? undefined
        : body.purchasePrice === null
          ? null
          : parseFloat(String(body.purchasePrice));
    const discountPrice =
      body.discountPrice === undefined
        ? undefined
        : body.discountPrice === null
          ? null
          : parseFloat(String(body.discountPrice));

    // Auto-hide product when stock reaches 0
    const newStock = body.stock !== undefined ? parseInt(String(body.stock), 10) || 0 : currentProduct.stock;
    const shouldAutoHide = newStock === 0 && currentProduct.isActive;
    const finalIsActive = body.isActive !== undefined ? body.isActive : (shouldAutoHide ? false : undefined);

    const product = await db.product.update({
      where: { id },
      data: {
        name: body.name,
        slug,
        sku: body.sku,
        description: body.description,
        price: body.price !== undefined ? parseFloat(String(body.price)) || 0 : undefined,
        purchasePrice,
        discountPrice,
        categoryId: body.categoryId,
        stock: body.stock !== undefined ? newStock : undefined,
        skuCount: body.skuCount !== undefined ? parseInt(String(body.skuCount), 10) || 0 : undefined,
        isActive: finalIsActive,
        isFeatured: body.isFeatured,
        isNew: body.isNew,
        attributes: body.attributes,
        images: body.images,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ 
      error: 'Failed to update product', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/products/[id] - Delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const forceDelete = searchParams.get('force') === 'true';
    
    // Get product first to check conditions
    const product = await db.product.findUnique({
      where: { id },
    });
    
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    
    // Check if product is active — cannot delete active products
    if (product.isActive) {
      return NextResponse.json({ error: 'Нельзя удалить активный товар. Сначала скройте его.' }, { status: 400 });
    }
    
    // Check if product is already archived (SKU starts with ARCHIVED-) — allow force delete
    const isArchived = product.sku?.startsWith('ARCHIVED-');
    
    // Check if product has order items
    const orderItemsCount = await db.orderItem.count({
      where: { productId: id },
    });
    
    if (orderItemsCount > 0 && !isArchived && !forceDelete) {
      // Product has orders and not yet archived — do soft delete first
      // Use full ID + timestamp to avoid SKU unique constraint collisions
      const archivedSku = `ARCHIVED-${id}-${Date.now()}`;
      await db.product.update({
        where: { id },
        data: {
          stock: 0,
          sku: archivedSku,
        },
      });
      
      return NextResponse.json({ 
        success: true, 
        softDelete: true,
        message: 'Товар заархивирован (есть в заказах). Нажмите "Удалить" ещё раз для полного удаления из каталога. Данные заказов будут сохранены.' 
      });
    }
    
    // Hard delete: archived product or force delete or no orders
    // Delete image files
    if (product.images) {
      try {
        const images: string[] = JSON.parse(product.images);
        
        for (const imageUrl of images) {
          if (imageUrl.startsWith('/uploads/')) {
            const filePath = path.join(process.cwd(), 'public', imageUrl);
            
            if (existsSync(filePath)) {
              await unlink(filePath);
            }
          }
        }
      } catch {
        // Ignore JSON parse errors
      }
    }
    
    // Delete dependent records first (but NOT order items — orders are immutable records)
    await db.cartItem.deleteMany({ where: { productId: id } });
    await db.favorite.deleteMany({ where: { productId: id } });
    await db.review.deleteMany({ where: { productId: id } });
    
    // If product has order items, null out the productId reference instead of deleting order items.
    // Orders are historical records and must never be modified/deleted.
    if (orderItemsCount > 0) {
      await db.orderItem.updateMany({
        where: { productId: id },
        data: { productId: null },
      });
    }
    
    await db.product.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, softDelete: false });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
