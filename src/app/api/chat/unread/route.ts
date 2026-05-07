import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyUser } from '@/lib/auth-helpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Get unread messages count for user (messages from admin)
export async function GET(request: NextRequest) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = authedUser.id;

    // Check if models are available
    const dbAny: any = db;
    if (!dbAny.chatRoom || !dbAny.chatMessage) {
      return NextResponse.json({ unreadByUser: 0 });
    }

    // Find user's active chat room
    const chatRoom = await (db as any).chatRoom.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    if (!chatRoom) {
      return NextResponse.json({ unreadByUser: 0 });
    }

    // Get unread count from the room
    const room = chatRoom as { unreadByUser: number };
    
    return NextResponse.json({ unreadByUser: room.unreadByUser || 0 });
  } catch (error) {
    console.error('[Chat API] Error getting unread count:', error);
    return NextResponse.json({ unreadByUser: 0 });
  }
}
