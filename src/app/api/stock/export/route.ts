import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';
import { verifyAdmin } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    // Get all products with category info
    const products = await db.product.findMany({
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
    
    const exportDate = new Date().toLocaleString('ru-RU');
    
    // Headers matching user's format
    const headers = [
      '№ п/п', 'Категория', 'Название', 'Описание',
      'Остаток', 'Цена розничная', 'Цена закупки', 'Прибыль/шт', 'Маржа %', 'остаток в ручную'
    ];
    
    // Data rows
    const rows = products.map((p, index) => {
      const purchasePrice = p.purchasePrice || 0;
      const profit = p.price - purchasePrice;
      const margin = p.price > 0 && purchasePrice > 0 ? ((p.price - purchasePrice) / p.price * 100) : 0;
      return [
        index + 1,
        p.category?.name || '',
        p.name,
        p.description || '',
        p.stock,
        p.price,
        purchasePrice,
        profit,
        Math.round(margin * 10) / 10,
        0, // остаток в ручную
      ];
    });
    
    // Totals
    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    const totalProductValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);
    const totalPurchaseValue = products.reduce((sum, p) => sum + (p.purchasePrice || 0) * p.stock, 0);
    
    // Create sheet with title rows
    const sheetData = [
      ['Остатки ТМЦ на складе'],
      [`на ${exportDate}`],
      [],
      ['Сводка:', '', 'Товаров на сумму:', totalProductValue, '', 'Закупочная стоимость:', totalPurchaseValue, '', 'Потенциальная прибыль:', totalProductValue - totalPurchaseValue],
      [],
      headers,
      ...rows,
      [],
      ['ИТОГО:', '', '', '', totalStock, '', '', '', ''],
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 6 },  // № п/п
      { wch: 15 }, // Категория
      { wch: 35 }, // Название
      { wch: 40 }, // Описание
      { wch: 10 }, // Остаток
      { wch: 14 }, // Цена розничная
      { wch: 14 }, // Цена закупки
      { wch: 12 }, // Прибыль/шт
      { wch: 10 }, // Маржа %
      { wch: 12 }, // остаток в ручную
    ];
    
    // Merge title cells
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, // Title
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, // Date
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
        'Content-Disposition': `attachment; filename="ostatki_${new Date().toISOString().split('T')[0]}.xlsx"`,
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
