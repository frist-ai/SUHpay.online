import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Get all chat rooms (admin only)
export async function GET(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    // Check if chatRoom model exists
    const dbAny: any = db;
    
    if (!dbAny.chatRoom) {
      console.error('[Admin Chat API] ChatRoom model not available');
      return NextResponse.json({ error: 'Chat service unavailable' }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';

    const chatRooms = await dbAny.chatRoom.findMany({
      where: status === 'all' ? undefined : { status },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            firstName: true,
            lastName: true,
            username: true,
            photoUrl: true,
            phone: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return NextResponse.json({ rooms: chatRooms });
  } catch (error) {
    console.error('[Admin Chat API] Error getting chat rooms:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
