import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const [products, categories, banners, users, orders] = await Promise.all([
    prisma.product.findMany(),
    prisma.category.findMany(),
    prisma.banner.findMany(),
    prisma.user.findMany(),
    prisma.order.findMany(),
  ]);
  
  console.log('=== LOCAL DATABASE CONTENTS ===');
  console.log('Products:', products.length);
  console.log('Categories:', categories.length);
  console.log('Banners:', banners.length);
  console.log('Users:', users.length);
  console.log('Orders:', orders.length);
  
  console.log('\n=== ALL PRODUCTS ===');
  console.log(JSON.stringify(products, null, 2));
  
  console.log('\n=== ALL CATEGORIES ===');
  console.log(JSON.stringify(categories, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
