import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create categories
  const food = await prisma.category.upsert({
    where: { slug: 'edy' },
    update: {},
    create: {
      name: 'Еда',
      slug: 'edy',
      description: 'Продукты питания',
      sortOrder: 1,
      isActive: true,
    },
  })

  const drinks = await prisma.category.upsert({
    where: { slug: 'napitki' },
    update: {},
    create: {
      name: 'Напитки',
      slug: 'napitki',
      description: 'Чай, кофе, соки',
      sortOrder: 2,
      isActive: true,
    },
  })

  const sweets = await prisma.category.upsert({
    where: { slug: 'sladosti' },
    update: {},
    create: {
      name: 'Сладости',
      slug: 'sladosti',
      description: 'Конфеты и сладости',
      sortOrder: 3,
      isActive: true,
    },
  })

  console.log('Created categories:', { food, drinks, sweets })

  // Create products
  const product1 = await prisma.product.upsert({
    where: { sku: 'SUP-001' },
    update: {},
    create: {
      sku: 'SUP-001',
      name: 'Гречка "Алтайская" 800г',
      slug: 'grechka-altayskaya-800g',
      description: 'Гречневая крупа высшего сорта',
      price: 120,
      discountPrice: 99,
      categoryId: food.id,
      stock: 150,
      skuCount: 50,
      rating: 4.8,
      reviewCount: 24,
      isFeatured: true,
      isNew: false,
    },
  })

  const product2 = await prisma.product.upsert({
    where: { sku: 'SUP-002' },
    update: {},
    create: {
      sku: 'SUP-002',
      name: 'Тушёнка говяжья 525г',
      slug: 'tushenka-govyazhya-525g',
      description: 'Натуральная говяжья тушёнка',
      price: 350,
      categoryId: food.id,
      stock: 80,
      skuCount: 30,
      rating: 4.9,
      reviewCount: 56,
      isFeatured: true,
      isNew: true,
    },
  })

  const product3 = await prisma.product.upsert({
    where: { sku: 'SUP-003' },
    update: {},
    create: {
      sku: 'SUP-003',
      name: 'Чай чёрный 100г',
      slug: 'chay-chernyy-100g',
      description: 'Качественный чёрный чай',
      price: 85,
      categoryId: drinks.id,
      stock: 200,
      skuCount: 100,
      rating: 4.5,
      reviewCount: 18,
      isFeatured: false,
      isNew: false,
    },
  })

  const product4 = await prisma.product.upsert({
    where: { sku: 'SUP-004' },
    update: {},
    create: {
      sku: 'SUP-004',
      name: 'Сгущёнка 380г',
      slug: 'sgushchenka-380g',
      description: 'Сгущённое молоко с сахаром',
      price: 95,
      categoryId: sweets.id,
      stock: 120,
      skuCount: 60,
      rating: 4.7,
      reviewCount: 32,
      isFeatured: false,
      isNew: true,
    },
  })

  console.log('Created products:', { product1, product2, product3, product4 })

  // Create banners
  const banner1 = await prisma.banner.upsert({
    where: { id: 'banner-1' },
    update: {},
    create: {
      id: 'banner-1',
      title: 'Добро пожаловать в СУХ[pay]',
      subtitle: 'Доставка качественных продуктов питания',
      imageUrl: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=800',
      linkUrl: '/catalog',
      linkType: 'category',
      sortOrder: 1,
      isActive: true,
    },
  })

  const banner2 = await prisma.banner.upsert({
    where: { id: 'banner-2' },
    update: {},
    create: {
      id: 'banner-2',
      title: 'Акция! Скидки на тушёнку',
      subtitle: 'Только свежая продукция',
      imageUrl: 'https://images.unsplash.com/photo-1594282684113-015fe34c20f7?w=800',
      linkUrl: '/catalog',
      linkType: 'category',
      sortOrder: 2,
      isActive: true,
    },
  })

  console.log('Created banners:', { banner1, banner2 })

  console.log('Seed completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
