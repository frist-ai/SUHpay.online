import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { nanoid } from 'nanoid';
import { verifyAdmin, verifyUser } from '@/lib/auth-helpers';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Get notifications for the current user
export async function GET(request: NextRequest) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = new URL(request.url).searchParams;
    const userId = authedUser.id;

    const dbAny: any = db;
    
    // Check if notification model is available
    if (!dbAny.notification) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    // Build query
    const where: Record<string, unknown> = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    // Get notifications
    const notifications = await dbAny.notification.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    // Get unread count
    const unreadCount = await dbAny.notification.count({
      where: { userId, isRead: false },
    });

    return NextResponse.json({ 
      notifications: (notifications as unknown[]).reverse(),
      unreadCount 
    });
  } catch (error) {
    console.error('[Notifications API] Error getting notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create a notification (internal use)
export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = adminUser.id;
    const userRole = request.headers.get('x-user-role');
    
    // Only admins can create notifications for other users
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { targetUserId, type, title, message, data } = body;

    if (!targetUserId || !type || !title || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const dbAny: any = db;
    
    if (!dbAny.notification) {
      console.error('[Notifications API] Notification model not available');
      return NextResponse.json({ 
        error: 'Notification service temporarily unavailable' 
      }, { status: 503 });
    }

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

    return NextResponse.json({ notification });
  } catch (error) {
    console.error('[Notifications API] Error creating notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Mark notifications as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationIds, markAll, userId } = body;
    
    // Get userId from body or headers
    const targetUserId = userId || request.headers.get('x-user-id');
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbAny: any = db;
    
    if (!dbAny.notification) {
      return NextResponse.json({ 
        error: 'Notification service temporarily unavailable' 
      }, { status: 503 });
    }

    if (markAll) {
      // Mark all as read for this user
      await dbAny.notification.updateMany({
        where: { userId: targetUserId, isRead: false },
        data: { isRead: true },
      });
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      await dbAny.notification.updateMany({
        where: { 
          id: { in: notificationIds },
          userId: targetUserId 
        },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notifications API] Error marking notifications as read:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete notifications
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationIds, deleteAll, userId } = body;
    
    // Get userId from body or headers
    const targetUserId = userId || request.headers.get('x-user-id');
    
    if (!targetUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbAny: any = db;
    
    if (!dbAny.notification) {
      return NextResponse.json({ 
        error: 'Notification service temporarily unavailable' 
      }, { status: 503 });
    }

    if (deleteAll) {
      // Delete all notifications for this user
      await dbAny.notification.deleteMany({
        where: { userId: targetUserId },
      });
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Delete specific notifications
      await dbAny.notification.deleteMany({
        where: { 
          id: { in: notificationIds },
          userId: targetUserId 
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Notifications API] Error deleting notifications:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
