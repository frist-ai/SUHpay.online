import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { verifyAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/check-admin
 *
 * Check if a Telegram user is an admin.
 * Requires authenticated request via HMAC-verified initData.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the caller is authenticated
    const { user, error } = await verifyAdmin(request);
    if (error) return error;

    if (!user) {
      return NextResponse.json({ isAdmin: false, reason: 'unauthenticated' });
    }

    // Caller is verified admin — return their own status
    return NextResponse.json({
      isAdmin: true,
      telegramId: user.telegramId,
    });

  } catch (error) {
    console.error('Admin check error:', error);
    return NextResponse.json({ isAdmin: false, error: String(error) });
  }
}
