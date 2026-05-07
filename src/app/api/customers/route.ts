import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// GET /api/customers - Get customers with stats and filters
export async function GET(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // all, registered, buyers, blocked
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Get all users with orders
    const allUsers = await db.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { orders: true },
        },
        orders: {
          where: { paymentStatus: 'paid' },
          select: { total: true },
        },
      },
    });

    // Filter in memory
    let filteredUsers = allUsers;

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter((user) =>
        (user.username?.toLowerCase().includes(searchLower)) ||
        (user.firstName?.toLowerCase().includes(searchLower)) ||
        (user.lastName?.toLowerCase().includes(searchLower)) ||
        (user.phone?.includes(search))
      );
    }

    // Category filter
    if (filter === 'blocked') {
      filteredUsers = filteredUsers.filter((user) => user.blockedAt != null);
    } else if (filter === 'registered') {
      filteredUsers = filteredUsers.filter((user) => 
        user.blockedAt == null && user._count.orders === 0
      );
    } else if (filter === 'buyers') {
      filteredUsers = filteredUsers.filter((user) => 
        user.blockedAt == null && user._count.orders > 0
      );
    }

    // Calculate total spent for each user
    const customers = filteredUsers.map((user) => ({
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      photoUrl: user.photoUrl,
      role: user.role,
      loyaltyPoints: user.loyaltyPoints,
      isActive: user.isActive,
      blockedAt: user.blockedAt,
      lastVisitAt: user.lastVisitAt,
      createdAt: user.createdAt,
      ordersCount: user._count.orders,
      totalSpent: user.orders.reduce((sum, order) => sum + order.total, 0),
    }));

    // Get stats
    const [
      totalUsers,
      totalRevenue,
    ] = await Promise.all([
      db.user.count(),
      db.order.aggregate({
        where: { paymentStatus: 'paid' },
        _sum: { total: true },
      }),
    ]);

    // Count blocked and buyers separately
    const allUsersForStats = await db.user.findMany({
      include: {
        _count: { select: { orders: true } },
      },
    });

    let blockedCount = 0;
    let buyersCount = 0;
    let registeredCount = 0;

    for (const user of allUsersForStats) {
      const isBlocked = user.blockedAt != null;

      if (isBlocked) {
        blockedCount++;
      } else if (user._count.orders > 0) {
        buyersCount++;
      } else {
        registeredCount++;
      }
    }

    // Total count for pagination
    const totalCount = customers.length;

    return NextResponse.json({
      customers,
      stats: {
        total: totalUsers,
        blocked: blockedCount,
        registered: registeredCount,
        buyers: buyersCount,
        totalRevenue: totalRevenue._sum.total || 0,
      },
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Ошибка при получении клиентов' },
      { status: 500 }
    );
  }
}
