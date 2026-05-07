import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth-helpers';

// Demo stats data - returned when database is not available
const DEMO_STATS = {
  isDemo: true,
  totalProducts: 4,
  totalOrders: 12,
  totalUsers: 8,
  totalRevenue: 45600,
  averageCheck: 3800,
  conversionRate: 150,
  totalItemsSold: 48,
  paidOrdersCount: 8,
  ordersByStatus: [
    { status: 'pending', _count: { id: 3 } },
    { status: 'processing', _count: { id: 2 } },
    { status: 'shipped', _count: { id: 4 } },
    { status: 'delivered', _count: { id: 3 } },
  ],
  recentOrders: [],
  topProducts: [],
  dailyRevenue: {},
  monthlyRevenue: {},
  hourlyRevenue: {},
  newUsers: 5,
  avgDeliveryHours: 24.5,
  topCategories: [
    { name: 'Электроника', revenue: 25000, orderCount: 5 },
    { name: 'Аксессуары', revenue: 12000, orderCount: 4 },
    { name: 'Одежда', revenue: 8600, orderCount: 3 },
  ],
  revenueByPaymentMethod: [
    { method: 'card', label: 'Карта', revenue: 18000, count: 4 },
    { method: 'sbp', label: 'СБП', revenue: 12000, count: 3 },
    { method: 'stars', label: 'Звёзды', revenue: 8000, count: 2 },
    { method: 'crypto', label: 'Крипто', revenue: 4600, count: 1 },
    { method: 'cash', label: 'Наличные', revenue: 3000, count: 2 },
  ],
  customerRetention: [
    { period: '2025-01', newCustomers: 5, repeatCustomers: 2 },
    { period: '2025-02', newCustomers: 4, repeatCustomers: 3 },
    { period: '2025-03', newCustomers: 3, repeatCustomers: 5 },
  ],
  deliveryTimeTrend: [
    { period: '2025-01', avgHours: 28 },
    { period: '2025-02', avgHours: 24 },
    { period: '2025-03', avgHours: 20 },
  ],
  profitability: {
    totalProfit: 15200,
    totalCost: 30400,
    averageMargin: 33.3,
    mostProfitableProducts: [
      { name: 'Товар 1', profit: 5000, margin: 45.5 },
      { name: 'Товар 2', profit: 3200, margin: 38.2 },
      { name: 'Товар 3', profit: 2800, margin: 29.1 },
    ],
  },
  geoDistribution: [
    { city: 'Москва', orders: 45, revenue: 28000 },
    { city: 'Санкт-Петербург', orders: 20, revenue: 12000 },
    { city: 'Казань', orders: 8, revenue: 5600 },
  ],
};

// Helper function to get recent orders with proper relation names
async function getRecentOrders(db: any, dateFilter?: { createdAt: { gte: Date } }) {
  try {
    return await db.order.findMany({
      where: dateFilter,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { orderItems: true },
    });
  } catch (error) {
    console.error('Error fetching recent orders:', error);
    try {
      return await db.order.findMany({
        where: dateFilter,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      return [];
    }
  }
}

// Payment method display labels
const paymentMethodLabels: Record<string, string> = {
  card: 'Карта',
  sbp: 'СБП',
  crypto: 'Крипто',
  stars: 'Звёзды',
  cash: 'Наличные',
  card_transfer: 'Перевод на карту',
};

// GET /api/stats?from=<ISO date> - Get dashboard statistics with optional date filtering
export async function GET(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    // Parse optional `from` query parameter
    const { searchParams } = request.nextUrl;
    const fromParam = searchParams.get('from');
    const fromDate = fromParam ? new Date(fromParam) : null;

    // Validate the date if provided
    if (fromParam && fromDate && (isNaN(fromDate.getTime()) || fromDate.toString() === 'Invalid Date')) {
      return NextResponse.json(
        { error: 'Invalid "from" date parameter. Use ISO 8601 format.' },
        { status: 400 }
      );
    }

    // Build the date filter clause for orders
    const dateFilter = fromDate ? { createdAt: { gte: fromDate } } : undefined;

    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ ...DEMO_STATS, reason: 'DATABASE_URL not set' });
    }

    // Try to use database
    const { db } = await import('@/lib/db');

    if (!db) {
      return NextResponse.json({ ...DEMO_STATS, reason: 'Database client not available' });
    }

    // Run all queries in parallel
    console.log('[STATS] Running database queries...');
    const [
      totalProducts,
      totalOrders,
      totalUsers,
      topProducts,
      revenueStats,
      paidOrdersCount,
      itemsSoldStats,
      recentOrders,
      ordersByStatus,
      newUsers,
      deliveredOrders,
      paymentMethodOrders,
      ordersWithCity,
      allOrdersForRetention,
      deliveredOrdersForTrend,
    ] = await Promise.all([
      db.product.count({ where: { isActive: true } }),
      db.order.count({ where: dateFilter }),
      db.user.count(),
      // Only show products with actual sales
      db.product.findMany({
        where: { skuCount: { gt: 0 } },
        take: 10,
        orderBy: { skuCount: 'desc' },
      }),
      // Revenue from ALL non-cancelled orders
      db.order.aggregate({
        where: { ...dateFilter, status: { not: 'cancelled' } },
        _sum: { total: true },
      }),
      db.order.count({ where: { ...dateFilter, paymentStatus: 'paid' } }),
      // Items sold: aggregate OrderItem quantities, filtered by order date/status
      (() => {
        if (dateFilter) {
          return db.order.findMany({
            where: { ...dateFilter, status: { not: 'cancelled' } },
            select: { id: true },
          }).then((orders: { id: string }[]) => {
            const ids = orders.map(o => o.id);
            if (ids.length === 0) return { _sum: { quantity: 0 } };
            return db.orderItem.aggregate({
              where: { orderId: { in: ids } },
              _sum: { quantity: true },
            });
          });
        }
        return db.orderItem.aggregate({
          _sum: { quantity: true },
        });
      })(),
      getRecentOrders(db, dateFilter),
      db.order.groupBy({
        by: ['status'],
        where: dateFilter,
        _count: { id: true },
      }),
      fromDate
        ? db.user.count({ where: { createdAt: { gte: fromDate } } })
        : db.user.count(),
      db.order.findMany({
        where: {
          ...dateFilter,
          status: 'delivered',
          deliveredAt: { not: null },
        },
        select: { createdAt: true, deliveredAt: true },
        take: 100,
      }),
      // Orders grouped by payment method
      db.order.findMany({
        where: { ...dateFilter, status: { not: 'cancelled' }, paymentMethod: { not: null } },
        select: { paymentMethod: true, total: true },
      }),
      // Orders with delivery city
      db.order.findMany({
        where: { ...dateFilter, deliveryCity: { not: null } },
        select: { deliveryCity: true, total: true },
      }),
      // All orders for retention
      db.order.findMany({
        where: { status: { not: 'cancelled' } },
        select: { userId: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Delivered orders for trend
      db.order.findMany({
        where: {
          status: 'delivered',
          deliveredAt: { not: null },
          ...(fromDate ? { createdAt: { gte: fromDate } } : {}),
        },
        select: { createdAt: true, deliveredAt: true },
        take: 200,
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    console.log('[STATS] Query results:', {
      totalProducts,
      totalOrders,
      totalUsers,
      paidOrdersCount,
      totalRevenue: revenueStats._sum.total,
      totalItemsSold: itemsSoldStats._sum?.quantity,
      newUsers,
    });

    // Calculate revenue time series
    const now = new Date();
    const revenueDateStart = fromDate || new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const revenueOrders = await db.order.findMany({
      where: {
        createdAt: { gte: revenueDateStart },
        status: { not: 'cancelled' },
      },
      select: { total: true, createdAt: true },
    });

    console.log('[STATS] Revenue orders fetched:', revenueOrders.length);

    // Build daily, hourly, and monthly maps
    const dailyRevenue: Record<string, number> = {};
    const hourlyRevenue: Record<string, number> = {};
    const monthlyRevenue: Record<string, number> = {};

    for (const order of revenueOrders) {
      const d = new Date(order.createdAt);
      const dateStr = d.toISOString().split('T')[0];
      const hour = String(d.getHours());
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      dailyRevenue[dateStr] = (dailyRevenue[dateStr] || 0) + order.total;
      hourlyRevenue[hour] = (hourlyRevenue[hour] || 0) + order.total;
      monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + order.total;
    }

    const totalRevenue = revenueStats._sum.total || 0;
    const averageCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const conversionRate = totalUsers > 0 ? (totalOrders / totalUsers) * 100 : 0;
    const totalItemsSold = itemsSoldStats._sum?.quantity || 0;

    // Calculate average delivery time
    let avgDeliveryHours = 0;
    const validDeliveries = deliveredOrders.filter(
      (o: { createdAt: Date; deliveredAt: Date | null }) => o.deliveredAt
    );
    if (validDeliveries.length > 0) {
      const totalHours = validDeliveries.reduce((sum: number, o: { createdAt: Date; deliveredAt: Date | null }) => {
        const created = new Date(o.createdAt).getTime();
        const delivered = new Date(o.deliveredAt!).getTime();
        return sum + (delivered - created) / (1000 * 60 * 60);
      }, 0);
      avgDeliveryHours = totalHours / validDeliveries.length;
    }

    // Calculate top categories by revenue
    let topCategories: Array<{ name: string; revenue: number; orderCount: number }> = [];
    try {
      const orderIds = await db.order.findMany({
        where: { ...dateFilter, status: { not: 'cancelled' } },
        select: { id: true },
      });
      const ids = orderIds.map((o: { id: string }) => o.id);
      if (ids.length > 0) {
        const categoryRevenue = await db.orderItem.findMany({
          where: { orderId: { in: ids } },
          select: {
            total: true,
            product: {
              select: {
                category: {
                  select: { name: true },
                },
              },
            },
          },
        });
        const categoryMap = new Map<string, { revenue: number; orderCount: number }>();
        for (const item of categoryRevenue) {
          const catName = (item as any).product?.category?.name || 'Без категории';
          const existing = categoryMap.get(catName) || { revenue: 0, orderCount: 0 };
          existing.revenue += item.total;
          existing.orderCount += 1;
          categoryMap.set(catName, existing);
        }
        topCategories = Array.from(categoryMap.entries())
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 8);
      }
    } catch (catError) {
      console.error('[STATS] Error fetching top categories:', catError);
    }

    // Revenue by payment method
    const revenueByPaymentMethod: Array<{ method: string; label: string; revenue: number; count: number }> = [];
    const paymentMap = new Map<string, { revenue: number; count: number }>();
    for (const order of paymentMethodOrders as Array<{ paymentMethod: string; total: number }>) {
      const method = order.paymentMethod || 'unknown';
      const existing = paymentMap.get(method) || { revenue: 0, count: 0 };
      existing.revenue += order.total;
      existing.count += 1;
      paymentMap.set(method, existing);
    }
    for (const [method, data] of paymentMap.entries()) {
      revenueByPaymentMethod.push({
        method,
        label: paymentMethodLabels[method] || method,
        revenue: Math.round(data.revenue),
        count: data.count,
      });
    }
    revenueByPaymentMethod.sort((a, b) => b.revenue - a.revenue);

    // Customer retention
    const customerFirstOrder = new Map<string, string>();
    for (const order of allOrdersForRetention as Array<{ userId: string; createdAt: Date }>) {
      const d = new Date(order.createdAt);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!customerFirstOrder.has(order.userId)) {
        customerFirstOrder.set(order.userId, monthKey);
      }
    }
    const retentionMap = new Map<string, { newCustomers: number; repeatCustomers: number }>();
    for (const order of allOrdersForRetention as Array<{ userId: string; createdAt: Date }>) {
      const d = new Date(order.createdAt);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const firstMonth = customerFirstOrder.get(order.userId) || monthKey;
      const existing = retentionMap.get(monthKey) || { newCustomers: 0, repeatCustomers: 0 };
      if (firstMonth === monthKey) {
        existing.newCustomers += 1;
      } else {
        existing.repeatCustomers += 1;
      }
      retentionMap.set(monthKey, existing);
    }
    const customerRetention = Array.from(retentionMap.entries())
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-12);

    // Delivery time trend
    const deliveryTrendMap = new Map<string, { totalHours: number; count: number }>();
    for (const order of deliveredOrdersForTrend as Array<{ createdAt: Date; deliveredAt: Date | null }>) {
      if (!order.deliveredAt) continue;
      const d = new Date(order.createdAt);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const hours = (new Date(order.deliveredAt).getTime() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60);
      const existing = deliveryTrendMap.get(monthKey) || { totalHours: 0, count: 0 };
      existing.totalHours += hours;
      existing.count += 1;
      deliveryTrendMap.set(monthKey, existing);
    }
    const deliveryTimeTrend = Array.from(deliveryTrendMap.entries())
      .map(([period, data]) => ({ period, avgHours: Math.round((data.totalHours / data.count) * 10) / 10 }))
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-12);

    // Profitability analysis
    let profitability: {
      totalProfit: number;
      totalCost: number;
      averageMargin: number;
      mostProfitableProducts: Array<{ name: string; profit: number; margin: number }>;
    } = { totalProfit: 0, totalCost: 0, averageMargin: 0, mostProfitableProducts: [] };
    try {
      const orderIdsForProfit = await db.order.findMany({
        where: { ...dateFilter, status: { not: 'cancelled' } },
        select: { id: true },
      });
      const profitOrderIds = orderIdsForProfit.map((o: { id: string }) => o.id);
      if (profitOrderIds.length > 0) {
        const itemsWithCost = await db.orderItem.findMany({
          where: { orderId: { in: profitOrderIds } },
          select: {
            productName: true,
            total: true,
            quantity: true,
            price: true,
            product: {
              select: { purchasePrice: true, name: true },
            },
          },
        });
        let totalProfit = 0;
        let totalCost = 0;
        const productProfitMap = new Map<string, { profit: number; revenue: number }>();
        for (const item of itemsWithCost as Array<{
          productName: string;
          total: number;
          quantity: number;
          price: number;
          product: { purchasePrice: number | null; name: string } | null;
        }>) {
          const purchasePrice = (item as any).product?.purchasePrice;
          const itemName = (item as any).product?.name || item.productName;
          if (purchasePrice && purchasePrice > 0) {
            const cost = purchasePrice * item.quantity;
            const profit = item.total - cost;
            totalProfit += profit;
            totalCost += cost;
            const existing = productProfitMap.get(itemName) || { profit: 0, revenue: 0 };
            existing.profit += profit;
            existing.revenue += item.total;
            productProfitMap.set(itemName, existing);
          }
        }
        const averageMargin = totalCost + totalProfit > 0
          ? Math.round((totalProfit / (totalCost + totalProfit)) * 1000) / 10
          : 0;
        const mostProfitableProducts = Array.from(productProfitMap.entries())
          .map(([name, data]) => ({
            name,
            profit: Math.round(data.profit),
            margin: data.revenue > 0 ? Math.round((data.profit / data.revenue) * 1000) / 10 : 0,
          }))
          .sort((a, b) => b.profit - a.profit)
          .slice(0, 5);
        profitability = { totalProfit: Math.round(totalProfit), totalCost: Math.round(totalCost), averageMargin, mostProfitableProducts };
      }
    } catch (profitError) {
      console.error('[STATS] Error fetching profitability:', profitError);
    }

    // Geo distribution
    const geoMap = new Map<string, { orders: number; revenue: number }>();
    for (const order of ordersWithCity as Array<{ deliveryCity: string; total: number }>) {
      const city = order.deliveryCity || 'Не указан';
      const existing = geoMap.get(city) || { orders: 0, revenue: 0 };
      existing.orders += 1;
      existing.revenue += order.total;
      geoMap.set(city, existing);
    }
    const geoDistribution = Array.from(geoMap.entries())
      .map(([city, data]) => ({ city, orders: data.orders, revenue: Math.round(data.revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return NextResponse.json({
      isDemo: false,
      totalProducts,
      totalOrders,
      totalUsers,
      totalRevenue,
      averageCheck,
      conversionRate,
      totalItemsSold,
      paidOrdersCount,
      ordersByStatus,
      recentOrders,
      topProducts,
      dailyRevenue,
      monthlyRevenue,
      hourlyRevenue,
      newUsers,
      avgDeliveryHours,
      topCategories,
      revenueByPaymentMethod,
      customerRetention,
      deliveryTimeTrend,
      profitability,
      geoDistribution,
    });
  } catch (error) {
    console.error('[STATS] Error fetching stats:', error);
    return NextResponse.json({
      _error: true,
      error: 'Не удалось загрузить статистику',
      reason: error instanceof Error ? error.message : 'Unknown error',
      isDemo: false,
      totalProducts: 0,
      totalOrders: 0,
      totalUsers: 0,
      totalRevenue: 0,
      averageCheck: 0,
      conversionRate: 0,
      totalItemsSold: 0,
      paidOrdersCount: 0,
      ordersByStatus: [],
      recentOrders: [],
      topProducts: [],
      dailyRevenue: {},
      monthlyRevenue: {},
      hourlyRevenue: {},
      newUsers: 0,
      avgDeliveryHours: 0,
      topCategories: [],
      revenueByPaymentMethod: [],
      customerRetention: [],
      deliveryTimeTrend: [],
      profitability: { totalProfit: 0, totalCost: 0, averageMargin: 0, mostProfitableProducts: [] },
      geoDistribution: [],
    });
  }
}
