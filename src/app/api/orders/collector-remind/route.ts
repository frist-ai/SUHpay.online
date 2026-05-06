import { NextRequest, NextResponse } from 'next/server';
import { getCollectorTelegramIds, sendAssemblyReminders } from '@/lib/order-notifications';
import { verifyAdmin } from '@/lib/auth-helpers';

// POST /api/orders/collector-remind - Send assembly reminders to collectors
// Can be called by cron or manually by admin
export async function POST(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        success: true,
        message: 'No database configured',
        reminded: 0,
      });
    }

    const { db } = await import('@/lib/db');
    if (!db) {
      return NextResponse.json({
        success: true,
        message: 'No database client',
        reminded: 0,
      });
    }

    // Get collector Telegram IDs
    const collectorIds = await getCollectorTelegramIds(db);
    if (collectorIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active collectors found',
        reminded: 0,
      });
    }

    // Find orders that need assembly: pending or confirmed, not cancelled
    const pendingOrders = await db.order.findMany({
      where: {
        status: { in: ['pending', 'confirmed'] },
      },
      select: {
        orderNumber: true,
        total: true,
        contactName: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    if (pendingOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending orders',
        reminded: 0,
      });
    }

    // Send reminders
    await sendAssemblyReminders(pendingOrders as any, collectorIds);

    return NextResponse.json({
      success: true,
      message: `Reminded ${collectorIds.length} collectors about ${pendingOrders.length} pending orders`,
      reminded: collectorIds.length,
      pendingOrders: pendingOrders.length,
    });
  } catch (error) {
    console.error('[CollectorRemind] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send assembly reminders' },
      { status: 500 }
    );
  }
}

// GET /api/orders/collector-remind - Check pending order count (lightweight)
export async function GET(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ pendingCount: 0, collectorsCount: 0 });
    }

    const { db } = await import('@/lib/db');
    if (!db) {
      return NextResponse.json({ pendingCount: 0, collectorsCount: 0 });
    }

    const [pendingCount, collectors] = await Promise.all([
      db.order.count({
        where: {
          status: { in: ['pending', 'confirmed'] },
        },
      }),
      db.staff.findMany({
        where: { role: 'collector', isActive: true },
        select: { telegramId: true },
      }),
    ]);

    return NextResponse.json({
      pendingCount,
      collectorsCount: collectors.length,
    });
  } catch (error) {
    console.error('[CollectorRemind] Error checking status:', error);
    return NextResponse.json({ pendingCount: 0, collectorsCount: 0 });
  }
}
