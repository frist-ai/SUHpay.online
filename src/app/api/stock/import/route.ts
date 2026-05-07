import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';
import { verifyAdmin } from '@/lib/auth-helpers';

// Generate unique ID
function generateId(): string {
  return `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, message: 'Файл не найден' },
        { status: 400 }
      );
    }

    // Read file content
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Parse XLSX using SheetJS
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Find the sheet with product data
    let ws: XLSX.WorkSheet | null = null;
    
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const sheetText = JSON.stringify(sheet);
      if (sheetText.includes('Название') || sheetText.includes('Остатки') || sheetText.includes('Категория')) {
        ws = sheet;
        break;
      }
    }
    
    if (!ws) {
      ws = workbook.Sheets[workbook.SheetNames[0]];
    }
    
    // Convert to JSON
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
    
    // Find header row
    let headerRow = -1;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i] as string[];
      if (row && row.some(cell => {
        const val = String(cell || '').toLowerCase();
        return val.includes('название') || val === 'категория';
      })) {
        headerRow = i;
        break;
      }
    }
    
    if (headerRow === -1) headerRow = 3;
    
    // Parse headers
    const headers = rawData[headerRow] as string[];
    const colMap: Record<string, number> = {};
    
    headers?.forEach((h, idx) => {
      const val = String(h || '').toLowerCase().trim();
      if (val === 'категория') colMap['category'] = idx;
      else if (val.includes('название')) colMap['name'] = idx;
      else if (val.includes('описание')) colMap['description'] = idx;
      else if (val === 'остаток') colMap['stock'] = idx;
      else if (val.includes('цена розничная') || val === 'цена') colMap['price'] = idx;
    });
    
    // Get categories for lookup
    const categories = await db.category.findMany({
      select: { id: true, name: true },
    });
    
    const categoryLookup: Record<string, string> = {};
    categories.forEach(c => {
      categoryLookup[c.name.toLowerCase()] = c.id;
    });
    
    let created = 0;
    let updated = 0;
    let categoriesCreated = 0;
    const errors: string[] = [];
    
    // Parse data rows
    for (let i = headerRow + 1; i < rawData.length; i++) {
      const row = rawData[i] as (string | number | null)[];
      if (!row || !row[0]) continue;
      
      const getVal = (key: string): string | number | null => {
        const idx = colMap[key];
        return idx !== undefined ? row[idx] : null;
      };
      
      const categoryName = String(getVal('category') || '').trim();
      const name = String(getVal('name') || '').trim();
      const description = String(getVal('description') || '').trim();
      const stock = Number(getVal('stock')) || 0;
      const price = Number(getVal('price')) || 0;
      
      // Skip empty rows
      if (!name || name === 'null' || name === 'undefined') continue;
      
      // Find or create category
      let categoryId = categoryName ? categoryLookup[categoryName.toLowerCase()] : null;
      
      if (!categoryId && categoryName && categoryName !== 'null') {
        try {
          const newCat = await db.category.create({
            data: {
              id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: categoryName,
              slug: categoryName.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '-').slice(0, 50),
              isActive: true,
              updatedAt: new Date(),
            },
          });
          categoryId = newCat.id;
          categoryLookup[categoryName.toLowerCase()] = newCat.id;
          categoriesCreated++;
        } catch {
          const existing = await db.category.findFirst({
            where: { name: { equals: categoryName } } as any,
          });
          if (existing) {
            categoryId = existing.id;
            categoryLookup[categoryName.toLowerCase()] = existing.id;
          }
        }
      }
      
      if (!categoryId) {
        categoryId = categories[0]?.id;
      }
      
      if (!categoryId) {
        errors.push(`Строка ${i + 1}: Нет категории для товара ${name}`);
        continue;
      }
      
      // Check for existing product by name
      let existing = await db.product.findFirst({
        where: { name: { equals: name } } as any,
      });
      
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]/gi, '-')
        .replace(/-+/g, '-')
        .slice(0, 50) + '-' + Date.now().toString(36);
      
      // Generate SKU automatically
      const autoSku = `SKU-${Date.now().toString(36).toUpperCase()}`;
      
      try {
        if (existing) {
          await db.product.update({
            where: { id: existing.id },
            data: {
              description: description || existing.description,
              categoryId: categoryId,
              price: price || existing.price,
              stock: stock,
              isActive: stock > 0 ? true : existing.isActive,
              updatedAt: new Date(),
            },
          });
          updated++;
        } else {
          await db.product.create({
            data: {
              id: generateId(),
              sku: autoSku,
              name: name,
              slug: slug,
              description: description || null,
              categoryId: categoryId,
              price: price,
              stock: stock,
              isActive: stock > 0,
              isFeatured: false,
              isNew: false,
              updatedAt: new Date(),
            },
          });
          created++;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Строка ${i + 1}: ${errorMsg}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Импорт завершен: создано ${created}, обновлено ${updated}${categoriesCreated > 0 ? `, категорий: ${categoriesCreated}` : ''}`,
      created,
      updated,
      categoriesCreated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Import error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        success: false, 
        message: 'Ошибка импорта: ' + errorMsg,
        errors: [errorMsg]
      },
      { status: 500 }
    );
  }
}
