import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/promocodes/validate - Validate promocode
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, subtotal } = body;

    if (!code) {
      return NextResponse.json({ error: 'Код промокода не указан' }, { status: 400 });
    }

    const promocode = await db.promocode.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        AND: [
          {
            OR: [
              { startsAt: null },
              { startsAt: { lte: new Date() } },
            ],
          },
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } },
            ],
          },
        ],
      },
    });

    if (!promocode) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Промокод не найден или истёк срок действия' 
      }, { status: 400 });
    }

    // Check usage limit
    if (promocode.usageLimit && promocode.usageCount >= promocode.usageLimit) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Промокод уже был использован максимальное количество раз' 
      }, { status: 400 });
    }

    // Check minimum order
    if (promocode.minOrder && subtotal < promocode.minOrder) {
      return NextResponse.json({ 
        valid: false, 
        error: `Минимальная сумма заказа: ${promocode.minOrder.toLocaleString('ru-RU')} ₽` 
      }, { status: 400 });
    }

    // Calculate discount
    let discountAmount = 0;
    if (promocode.discountType === 'percentage') {
      discountAmount = (subtotal * promocode.discountValue) / 100;
      if (promocode.maxDiscount) {
        discountAmount = Math.min(discountAmount, promocode.maxDiscount);
      }
    } else {
      discountAmount = promocode.discountValue;
    }

    return NextResponse.json({
      valid: true,
      promocode: {
        id: promocode.id,
        code: promocode.code,
        discountType: promocode.discountType,
        discountValue: promocode.discountValue,
        minOrder: promocode.minOrder,
        maxDiscount: promocode.maxDiscount,
      },
      discountAmount: Math.round(discountAmount),
      message: promocode.discountType === 'percentage'
        ? `Скидка ${promocode.discountValue}% применена!`
        : `Скидка ${promocode.discountValue.toLocaleString('ru-RU')} ₽ применена!`,
    });
  } catch (error) {
    console.error('Error validating promocode:', error);
    return NextResponse.json({ error: 'Ошибка при проверке промокода' }, { status: 500 });
  }
}
