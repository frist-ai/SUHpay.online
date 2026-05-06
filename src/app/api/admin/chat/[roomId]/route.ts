import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { verifyAdmin } from '@/lib/auth-helpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Get specific chat room with messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { user, error } = await verifyAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { roomId } = await params;

    // Check if models exist
    const dbAny: any = db;
    if (!dbAny.chatRoom || !dbAny.chatMessage) {
      return NextResponse.json({ error: 'Chat not available' }, { status: 503 });
    }

    const chatRoom = await dbAny.chatRoom.findUnique({
      where: { id: roomId },
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
          take: 100,
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
      },
    });

    if (!chatRoom) {
      return NextResponse.json({ error: 'Chat room not found' }, { status: 404 });
    }

    // Mark messages as read by admin
    const room = chatRoom as Record<string, unknown>;
    if ((room.unreadByAdmin as number) > 0) {
      await dbAny.chatMessage.updateMany({
        where: {
          roomId: room.id,
          isRead: false,
          senderId: { not: user.id },
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      await dbAny.chatRoom.update({
        where: { id: room.id },
        data: { unreadByAdmin: 0 },
      });
    }

    return NextResponse.json({ room: chatRoom });
  } catch (error) {
    console.error('Error getting chat room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Admin sends a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { user, error } = await verifyAdmin(request);
  if (error) return error;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { roomId } = await params;
    const body = await request.json();
    const { content, type = 'text' } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    // Check if models exist
    const dbAny: any = db;
    if (!dbAny.chatRoom || !dbAny.chatMessage) {
      return NextResponse.json({ error: 'Chat not available' }, { status: 503 });
    }

    // Check room exists
    const chatRoom = await dbAny.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!chatRoom) {
      return NextResponse.json({ error: 'Chat room not found' }, { status: 404 });
    }

    // Create message
    const message = await dbAny.chatMessage.create({
      data: {
        id: nanoid(),
        roomId,
        senderId: user.id,
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

    // Update chat room
    await dbAny.chatRoom.update({
      where: { id: roomId },
      data: {
        lastMessage: content.trim().substring(0, 100),
        lastMessageAt: new Date(),
        unreadByUser: { increment: 1 },
      },
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update chat room status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const { roomId } = await params;
    const body = await request.json();
    const { status } = body;

    // Check if models exist
    const dbAny: any = db;
    if (!dbAny.chatRoom) {
      return NextResponse.json({ error: 'Chat not available' }, { status: 503 });
    }

    const chatRoom = await dbAny.chatRoom.update({
      where: { id: roomId },
      data: { status },
    });

    return NextResponse.json({ room: chatRoom });
  } catch (error) {
    console.error('Error updating chat room:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete chat room (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const { roomId } = await params;

    // Check if models exist
    const dbAny: any = db;
    if (!dbAny.chatRoom || !dbAny.chatMessage) {
      return NextResponse.json({ error: 'Chat not available' }, { status: 503 });
    }

    // Check room exists
    const chatRoom = await dbAny.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!chatRoom) {
      return NextResponse.json({ error: 'Chat room not found' }, { status: 404 });
    }

    // Delete all messages first (cascade should handle this, but be explicit)
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
