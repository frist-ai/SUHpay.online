import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { verifyUser, verifyAdmin } from '@/lib/auth-helpers';

// Helper function to check if user is admin based on ADMIN_TELEGRAM_IDS
function isAdminUser(telegramId: string): boolean {
  return env.isAdmin(telegramId);
}

// Generate unique ID
function generateId(): string {
  return `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// GET /api/users - Get user by telegram ID
export async function GET(request: NextRequest) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const telegramId = authedUser.telegramId;

    const user = await db.user.findUnique({
      where: { telegramId },
      include: {
        addresses: {
          orderBy: { isDefault: 'desc' },
        },
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            favorites: true,
            orders: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

// POST /api/users - Create or update user (Telegram auth)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      telegramId, 
      username, 
      firstName, 
      lastName, 
      photoUrl,
      languageCode,
      authDate,
      role: requestedRole, // For demo mode
    } = body;

    if (!telegramId) {
      return NextResponse.json({ error: 'telegramId is required' }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { telegramId },
    });

    let user;

    if (existingUser) {
      // Update existing user - ONLY update fields that user hasn't customized
      // IMPORTANT: Role is ALWAYS derived from ADMIN_TELEGRAM_IDS
      // IMPORTANT: firstName/lastName are ONLY updated on first creation, never overwritten
      // This preserves user's custom profile edits
      const shouldBeAdmin = isAdminUser(telegramId);
      const newRole = shouldBeAdmin ? 'admin' : 'customer';
      
      const updateData = {
        // Only update username from Telegram (user can't change it)
        username: username || existingUser.username,
        // DON'T overwrite firstName/lastName - user may have customized them
        // Always sync photoUrl from Telegram (takes priority over DB)
        photoUrl: photoUrl || existingUser.photoUrl,
        languageCode: languageCode || existingUser.languageCode,
        authDate: authDate ? new Date(authDate * 1000) : existingUser.authDate,
        lastVisitAt: new Date(),
        isActive: true,
        // ALWAYS sync role with ADMIN_TELEGRAM_IDS
        role: newRole,
      };
      
      user = await db.user.update({
        where: { telegramId },
        data: updateData,
      });

      // Role synced if needed
    } else {
      // Create new user
      // Get loyalty settings for welcome bonus
      const loyaltySettings = await db.setting.findUnique({
        where: { key: 'loyalty' },
      });

      let welcomeBonus = 100; // Default welcome bonus
      if (loyaltySettings) {
        try {
          const parsed = JSON.parse(loyaltySettings.value);
          welcomeBonus = parsed.welcomeBonus || 100;
        } catch {
          // Use default
        }
      }

      // Determine role: check ADMIN_TELEGRAM_IDS first, then requested role (for demo), then default to customer
      let finalRole: 'admin' | 'customer' = 'customer';
      if (isAdminUser(telegramId)) {
        finalRole = 'admin';
      } else if (requestedRole === 'admin' || requestedRole === 'customer') {
        // Allow demo mode to specify role
        finalRole = requestedRole;
      }

      user = await db.user.create({
        data: {
          id: generateId(),
          telegramId,
          username: username || null,
          firstName: firstName || null,
          lastName: lastName || null,
          photoUrl: photoUrl || null,
          languageCode: languageCode || null,
          authDate: authDate ? new Date(authDate * 1000) : null,
          lastVisitAt: new Date(),
          loyaltyPoints: welcomeBonus,
          role: finalRole,
          updatedAt: new Date(),
        },
      });

      // Create welcome notification
      await db.notification.create({
        data: {
          id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: user.id,
          type: 'system',
          title: 'Добро пожаловать! 🎉',
          message: `Вам начислено ${welcomeBonus} бонусных баллов за регистрацию!`,
        },
      });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return NextResponse.json({ error: 'Failed to create/update user' }, { status: 500 });
  }
}

// PUT /api/users - Update user profile (individual user editing their own profile)
export async function PUT(request: NextRequest) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { firstName, lastName, phone, email, photoUrl } = body;

    const telegramId = authedUser.telegramId;

    // Verify the user exists
    const existingUser = await db.user.findUnique({
      where: { telegramId },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build update data - only update fields that are explicitly provided
    const updateData: {
      firstName?: string | null;
      lastName?: string | null;
      phone?: string | null;
      email?: string | null;
      photoUrl?: string | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    // Only update fields that are provided (not undefined)
    if (firstName !== undefined) updateData.firstName = firstName || null;
    if (lastName !== undefined) updateData.lastName = lastName || null;
    if (phone !== undefined) {
      if (phone && phone.trim()) {
        // Server-side phone validation
        const trimmed = phone.trim();
        const digits = trimmed.replace(/[^\d]/g, '');
        if (!/^[\d\s\-+()]+$/.test(trimmed)) {
          return NextResponse.json({ error: 'Недопустимые символы в номере телефона' }, { status: 400 });
        }
        if (digits.length < 10 || digits.length > 11) {
          return NextResponse.json({ error: 'Номер телефона должен содержать 10–11 цифр' }, { status: 400 });
        }
        if (digits.length === 11 && !/^[78]/.test(digits)) {
          return NextResponse.json({ error: 'Номер телефона должен начинаться с 7 или 8' }, { status: 400 });
        }
        // DEF-код (первые 3 цифры после 7/8) должен быть 900–999
        const tenDigits = digits.length === 11 ? digits.slice(1) : digits;
        const defCode = parseInt(tenDigits.slice(0, 3), 10);
        if (defCode < 900 || defCode > 999) {
          return NextResponse.json({ error: 'Некорректный код оператора (должен быть 900–999)' }, { status: 400 });
        }
        // Normalize: 8→+7
        updateData.phone = digits.length === 11 ? `+7${digits.slice(1)}` : `+7${digits}`;
      } else {
        updateData.phone = null;
      }
    }
    if (email !== undefined) updateData.email = email || null;
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl || null;

    // Update user
    const user = await db.user.update({
      where: { telegramId },
      data: updateData,
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('[PUT /api/users] Error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/users - Delete user (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const telegramId = searchParams.get('telegramId');
    const requesterId = adminUser.telegramId;

    if (!telegramId) {
      return NextResponse.json({ error: 'telegramId is required' }, { status: 400 });
    }

    // Don't allow deleting yourself
    if (telegramId === requesterId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete user (cascade will handle related records)
    await db.user.delete({
      where: { telegramId },
    });

    return NextResponse.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
