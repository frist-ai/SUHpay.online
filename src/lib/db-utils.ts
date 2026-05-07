// Database utility functions

/**
 * Check if database is configured
 * Returns true only if DATABASE_URL environment variable is set
 */
export function isDatabaseConfigured(): boolean {
  const databaseUrl = process.env.DATABASE_URL;
  return !!databaseUrl && databaseUrl.length > 0;
}

/**
 * Return empty result for non-configured database
 */
export function emptyDbResponse() {
  return { error: 'Database not configured', data: [] };
}

/**
 * Demo data for non-configured database
 */
export const demoCategories = [
  { id: '1', name: 'Еда', slug: 'edy', description: 'Продукты питания', imageUrl: null, parentId: null, sortOrder: 1, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: '2', name: 'Напитки', slug: 'napitki', description: 'Чай, кофе, соки', imageUrl: null, parentId: null, sortOrder: 2, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: '3', name: 'Сладости', slug: 'sladosti', description: 'Конфеты и сладости', imageUrl: null, parentId: null, sortOrder: 3, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export const demoProducts = [
  { id: '1', sku: 'SUP-001', name: 'Гречка "Алтайская" 800г', slug: 'grechka-altayskaya-800g', description: 'Гречневая крупа высшего сорта', price: 120, discountPrice: 99, currency: 'RUB', categoryId: '1', stock: 150, skuCount: 50, rating: 4.8, reviewCount: 24, isActive: true, isFeatured: true, isNew: false, attributes: null, images: '[]', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), category: { id: '1', name: 'Еда', slug: 'edy', description: 'Продукты питания', imageUrl: null, parentId: null, sortOrder: 1, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
  { id: '2', sku: 'SUP-002', name: 'Тушёнка говяжья 525г', slug: 'tushenka-govyazhya-525g', description: 'Натуральная говяжья тушёнка', price: 350, discountPrice: null, currency: 'RUB', categoryId: '1', stock: 80, skuCount: 30, rating: 4.9, reviewCount: 56, isActive: true, isFeatured: true, isNew: true, attributes: null, images: '[]', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), category: { id: '1', name: 'Еда', slug: 'edy', description: 'Продукты питания', imageUrl: null, parentId: null, sortOrder: 1, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
  { id: '3', sku: 'SUP-003', name: 'Чай чёрный 100г', slug: 'chay-chernyy-100g', description: 'Качественный чёрный чай', price: 85, discountPrice: null, currency: 'RUB', categoryId: '2', stock: 200, skuCount: 100, rating: 4.5, reviewCount: 18, isActive: true, isFeatured: false, isNew: false, attributes: null, images: '[]', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), category: { id: '2', name: 'Напитки', slug: 'napitki', description: 'Чай, кофе, соки', imageUrl: null, parentId: null, sortOrder: 2, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
  { id: '4', sku: 'SUP-004', name: 'Сгущёнка 380г', slug: 'sgushchenka-380g', description: 'Сгущённое молоко с сахаром', price: 95, discountPrice: null, currency: 'RUB', categoryId: '3', stock: 120, skuCount: 60, rating: 4.7, reviewCount: 32, isActive: true, isFeatured: false, isNew: true, attributes: null, images: '[]', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), category: { id: '3', name: 'Сладости', slug: 'sladosti', description: 'Конфеты и сладости', imageUrl: null, parentId: null, sortOrder: 3, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
];

export const demoBanners = [
  { id: '1', title: 'Добро пожаловать в СУХ[pay]', subtitle: 'Доставка качественных продуктов питания', imageUrl: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=800', linkUrl: '/catalog', linkType: 'category', sortOrder: 1, isActive: true, startDate: null, endDate: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: '2', title: 'Акция! Скидки на тушёнку', subtitle: 'Только свежая продукция', imageUrl: 'https://images.unsplash.com/photo-1594282684113-015fe34c20f7?w=800', linkUrl: '/catalog', linkType: 'category', sortOrder: 2, isActive: true, startDate: null, endDate: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];
