import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyAdmin } from '@/lib/auth-helpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Get total unread messages count for admin (messages from all users)
export async function GET(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    // Check if models are available
    const dbAny: any = db;
    if (!dbAny.chatRoom) {
      return NextResponse.json({ totalUnread: 0, roomsCount: 0 });
    }

    // Get all rooms with unread messages
    const rooms = await dbAny.chatRoom.findMany({
      where: {
        unreadByAdmin: { gt: 0 },
        status: 'active',
      },
      select: {
        id: true,
        unreadByAdmin: true,
      },
    });

    const roomsArray = rooms as Array<{ id: string; unreadByAdmin: number }>;
    const totalUnread = roomsArray.reduce((sum, room) => sum + (room.unreadByAdmin || 0), 0);
    
    return NextResponse.json({ 
      totalUnread,
      roomsCount: roomsArray.length 
    });
  } catch (error) {
    console.error('[Admin Chat API] Error getting unread count:', error);
    return NextResponse.json({ totalUnread: 0, roomsCount: 0 });
  }
}
