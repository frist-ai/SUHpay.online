import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// GET /api/admin/users - Get all users with their roles
export async function GET(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const adminIds = process.env.ADMIN_TELEGRAM_IDS?.split(',').map(id => id.trim()).filter(Boolean) || [];
    
    const users = await db.user.findMany({
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      adminIdsConfigured: adminIds,
      users,
      total: users.length,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST /api/admin/users - Fix user roles based on ADMIN_TELEGRAM_IDS
export async function POST(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const adminIds = process.env.ADMIN_TELEGRAM_IDS?.split(',').map(id => id.trim()).filter(Boolean) || [];
    
    // Fixing user roles
    
    // Get all users
    const users = await db.user.findMany();
    
    let updatedCount = 0;
    
    for (const user of users) {
      const shouldBeAdmin = adminIds.includes(user.telegramId);
      const newRole = shouldBeAdmin ? 'admin' : 'customer';
      
      if (user.role !== newRole) {
        await db.user.update({
          where: { id: user.id },
          data: { role: newRole },
        });
        updatedCount++;
        // User role updated
      }
    }
    
    const updatedUsers = await db.user.findMany({
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        role: true,
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount,
      adminIdsConfigured: adminIds,
      users: updatedUsers,
    });
  } catch (error) {
    console.error('Error fixing roles:', error);
    return NextResponse.json({ error: 'Failed to fix roles' }, { status: 500 });
  }
}
