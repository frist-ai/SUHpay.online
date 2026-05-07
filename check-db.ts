import { db } from './src/lib/db';

async function main() {
  try {
    const categories = await db.category.count();
    const products = await db.product.count();
    const banners = await db.banner.count();
    const users = await db.user.count();
    const orders = await db.order.count();
    
    console.log('SQLite Database Stats:');
    console.log('  Categories:', categories);
    console.log('  Products:', products);
    console.log('  Banners:', banners);
    console.log('  Users:', users);
    console.log('  Orders:', orders);
    
    if (products > 0) {
      const allProducts = await db.product.findMany({ 
        include: { category: true },
        orderBy: { createdAt: 'desc' }
      });
      console.log('\nProducts:');
      allProducts.forEach(p => console.log(`  - [${p.sku}] ${p.name} (${p.category?.name || 'no cat'}) - ${p.price}₽`));
    }
    
    if (categories > 0) {
      const allCategories = await db.category.findMany({ orderBy: { sortOrder: 'asc' } });
      console.log('\nCategories:');
      allCategories.forEach(c => console.log(`  - [${c.slug}] ${c.name}`));
    }
    
  } catch (e) {
    console.error('Error:', e);
  }
}

main().finally(() => db.$disconnect());
