import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const productCount = await prisma.product.count();
  const categoryCount = await prisma.category.count();
  const products = await prisma.product.findMany({ select: { id: true, sku: true, name: true } });
  
  console.log('Products count:', productCount);
  console.log('Categories count:', categoryCount);
  console.log('Products:', JSON.stringify(products, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
