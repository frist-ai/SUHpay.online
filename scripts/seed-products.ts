import { db } from '../src/lib/db';
import { randomUUID } from 'crypto';

async function main() {
  console.log('🌱 Seeding database...');
  
  // Check if already seeded
  const existingProducts = await db.product.count();
  if (existingProducts > 0) {
    console.log(`⚠️ Database already has ${existingProducts} products. Skipping seed.`);
    return;
  }
  
  // Generate IDs
  const categoryIds = {
    konservy: randomUUID(),
    krupy: randomUUID(),
    napitki: randomUUID(),
    sladosti: randomUUID(),
    maslo: randomUUID(),
  };
  
  // Create categories
  console.log('Creating categories...');
  await db.category.createMany({
    data: [
      { id: categoryIds.konservy, name: 'Консервы', slug: 'konservy', description: 'Мясные и рыбные консервы', sortOrder: 1, isActive: true },
      { id: categoryIds.krupy, name: 'Крупы', slug: 'krupy', description: 'Гречка, рис, крупы', sortOrder: 2, isActive: true },
      { id: categoryIds.napitki, name: 'Напитки', slug: 'napitki', description: 'Чай, кофе, напитки', sortOrder: 3, isActive: true },
      { id: categoryIds.sladosti, name: 'Сладости', slug: 'sladosti', description: 'Конфеты и сладости', sortOrder: 4, isActive: true },
      { id: categoryIds.maslo, name: 'Масло', slug: 'maslo', description: 'Растительное и сливочное масло', sortOrder: 5, isActive: true },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Created 5 categories');

  // Create products
  console.log('Creating products...');
  const products = [
    // Консервы
    {
      id: randomUUID(),
      sku: 'SUP-001',
      name: 'Тушёнка говяжья "Советская" 525г',
      slug: 'tushenka-govyazhya-sovetskaya-525g',
      description: 'Натуральная говяжья тушёнка высшего сорта. Производство Россия.',
      price: 350,
      categoryId: categoryIds.konservy,
      stock: 100,
      skuCount: 1,
      rating: 4.9,
      reviewCount: 56,
      isFeatured: true,
      images: JSON.stringify(['/uploads/products/1772914651527_yl7gr2.jpg']),
    },
    {
      id: randomUUID(),
      sku: 'SUP-002', 
      name: 'Тушёнка свиная 525г',
      slug: 'tushenka-svinaya-525g',
      description: 'Натуральная свиная тушёнка. ГОСТ.',
      price: 320,
      categoryId: categoryIds.konservy,
      stock: 80,
      skuCount: 1,
      rating: 4.7,
      reviewCount: 34,
      isFeatured: true,
      isNew: true,
      images: JSON.stringify(['/uploads/products/1772868053436_35r13z.png']),
    },
    {
      id: randomUUID(),
      sku: 'SUP-003',
      name: 'Рыбные консервы "Сайра" 250г',
      slug: 'rybnye-konservy-sayra-250g',
      description: 'Сайра натуральная с добавлением масла.',
      price: 180,
      categoryId: categoryIds.konservy,
      stock: 120,
      skuCount: 1,
      rating: 4.6,
      reviewCount: 28,
      images: JSON.stringify(['/uploads/products/1772913905806_fvr05a.png']),
    },
    // Крупы
    {
      id: randomUUID(),
      sku: 'SUP-004',
      name: 'Гречка "Алтайская" 800г',
      slug: 'grechka-altayskaya-800g',
      description: 'Гречневая крупа ядрица высшего сорта. Алтайский край.',
      price: 120,
      discountPrice: 99,
      categoryId: categoryIds.krupy,
      stock: 150,
      skuCount: 1,
      rating: 4.8,
      reviewCount: 42,
      isFeatured: true,
      images: JSON.stringify(['/uploads/products/1772914105537_66rlns.png']),
    },
    {
      id: randomUUID(),
      sku: 'SUP-005',
      name: 'Рис "Краснодарский" 1кг',
      slug: 'ris-krasnodarskiy-1kg',
      description: 'Рис круглозёрный, Краснодарский край.',
      price: 95,
      categoryId: categoryIds.krupy,
      stock: 200,
      skuCount: 1,
      rating: 4.5,
      reviewCount: 18,
    },
    // Напитки
    {
      id: randomUUID(),
      sku: 'SUP-006',
      name: 'Чай чёрный "Принцесса Нури" 100г',
      slug: 'chay-chernyy-printsessa-nuri-100g',
      description: 'Качественный чёрный байховый чай.',
      price: 85,
      categoryId: categoryIds.napitki,
      stock: 200,
      skuCount: 1,
      rating: 4.4,
      reviewCount: 22,
    },
    {
      id: randomUUID(),
      sku: 'SUP-007',
      name: 'Кофе растворимый "Nescafe Classic" 95г',
      slug: 'kofe-rastvorimyy-nescafe-classic-95g',
      description: 'Растворимый натуральный кофе.',
      price: 320,
      categoryId: categoryIds.napitki,
      stock: 80,
      skuCount: 1,
      rating: 4.6,
      reviewCount: 45,
      isFeatured: true,
    },
    // Сладости
    {
      id: randomUUID(),
      sku: 'SUP-008',
      name: 'Сгущёнка "Рогачёв" 380г',
      slug: 'sgushchenka-rogachev-380g',
      description: 'Сгущённое молоко с сахаром. Беларусь.',
      price: 120,
      categoryId: categoryIds.sladosti,
      stock: 120,
      skuCount: 1,
      rating: 4.9,
      reviewCount: 67,
      isFeatured: true,
    },
    {
      id: randomUUID(),
      sku: 'SUP-009',
      name: 'Печенье "Юбилейное" 200г',
      slug: 'pechene-yubileynoe-200g',
      description: 'Сладкое печенье к чаю.',
      price: 55,
      categoryId: categoryIds.sladosti,
      stock: 150,
      skuCount: 1,
      rating: 4.5,
      reviewCount: 31,
    },
    {
      id: randomUUID(),
      sku: 'SUP-011',
      name: 'Сгущёнка с какао 380г',
      slug: 'sgushchenka-s-kakao-380g',
      description: 'Сгущённое молоко с сахаром и какао.',
      price: 130,
      categoryId: categoryIds.sladosti,
      stock: 90,
      skuCount: 1,
      rating: 4.8,
      reviewCount: 41,
      isNew: true,
      images: JSON.stringify(['/uploads/products/1772921433689_23mk52.jpg']),
    },
    // Масло
    {
      id: randomUUID(),
      sku: 'SUP-010',
      name: 'Масло подсолнечное "Олейна" 1л',
      slug: 'maslo-podsolnechnoe-oleyna-1l',
      description: 'Рафинированное дезодорированное масло.',
      price: 180,
      categoryId: categoryIds.maslo,
      stock: 100,
      skuCount: 1,
      rating: 4.7,
      reviewCount: 28,
    },
  ];
  
  await db.product.createMany({ data: products, skipDuplicates: true });
  console.log(`✅ Created ${products.length} products`);
  
  // Create banners
  console.log('Creating banners...');
  await db.banner.createMany({
    data: [
      {
        id: 'banner-1',
        title: 'Добро пожаловать в СУХ[pay]',
        subtitle: 'Доставка качественных продуктов питания',
        imageUrl: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=800',
        linkUrl: '/catalog',
        linkType: 'category',
        sortOrder: 1,
        isActive: true,
      },
      {
        id: 'banner-2', 
        title: 'Акция! Скидки на тушёнку',
        subtitle: 'Только свежая продукция',
        imageUrl: 'https://images.unsplash.com/photo-1594282684113-015fe34c20f7?w=800',
        linkUrl: '/catalog/konservy',
        linkType: 'category',
        sortOrder: 2,
        isActive: true,
      },
      {
        id: 'banner-3',
        title: 'Бесплатная доставка от 2000₽',
        subtitle: 'По всей России',
        imageUrl: 'https://images.unsplash.com/photo-1553531384-97c45a2ea792?w=800',
        linkUrl: '/catalog',
        linkType: 'category', 
        sortOrder: 3,
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Created 3 banners');
  
  // Create payment settings
  const existingSettings = await db.paymentSettings.count();
  if (existingSettings === 0) {
    await db.paymentSettings.create({
      data: {
        id: 'default',
        cardEnabled: false,
        sbpEnabled: true,
        sbpPhone: '+79991234567',
        sbpBankName: 'Т-Банк',
        cryptoEnabled: false,
        starsEnabled: false,
        cashEnabled: true,
        cardTransferEnabled: true,
        cardTransferCardNumber: '2200 0000 0000 0000',
        cardTransferHolderName: 'IVAN IVANOV',
        cardTransferBankName: 'Т-Банк',
      },
    });
    console.log('✅ Created payment settings');
  }
  
  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
