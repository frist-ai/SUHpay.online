import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    // Create categories
    const categories = await Promise.all([
      db.category.upsert({
        where: { slug: 'edy' },
        update: {},
        create: { id: 'cat_1', name: 'Еда', slug: 'edy', description: 'Готовые блюда и закуски', sortOrder: 1, isActive: true },
      }),
      db.category.upsert({
        where: { slug: 'napitki' },
        update: {},
        create: { id: 'cat_2', name: 'Напитки', slug: 'napitki', description: 'Чай, кофе, соки', sortOrder: 2, isActive: true },
      }),
      db.category.upsert({
        where: { slug: 'sladosti' },
        update: {},
        create: { id: 'cat_3', name: 'Сладости', slug: 'sladosti', description: 'Шоколад, конфеты, печенье', sortOrder: 3, isActive: true },
      }),
      db.category.upsert({
        where: { slug: 'sneki' },
        update: {},
        create: { id: 'cat_4', name: 'Снеки', slug: 'sneki', description: 'Чипсы, орехи, сухарики', sortOrder: 4, isActive: true },
      }),
      db.category.upsert({
        where: { slug: 'zavtraki' },
        update: {},
        create: { id: 'cat_5', name: 'Завтраки', slug: 'zavtraki', description: 'Каша, мюсли, хлопья', sortOrder: 5, isActive: true },
      }),
      db.category.upsert({
        where: { slug: 'sosy-i-spetsii' },
        update: {},
        create: { id: 'cat_6', name: 'Соусы', slug: 'sosy-i-spetsii', description: 'Кетчуп, майонез, горчица', sortOrder: 6, isActive: true },
      }),
    ]);

    // Create products
    const products = [
      // Еда
      { name: 'Куриные наггетсы', slug: 'kurinye-naggetsy', categoryId: 'cat_1', price: 249, discountPrice: 199, stock: 50, skuCount: 8, isFeatured: true, isNew: false, rating: 4.5, reviewCount: 23, images: '["https://picsum.photos/seed/nuggets/400/400"]', description: 'Хрустящие куриные наггетсы в панировке. Идеальны для перекуса. 8 штук в упаковке.', attributes: '[{"name":"Вес","value":"320 г"},{"name":"Количество","value":"8 шт"},{"name":"Белки","value":"14 г"},{"name":"Готовка","value":"3-5 мин"}]' },
      { name: 'Пельмени домашние', slug: 'pelmeni-domashnie', categoryId: 'cat_1', price: 399, discountPrice: 349, stock: 30, skuCount: 12, isFeatured: true, isNew: false, rating: 4.8, reviewCount: 56, images: '["https://picsum.photos/seed/pelmeni/400/400"]', description: 'Классические домашние пельмени с мясом. Готовятся за 10 минут.', attributes: '[{"name":"Вес","value":"800 г"},{"name":"Количество","value":"~50 шт"},{"name":"Начинка","value":"Свинина/говядина"}]' },
      { name: 'Пицца Маргарита', slug: 'pizza-margarita', categoryId: 'cat_1', price: 599, discountPrice: null, stock: 15, skuCount: 1, isFeatured: false, isNew: true, rating: 4.3, reviewCount: 12, images: '["https://picsum.photos/seed/pizza1/400/400","https://picsum.photos/seed/pizza2/400/400"]', description: 'Классическая пицца с моцареллой и томатным соусом. Диаметр 30 см.', attributes: '[{"name":"Диаметр","value":"30 см"},{"name":"Вес","value":"500 г"}]' },
      { name: 'Салат Цезарь', slug: 'salat-cezar', categoryId: 'cat_1', price: 349, discountPrice: 299, stock: 20, skuCount: 1, isFeatured: false, isNew: false, rating: 4.6, reviewCount: 34, images: '["https://picsum.photos/seed/caesar/400/400"]', description: 'Свежий салат Цезарь с курицей, сухариками и соусом.', attributes: '[{"name":"Вес","value":"250 г"}]' },
      
      // Напитки
      { name: 'Капучино', slug: 'kapuchino', categoryId: 'cat_2', price: 189, discountPrice: null, stock: 100, skuCount: 1, isFeatured: true, isNew: false, rating: 4.7, reviewCount: 89, images: '["https://picsum.photos/seed/cappuccino/400/400"]', description: 'Классический капучино из 100% арабики. 250 мл.', attributes: '[{"name":"Объём","value":"250 мл"},{"name":"Кофеин","value":"63 мг"}]' },
      { name: 'Лимонад клубничный', slug: 'limonad-klubnichnyj', categoryId: 'cat_2', price: 129, discountPrice: 99, stock: 40, skuCount: 1, isFeatured: false, isNew: true, rating: 4.4, reviewCount: 15, images: '["https://picsum.photos/seed/lemonade/400/400"]', description: 'Освежающий лимонад с натуральным клубничным соком. 500 мл.', attributes: '[{"name":"Объём","value":"500 мл"},{"name":"Сахар","value":"8 г/100 мл"}]' },
      { name: 'Морс клюквенный', slug: 'mors-klyukvennyj', categoryId: 'cat_2', price: 149, discountPrice: null, stock: 35, skuCount: 1, isFeatured: false, isNew: false, rating: 4.5, reviewCount: 22, images: '["https://picsum.photos/seed/cranberry/400/400"]', description: 'Натуральный клюквенный морс без добавления сахара. 1 л.', attributes: '[{"name":"Объём","value":"1000 мл"}]' },

      // Сладости
      { name: 'Шоколад Milka', slug: 'shokolad-milka', categoryId: 'cat_3', price: 89, discountPrice: 69, stock: 80, skuCount: 1, isFeatured: true, isNew: false, rating: 4.6, reviewCount: 145, images: '["https://picsum.photos/seed/chocolate/400/400"]', description: 'Молочный шоколад Milka с альпийским молоком. 100 г.', attributes: '[{"name":"Вес","value":"100 г"},{"name":"Какао","value":"30% мин"}]' },
      { name: 'Печенье Орео', slug: 'pechene-oreo', categoryId: 'cat_3', price: 79, discountPrice: null, stock: 60, skuCount: 1, isFeatured: false, isNew: false, rating: 4.8, reviewCount: 210, images: '["https://picsum.photos/seed/oreo/400/400"]', description: 'Классическое печенье Орео с кремовой начинкой. 176 г.', attributes: '[{"name":"Вес","value":"176 г"},{"name":"Количество","value":"~24 шт"}]' },
      { name: 'Мармелад Fruit Tell', slug: 'marmelad-fruit-tell', categoryId: 'cat_3', price: 109, discountPrice: 89, stock: 45, skuCount: 1, isFeatured: false, isNew: true, rating: 4.2, reviewCount: 18, images: '["https://picsum.photos/seed/gummy/400/400"]', description: 'Жевательный мармелад со вкусом тропических фруктов. 90 г.', attributes: '[{"name":"Вес","value":"90 г"}]' },

      // Снеки
      { name: 'Чипсы Lay\'s', slug: 'chipsy-lays', categoryId: 'cat_4', price: 129, discountPrice: 99, stock: 70, skuCount: 1, isFeatured: true, isNew: false, rating: 4.3, reviewCount: 98, images: '["https://picsum.photos/seed/chips/400/400"]', description: 'Картофельные чипсы Lay\'s классические со вкусом соли. 160 г.', attributes: '[{"name":"Вес","value":"160 г"}]' },
      { name: 'Орехи смешанные', slug: 'orehi-smeshannye', categoryId: 'cat_4', price: 299, discountPrice: 249, stock: 25, skuCount: 1, isFeatured: false, isNew: true, rating: 4.7, reviewCount: 42, images: '["https://picsum.photos/seed/nuts/400/400"]', description: 'Смесь орехов: миндаль, кешью, фундук, грецкий. 200 г.', attributes: '[{"name":"Вес","value":"200 г"},{"name":"Белки","value":"20 г/100 г"}]' },
      { name: 'Сухарики Кириешки', slug: 'suhariki-kurieshki', categoryId: 'cat_4', price: 59, discountPrice: null, stock: 90, skuCount: 1, isFeatured: false, isNew: false, rating: 4.1, reviewCount: 67, images: '["https://picsum.photos/seed/breadsticks/400/400"]', description: 'Сухарики со вкусом сыра. Хрустящие и ароматные. 100 г.', attributes: '[{"name":"Вес","value":"100 г"}]' },

      // Завтраки
      { name: 'Каша Быстров', slug: 'kasha-bystrov', categoryId: 'cat_5', price: 69, discountPrice: 59, stock: 55, skuCount: 1, isFeatured: false, isNew: false, rating: 4.0, reviewCount: 31, images: '["https://picsum.photos/seed/oatmeal/400/400"]', description: 'Быстроразваривающаяся овсяная каша со вкусом клубники. 6 пакетиков.', attributes: '[{"name":"Количество","value":"6 пакетиков"},{"name":"Вес","value":"240 г"}]' },
      { name: 'Мюсли с сухофруктами', slug: 'myusli-s-suhofruktami', categoryId: 'cat_5', price: 199, discountPrice: null, stock: 30, skuCount: 1, isFeatured: false, isNew: true, rating: 4.5, reviewCount: 19, images: '["https://picsum.photos/seed/muesli/400/400"]', description: 'Хрустящие мюсли с изюмом, курагой и черносливом. 400 г.', attributes: '[{"name":"Вес","value":"400 г"},{"name":"Клетчатка","value":"8 г/100 г"}]' },

      // Соусы
      { name: 'Кетчуп Heinz', slug: 'ketchup-heinz', categoryId: 'cat_6', price: 149, discountPrice: 119, stock: 40, skuCount: 1, isFeatured: false, isNew: false, rating: 4.4, reviewCount: 76, images: '["https://picsum.photos/seed/ketchup/400/400"]', description: 'Томатный кетчуп Heinz. Классический вкус. 350 г.', attributes: '[{"name":"Объём","value":"350 г"}]' },
      { name: 'Майонез Calve', slug: 'mayonez-calve', categoryId: 'cat_6', price: 129, discountPrice: null, stock: 35, skuCount: 1, isFeatured: false, isNew: false, rating: 4.3, reviewCount: 54, images: '["https://picsum.photos/seed/mayo/400/400"]', description: 'Майонез Calve Provansal. Пикантный вкус. 400 г.', attributes: '[{"name":"Объём","value":"400 г"},{"name":"Жиры","value":"67 г/100 г"}]' },
    ];

    for (const p of products) {
      await db.product.upsert({
        where: { sku: `SKU-${Math.random().toString(36).substr(2, 8)}` },
        update: {},
        create: {
          id: `prod_${p.slug}`,
          sku: `SKU-${Math.random().toString(36).substr(2, 8)}`,
          name: p.name,
          slug: p.slug,
          categoryId: p.categoryId,
          price: p.price,
          discountPrice: p.discountPrice,
          stock: p.stock,
          skuCount: p.skuCount || 0,
          isFeatured: p.isFeatured,
          isNew: p.isNew,
          rating: p.rating || 0,
          reviewCount: p.reviewCount || 0,
          images: p.images || null,
          description: p.description || null,
          attributes: p.attributes || null,
          isActive: true,
        },
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Создано ${categories.length} категорий и ${products.length} товаров` 
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Seed failed' 
    }, { status: 500 });
  }
}
