import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { verifyAdmin, verifyUser } from '@/lib/auth-helpers';

// GET payment transactions
export async function GET(request: NextRequest) {
  const { error } = await verifyAdmin(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const status = searchParams.get('status');
    
    const { db } = await import('@/lib/db');
    
    if (!db) {
      return NextResponse.json({ transactions: [] });
    }

    const where: Record<string, unknown> = {};
    if (orderId) where.orderId = orderId;
    if (status) where.status = status;

    const transactions = await db.paymentTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ transactions: [] });
  }
}

// POST create payment transaction
// Regular users can create transactions for their own orders (during checkout).
// Admins can create transactions for any order.
export async function POST(request: NextRequest) {
  const { user: authedUser, error: authError } = await verifyUser(request);
  if (authError) return authError;
  if (!authedUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const { db } = await import('@/lib/db');
    
    if (!db) {
      return NextResponse.json({
        id: `demo-${nanoid()}`,
        ...data,
        status: data.initialStatus || 'pending',
        createdAt: new Date().toISOString(),
      });
    }

    // Verify the user owns the order (unless admin)
    if (authedUser.role !== 'admin' && data.orderId) {
      const order = await db.order.findUnique({
        where: { id: data.orderId },
        select: { userId: true },
      });
      if (!order || order.userId !== authedUser.id) {
        return NextResponse.json(
          { error: 'Forbidden — you can only create transactions for your own orders' },
          { status: 403 }
        );
      }
    }

    const initialStatus = data.initialStatus || 'pending';
    const createData: Record<string, unknown> = {
      id: nanoid(),
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      status: initialStatus,
      cryptoAmount: data.cryptoAmount,
      expiresAt: data.expiresAt,
    };

    // If initialStatus is 'paid', set paidAt timestamp
    if (initialStatus === 'paid') {
      createData.paidAt = new Date();
    }

    const transaction = await db.paymentTransaction.create({
      data: createData as any,
    });

    // If created with 'paid' status, sync the order's paymentStatus
    if (initialStatus === 'paid' && data.orderId) {
      await db.order.update({
        where: { id: data.orderId },
        data: {
          paymentStatus: 'paid',
          paymentMethod: data.paymentMethod,
        },
      });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

// PATCH update transaction status
// Users can set 'pending_confirmation' (after paying).
// Only admins can set 'paid' (confirm payment on their end).
export async function PATCH(request: NextRequest) {
  try {
    // Read body before auth (auth may need to clone the request)
    const clonedForBody = request.clone();
    const data = await clonedForBody.json();

    // ── Auth: 'paid' requires admin, 'pending_confirmation' requires any user ──
    const targetStatus = data.status;
    if (targetStatus === 'paid') {
      const { user: adminUser, error: adminError } = await verifyAdmin(request);
      if (adminError) return adminError;
      if (!adminUser) {
        return NextResponse.json({ error: 'Unauthorized — admin access required' }, { status: 401 });
      }
    } else {
      const { user: authedUser, error: userError } = await verifyUser(request);
      if (userError) return userError;
      if (!authedUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    const { db } = await import('@/lib/db');
    
    if (!db) {
      return NextResponse.json({ success: true });
    }

    const updateData: Record<string, unknown> = {
      status: data.status,
    };

    if (data.status === 'paid') {
      updateData.paidAt = new Date();
    }

    if (data.transactionId) {
      updateData.transactionId = data.transactionId;
    }

    if (data.cryptoTxHash) {
      updateData.cryptoTxHash = data.cryptoTxHash;
    }

    const transaction = await db.paymentTransaction.update({
      where: { id: data.id },
      data: updateData,
    });

    // Синхронизация статуса оплаты заказа
    if (data.status === 'paid') {
      await db.order.update({
        where: { id: transaction.orderId },
        data: {
          paymentStatus: 'paid',
          paymentMethod: transaction.paymentMethod,
        },
      });
    } else if (data.status === 'pending_confirmation') {
      await db.order.update({
        where: { id: transaction.orderId },
        data: { paymentStatus: 'pending_confirmation' },
      });
    }

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}
