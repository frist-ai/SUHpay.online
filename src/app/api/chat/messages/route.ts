import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { verifyUser } from '@/lib/auth-helpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Helper function to create notification
async function createNotification(
  dbAny: any,  targetUserId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
) {
  if (!dbAny.notification) {
    return null;
  }

  try {
    const notification = await dbAny.notification.create({
      data: {
        id: nanoid(),
        userId: targetUserId,
        type,
        title,
        message,
        data: data ? JSON.stringify(data) : null,
      },
    });
    return notification;
  } catch (error) {
    console.error('[Chat API] Error creating notification:', error);
    return null;
  }
}

// Helper function to notify all admins
async function notifyAdmins(
  dbAny: any,  senderName: string,
  messagePreview: string,
  roomId: string
) {
  try {
    // Find all admin users
    const admins = await dbAny.user.findMany({
      where: { role: 'admin', isActive: true },
      select: { id: true },
    });

    // Create notification for each admin
    for (const admin of admins as Array<{id: string}>) {
      await createNotification(
        dbAny,
        admin.id,
        'support_message',
        'Новое сообщение в поддержке',
        `${senderName}: ${messagePreview}`,
        { roomId }
      );
    }
  } catch (error) {
    console.error('[Chat API] Error notifying admins:', error);
  }
}

// Send a message
export async function POST(request: NextRequest) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = authedUser.id;
    const userRole = authedUser.role;

    const body = await request.json();
    const { content, type = 'text' } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    // Check if models are available
    const dbAny: any = db;
    
    if (!dbAny.chatRoom || !dbAny.chatMessage) {
      console.error('[Chat API] Chat models not available in Prisma client');
      return NextResponse.json({ 
        error: 'Chat service temporarily unavailable. Please try again later.'
      }, { status: 503 });
    }

    // Find or create active chat room
    let chatRoom = await dbAny.chatRoom.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    if (!chatRoom) {
      chatRoom = await dbAny.chatRoom.create({
        data: {
          id: nanoid(),
          userId,
          status: 'active',
        },
      });
    }

    // Get sender info for notification
    const sender = await dbAny.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, username: true, role: true },
    });
    const senderName = sender 
      ? ((sender as {firstName?: string, lastName?: string, username?: string}).firstName || 
         (sender as {firstName?: string, lastName?: string, username?: string}).username || 
         'Пользователь')
      : 'Пользователь';
    const isAdmin = (sender as {role?: string})?.role === 'admin';

    // Create message
    const message = await dbAny.chatMessage.create({
      data: {
        id: nanoid(),
        roomId: (chatRoom as Record<string, unknown>).id as string,
        senderId: userId,
        content: content.trim(),
        type,
      },
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
    });

    const messagePreview = content.trim().substring(0, 50);

    // Update chat room and send notifications based on sender role
    if (isAdmin) {
      // Admin is replying - update unread count for user and notify user
      await dbAny.chatRoom.update({
        where: { id: (chatRoom as Record<string, unknown>).id },
        data: {
          lastMessage: content.trim().substring(0, 100),
          lastMessageAt: new Date(),
          unreadByUser: { increment: 1 },
        },
      });

      // Notify the user who owns the chat room
      await createNotification(
        dbAny,
        (chatRoom as {userId: string}).userId,
        'support_reply',
        'Ответ от поддержки',
        `Администратор: ${messagePreview}`,
        { roomId: (chatRoom as {id: string}).id }
      );
    } else {
      // User is sending message - update unread count for admin and notify admins
      await dbAny.chatRoom.update({
        where: { id: (chatRoom as Record<string, unknown>).id },
        data: {
          lastMessage: content.trim().substring(0, 100),
          lastMessageAt: new Date(),
          unreadByAdmin: { increment: 1 },
        },
      });

      // Notify all admins
      await notifyAdmins(dbAny, senderName, messagePreview, (chatRoom as {id: string}).id);
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error('[Chat API] Error sending message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Get messages for a room (with pagination)
export async function GET(request: NextRequest) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = authedUser.id;

    // Check if models are available
    const dbAny: any = db;
    if (!dbAny.chatRoom || !dbAny.chatMessage) {
      return NextResponse.json({ messages: [] });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before'); // message ID for pagination

    // Find user's active chat room
    const chatRoom = await dbAny.chatRoom.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    if (!chatRoom) {
      return NextResponse.json({ messages: [] });
    }

    // Build query
    const where: Record<string, unknown> = { roomId: (chatRoom as Record<string, unknown>).id };
    if (before) {
      const beforeMessage = await dbAny.chatMessage.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (beforeMessage) {
        where.createdAt = { lt: (beforeMessage as Record<string, unknown>).createdAt };
      }
    }

    const messages = await dbAny.chatMessage.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
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
    });

    // Mark as read
    await dbAny.chatMessage.updateMany({
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

    await dbAny.chatRoom.update({
      where: { id: (chatRoom as Record<string, unknown>).id },
      data: { unreadByUser: 0 },
    });

    return NextResponse.json({ messages: (messages as unknown[]).reverse() });
  } catch (error) {
    console.error('[Chat API] Error getting messages:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete a message
export async function DELETE(request: NextRequest) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = authedUser.id;
    const userRole = authedUser.role;

    const body = await request.json();
    const { messageId } = body;

    if (!messageId) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    const dbAny: any = db;
    
    if (!dbAny.chatMessage) {
      return NextResponse.json({ 
        error: 'Chat service temporarily unavailable' 
      }, { status: 503 });
    }

    // Get the message to check ownership
    const message = await dbAny.chatMessage.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, roomId: true },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Check if user can delete this message
    // Admins can delete any message, users can only delete their own
    const isAdmin = userRole === 'admin';
    const isOwner = (message as {senderId: string}).senderId === userId;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the message
    await dbAny.chatMessage.delete({
      where: { id: messageId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Chat API] Error deleting message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
