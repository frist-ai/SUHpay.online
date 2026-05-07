import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { verifyUser } from '@/lib/auth-helpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Get or create user's chat room
export async function GET(request: NextRequest) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = authedUser.id;

    // Check if chatRoom model is available
    if (!(db as any).chatRoom) {
      console.error('[Chat API] ChatRoom model not available in Prisma client');
      return NextResponse.json({ 
        error: 'Chat service temporarily unavailable',
        room: null
      }, { status: 503 });
    }

    // Find existing active chat room
    let chatRoom = await (db as any).chatRoom.findFirst({
      where: {
        userId,
        status: 'active',
      },
      include: {
        messages: {
          take: 50,
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                photoUrl: true,
                role: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
      },
    });

    // If no active room, create one
    if (!chatRoom) {
      chatRoom = await (db as any).chatRoom.create({
        data: {
          id: nanoid(),
          userId,
          status: 'active',
        },
        include: {
          messages: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              photoUrl: true,
            },
          },
        },
      });
    }

    // Mark messages as read by user
    if (chatRoom && (chatRoom as any).unreadByUser > 0) {
      await (db as any).chatMessage.updateMany({
        where: {
          roomId: (chatRoom as Record<string, unknown>).id,
          isRead: false,
          NOT: { senderId: userId },
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      await (db as any).chatRoom.update({
        where: { id: (chatRoom as Record<string, unknown>).id },
        data: { unreadByUser: 0 },
      });
    }

    return NextResponse.json({ room: chatRoom });
  } catch (error) {
    console.error('Error getting chat room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete user's chat room
export async function DELETE(request: NextRequest) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = authedUser.id;

    // Check if models exist
    const dbAny: any = db;
    if (!dbAny.chatRoom || !dbAny.chatMessage) {
      return NextResponse.json({ error: 'Chat not available' }, { status: 503 });
    }

    // Find user's active chat room
    const chatRoom = await dbAny.chatRoom.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    if (!chatRoom) {
      return NextResponse.json({ error: 'No active chat room found' }, { status: 404 });
    }

    const roomId = (chatRoom as Record<string, unknown>).id as string;

    // Delete all messages first
    await dbAny.chatMessage.deleteMany({
      where: { roomId },
    });

    // Delete the chat room
    await dbAny.chatRoom.delete({
      where: { id: roomId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
