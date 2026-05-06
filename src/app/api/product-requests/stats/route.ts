import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/product-requests/stats - Get product request statistics
export async function GET() {
  try {
    // Total count
    const total = await db.productRequest.count();
    
    // Count by status
    const newCount = await db.productRequest.count({
      where: { status: 'new' },
    });
    
    const reviewingCount = await db.productRequest.count({
      where: { status: 'reviewing' },
    });
    
    const orderedCount = await db.productRequest.count({
      where: { status: 'ordered' },
    });
    
    const rejectedCount = await db.productRequest.count({
      where: { status: 'rejected' },
    });
    
    // Popular requests (high priority)
    const popularRequests = await db.productRequest.findMany({
      where: { status: { in: ['new', 'reviewing'] } },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 10,
    });
    
    // Recent requests
    const recentRequests = await db.productRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    // Top categories
    const allRequests = await db.productRequest.findMany({
      where: { category: { not: null } },
      select: { category: true },
    });
    
    const categoryCount: Record<string, number> = {};
    allRequests.forEach((r) => {
      if (r.category) {
        categoryCount[r.category] = (categoryCount[r.category] || 0) + 1;
      }
    });
    
    const topCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json({
      total,
      byStatus: {
        new: newCount,
        reviewing: reviewingCount,
        ordered: orderedCount,
        rejected: rejectedCount,
      },
      popularRequests,
      recentRequests,
      topCategories,
    });
  } catch (error) {
    console.error('Error fetching product request stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
