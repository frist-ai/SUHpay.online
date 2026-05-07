import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Get first user
  const users = await prisma.user.findMany({ take: 3, select: { id: true, telegramId: true, firstName: true, lastName: true } });
  console.log('Users in DB:', users);
  
  if (users.length > 0) {
    const user = users[0];
    console.log('\nTesting update for user:', user.telegramId);
    
    // Try to update
    const updated = await prisma.user.update({
      where: { telegramId: user.telegramId },
      data: { 
        firstName: 'Updated Name',
        lastName: 'Updated Last',
        updatedAt: new Date()
      }
    });
    console.log('Updated user:', { firstName: updated.firstName, lastName: updated.lastName });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
