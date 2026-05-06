import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyUser } from '@/lib/auth-helpers';

// GET /api/loyalty - Get user's loyalty info
export async function GET(request: NextRequest) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = authedUser.id;

    // Get user with loyalty info
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        loyaltyPoints: true,
        totalSpent: true,
        ordersCount: true,
        birthday: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get loyalty settings
    const loyaltySettings = await db.setting.findUnique({
      where: { key: 'loyalty' },
    });

    const settings = loyaltySettings ? JSON.parse(loyaltySettings.value) : {
      pointsPerRub: 1,
      pointsToRub: 0.01, // 1 балл = 1 копейка (100 баллов = 1 руб)
      welcomeBonus: 100,
      birthdayBonus: 500,
      bronzeThreshold: 0,
      bronzeMultiplier: 1,
      silverThreshold: 500,
      silverMultiplier: 1.5,
      goldThreshold: 2000,
      goldMultiplier: 2,
      platinumThreshold: 10000,
      platinumMultiplier: 3,
      maxPointsPayment: 50, // max % of order that can be paid with points
    };

    // Calculate loyalty level
    const totalSpent = user.totalSpent || 0;
    let level = 'bronze';
    let multiplier = settings.bronzeMultiplier || 1;
    let nextLevel: string | null = 'silver';
    let nextThreshold: number | null = settings.silverThreshold || 500;

    if (totalSpent >= (settings.platinumThreshold || 10000)) {
      level = 'platinum';
      multiplier = settings.platinumMultiplier || 3;
      nextLevel = null;
      nextThreshold = null;
    } else if (totalSpent >= (settings.goldThreshold || 2000)) {
      level = 'gold';
      multiplier = settings.goldMultiplier || 2;
      nextLevel = 'platinum';
      nextThreshold = settings.platinumThreshold || 10000;
    } else if (totalSpent >= (settings.silverThreshold || 500)) {
      level = 'silver';
      multiplier = settings.silverMultiplier || 1.5;
      nextLevel = 'gold';
      nextThreshold = settings.goldThreshold || 2000;
    }

    // Get recent transactions
    const transactions = await db.loyaltyTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      user: {
        ...user,
        level,
        multiplier,
        nextLevel,
        nextThreshold,
        progress: nextThreshold ? Math.min(100, (totalSpent / nextThreshold) * 100) : 100,
      },
      settings: {
        pointsPerRub: settings.pointsPerRub,
        pointsToRub: settings.pointsToRub,
        maxPointsPayment: settings.maxPointsPayment,
      },
      transactions,
    });
  } catch (error) {
    console.error('Error fetching loyalty info:', error);
    return NextResponse.json({ error: 'Failed to fetch loyalty info' }, { status: 500 });
  }
}
