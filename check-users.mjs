import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      telegramId: true,
      username: true,
      firstName: true,
      lastName: true,
      phone: true,
      ordersCount: true,
      totalSpent: true,
      createdAt: true,
      lastVisitAt: true,
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('=== USERS IN DATABASE ===');
  console.log('Total users:', users.length);
  console.log('\nUser list:');
  users.forEach(u => {
    console.log({
      telegramId: u.telegramId,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || 'No name',
      orders: u.ordersCount,
      spent: u.totalSpent,
      registered: u.createdAt?.toLocaleDateString('ru-RU'),
      lastVisit: u.lastVisitAt?.toLocaleDateString('ru-RU')
    });
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
