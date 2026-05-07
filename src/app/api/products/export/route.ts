import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';
import { verifyAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    // Get all products with category info
    let products;
    try {
      products = await db.product.findMany({
        include: {
          category: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'База данных недоступна.' },
        { status: 503 }
      );
    }

    // Get all categories for reference
    const categories = await db.category.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Build data for main sheet
    const exportDate = new Date().toLocaleString('ru-RU');
    
    // Headers
    const headers = [
      '№ п/п', 'Категория', 'Название', 'Описание',
      'Остаток', 'Цена розничная', 'остаток в ручную',
      'закупочная ц. за 1 шт', 'реально куплено', 'количество',
      'закупочная ц. ИТОГО', 'дата покупки', 'сколько выкуплено шт',
      'цена продажи', 'разница цен'
    ];
    
    // Data rows
    const rows = products.map((p, index) => [
      index + 1,
      p.category?.name || '',
      p.name,
      p.description || '',
      p.stock,
      p.price,
      '', // остаток в ручную
      '', // закупочная ц. за 1 шт
      '', // реально куплено
      '', // количество
      '', // закупочная ц. ИТОГО
      '', // дата покупки
      '', // сколько выкуплено шт
      '', // цена продажи
      '', // разница цен
    ]);
    
    // Create sheet with title rows
    const sheetData = [
      ['Остатки ТМЦ на складе'],
      [`на ${exportDate}`],
      [],
      headers,
      ...rows,
      [],
      ['ИТОГО:', '', '', '', products.reduce((sum, p) => sum + p.stock, 0)],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 6 },  // № п/п
      { wch: 15 }, // Категория
      { wch: 35 }, // Название
      { wch: 40 }, // Описание
      { wch: 10 }, // Остаток
      { wch: 12 }, // Цена розничная
      { wch: 12 }, // остаток в ручную
      { wch: 15 }, // закупочная ц. за 1 шт
      { wch: 12 }, // реально куплено
      { wch: 10 }, // количество
      { wch: 15 }, // закупочная ц. ИТОГО
      { wch: 12 }, // дата покупки
      { wch: 15 }, // сколько выкуплено шт
      { wch: 12 }, // цена продажи
      { wch: 10 }, // разница цен
    ];
    
    // Merge title cells
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }, // Title
      { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } }, // Date
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Остатки ТМЦ на складе');
    
    // Categories sheet
    const catData = [
      ['ID', 'Название'],
      ...categories.map(c => [c.id, c.name]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(catData);
    ws2['!cols'] = [{ wch: 30 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Категории');
    
    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="products_export_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Ошибка экспорта: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
