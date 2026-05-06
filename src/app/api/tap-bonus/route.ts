import { db } from '@/lib/db';
import { addLoyaltyPoints } from '@/lib/loyalty';
import { NextRequest, NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth-helpers';

// TapBonus model may not exist in all schemas — use any for safety
const tapDb = db as any;

const MAX_DAILY_BONUS = 100;

function getTodayDate(): string {
  const now = new Date();
  return now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Kaliningrad' });
}

// GET /api/tap-bonus?userId=X - Get today's tap state
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const today = getTodayDate();

    const tapBonus = await tapDb.tapBonus.findUnique({
      where: {
        userId_date: { userId, date: today },
      },
    });

    return NextResponse.json({
      date: today,
      taps: tapBonus?.taps || 0,
      bonus: tapBonus?.bonus || 0,
      maxDaily: MAX_DAILY_BONUS,
      canEarn: (tapBonus?.bonus || 0) < MAX_DAILY_BONUS,
      claimed: tapBonus?.claimed || false,
    });
  } catch (error) {
    console.error('Error fetching tap bonus:', error);
    return NextResponse.json({ error: 'Failed to fetch tap bonus' }, { status: 500 });
  }
}

// POST /api/tap-bonus - Record a tap (always, unlimited)
// Each tap earns exactly 1 bonus point until daily limit
// When claim=true or limit reached, batch-adds all bonus to loyalty
export async function POST(request: NextRequest) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { claim } = body;
    const userId = authedUser.id;

    const today = getTodayDate();

    const result = await (db as any).$transaction(async (tx: any) => {
      // Get or create today's tap record
      const tapBonus = await tx.tapBonus.upsert({
        where: {
          userId_date: { userId, date: today },
        },
        create: {
          userId,
          date: today,
          taps: 1,
          bonus: 1,
        },
        update: {
          taps: { increment: 1 },
        },
      });

      // Add 1 point to bonus (capped at MAX_DAILY_BONUS)
      const currentBonus = tapBonus.bonus;
      let newBonus = currentBonus;
      if (!claim) {
        // Normal tap: earn 1 point if still under limit
        if (currentBonus < MAX_DAILY_BONUS) {
          newBonus = currentBonus + 1;
        }
      }

      // Update bonus amount
      await tx.tapBonus.update({
        where: { id: tapBonus.id },
        data: { bonus: newBonus },
      });

      // Auto-claim when limit reached
      const shouldClaim = claim || newBonus >= MAX_DAILY_BONUS;
      let earned = 0;

      if (shouldClaim && !tapBonus.claimed && newBonus > 0) {
        // We can't use addLoyaltyPoints inside transaction since it uses its own db,
        // so just mark as claimed — the loyalty points will be added after commit
        await tx.tapBonus.update({
          where: { id: tapBonus.id },
          data: { claimed: true },
        });
        earned = newBonus;
      }

      return {
        taps: tapBonus.taps,
        bonus: newBonus,
        claimed: tapBonus.claimed,
        earned,
        shouldClaim,
      };
    });

    // Add loyalty points outside transaction if earned
    if (result.earned > 0) {
      try {
        await addLoyaltyPoints(
          userId,
          result.earned,
          'bonus',
          `Тап-игра 🪙 (${result.earned} монет, ${result.taps} тапов)`
        );
      } catch (loyaltyError) {
        console.error('[TapBonus] Failed to add loyalty points:', loyaltyError);
      }
    }

    return NextResponse.json({
      taps: result.taps,
      bonus: result.bonus,
      maxDaily: MAX_DAILY_BONUS,
      canEarn: result.bonus < MAX_DAILY_BONUS,
      claimed: result.shouldClaim && result.earned > 0 ? true : result.claimed,
      earned: result.earned,
    });
  } catch (error) {
    console.error('Error recording tap bonus:', error);
    return NextResponse.json({ error: 'Failed to record tap bonus' }, { status: 500 });
  }
}
