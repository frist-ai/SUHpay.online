import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// GET /api/subscribers/stats - Get subscriber statistics
export async function GET(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    // All users who interacted with bot
    const allUsers = await db.user.count();
    
    // Registered users (have phone or email)
    const registered = await db.user.count({
      where: {
        OR: [
          { phone: { not: null } },
          { email: { not: null } },
        ],
      },
    });
    
    // Users who made purchases
    const buyers = await db.user.count({
      where: {
        orders: {
          some: {
            status: { not: 'cancelled' },
          },
        },
      },
    });
    
    // New users in last 7 days - using Date.now() for maximum reliability
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    // Validate the date before using
    if (isNaN(sevenDaysAgo.getTime())) {
      throw new Error('Failed to calculate date');
    }
    
    const newUsers = await db.user.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });
    
    return NextResponse.json({
      all: allUsers,
      registered,
      buyers,
      newUsers,
    });
  } catch (error) {
    console.error('Error fetching subscriber stats:', error);
    return NextResponse.json({ error: 'Failed to fetch subscriber stats' }, { status: 500 });
  }
}
