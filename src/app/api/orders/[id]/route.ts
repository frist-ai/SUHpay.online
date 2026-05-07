import { NextRequest, NextResponse } from 'next/server';
import { sendPaymentNotifications, notifyCustomerAboutStatusUpdate, getCollectorTelegramIds, notifyCollectorsAboutStatusChange } from '@/lib/order-notifications';
import { nanoid } from 'nanoid';
import { verifyUser, verifyAdmin } from '@/lib/auth-helpers';

// Demo orders data (same as in route.ts)
const DEMO_ORDERS = [
  {
    id: '1',
    orderNumber: 'TG2503-ABC123',
    status: 'delivered',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    subtotal: 4200,
    discount: 0,
    deliveryCost: 300,
    total: 4500,
    deliveryMethod: 'cdek',
    deliveryCity: 'Москва',
    deliveryStreet: 'Ленина',
    deliveryHouse: '10',
    deliveryApartment: '25',
    contactName: 'Иван Петров',
    contactPhone: '+79001234567',
    trackingNumber: 'TRACK123456',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: '1',
        productId: '1',
        productName: 'Гречка "Алтайская" 800г',
        productSku: 'SUP-001',
        quantity: 5,
        price: 99,
        total: 495,
      },
      {
        id: '2',
        productId: '2',
        productName: 'Тушёнка говяжья 525г',
        productSku: 'SUP-002',
        quantity: 10,
        price: 350,
        total: 3500,
      },
    ],
    statusHistory: [
      { id: '1', status: 'pending', comment: 'Order created', createdAt: new Date().toISOString() },
      { id: '2', status: 'confirmed', comment: 'Order confirmed', createdAt: new Date().toISOString() },
      { id: '3', status: 'shipped', comment: 'Order shipped', createdAt: new Date().toISOString() },
      { id: '4', status: 'delivered', comment: 'Order delivered', createdAt: new Date().toISOString() },
    ],
  },
  {
    id: '2',
    orderNumber: 'TG2503-DEF456',
    status: 'shipped',
    paymentStatus: 'paid',
    paymentMethod: 'card',
    subtotal: 2800,
    discount: 0,
    deliveryCost: 400,
    total: 3200,
    deliveryMethod: 'cdek',
    deliveryCity: 'Санкт-Петербург',
    deliveryStreet: 'Невский проспект',
    deliveryHouse: '50',
    contactName: 'Мария Сидорова',
    contactPhone: '+79007654321',
    trackingNumber: 'TRACK789012',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    items: [
      {
        id: '3',
        productId: '3',
        productName: 'Чай чёрный 100г',
        productSku: 'SUP-003',
        quantity: 20,
        price: 85,
        total: 1700,
      },
    ],
    statusHistory: [
      { id: '5', status: 'pending', comment: 'Order created', createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: '6', status: 'confirmed', comment: 'Order confirmed', createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: '7', status: 'shipped', comment: 'Order shipped', createdAt: new Date().toISOString() },
    ],
  },
];

// Helper function to get order with proper relation names
async function getOrderWithRelations(db: any, id: string) {
  return await db.order.findFirst({
    where: {
      OR: [
        { id },
        { orderNumber: id },
      ],
    },
    include: {
      orderItems: {
        include: {
          product: true,
        },
      },
      orderStatusHistory: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

// Helper function to get order with items only
async function getOrderWithItems(db: any, id: string) {
  return await db.order.findUnique({
    where: { id },
    include: { orderItems: true },
  });
}

// GET /api/orders/[id] - Get order by ID (with access control)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const isAdmin = authedUser.role === 'admin';

    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL && !process.env.NEON_DATABASE_URL) {
      // No DATABASE_URL, returning demo order
      const order = DEMO_ORDERS.find(o => o.id === id || o.orderNumber === id);
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json(order);
    }

    // Try to use database
    const { db } = await import('@/lib/db');
    
    if (!db) {
      // No db client, returning demo order
      const order = DEMO_ORDERS.find(o => o.id === id || o.orderNumber === id);
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      return NextResponse.json(order);
    }

    const order = await getOrderWithRelations(db, id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Access control: only owner or admin can view the order
    if (!isAdmin && order.userId !== authedUser.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    // Return demo data on error
    const { id } = await params;
    const order = DEMO_ORDERS.find(o => o.id === id || o.orderNumber === id);
    if (order) {
      return NextResponse.json(order);
    }
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

// PUT /api/orders/[id] - Update order status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: authedUser, error: authError } = await verifyUser(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL && !process.env.NEON_DATABASE_URL) {
      // No DATABASE_URL, returning demo order update
      const orderIndex = DEMO_ORDERS.findIndex(o => o.id === id || o.orderNumber === id);
      if (orderIndex === -1) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      
      const updatedOrder = {
        ...DEMO_ORDERS[orderIndex],
        ...body,
        updatedAt: new Date().toISOString(),
      };
      
      return NextResponse.json(updatedOrder);
    }

    // Try to use database
    const { db } = await import('@/lib/db');
    
    if (!db) {
      // No db client, returning demo order update
      const orderIndex = DEMO_ORDERS.findIndex(o => o.id === id || o.orderNumber === id);
      if (orderIndex === -1) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      
      const updatedOrder = {
        ...DEMO_ORDERS[orderIndex],
        ...body,
        updatedAt: new Date().toISOString(),
      };
      
      return NextResponse.json(updatedOrder);
    }

    // First get the current order to check status change
    const currentOrder = await getOrderWithItems(db, id);

    if (!currentOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (body.status) {
      updateData.status = body.status;
      
      // Set timestamps based on status
      if (body.status === 'confirmed') {
        updateData.confirmedAt = new Date();
      } else if (body.status === 'shipped') {
        updateData.shippedAt = new Date();
      } else if (body.status === 'delivered') {
        updateData.deliveredAt = new Date();
      } else if (body.status === 'cancelled') {
        updateData.cancelledAt = new Date();
        
        // Return items to stock when order is cancelled (transactional)
        // Only if the order was not already cancelled
        if (currentOrder.status !== 'cancelled') {
          const orderItems = currentOrder.orderItems || [];
          await db.$transaction(async (tx: any) => {
            for (const item of orderItems) {
              const product = await tx.product.update({
                where: { id: item.productId },
                data: {
                  stock: { increment: item.quantity },
                  skuCount: { decrement: item.quantity },
                },
              });
              // Auto-show product when stock returns to >0
              if (product.stock > 0 && !product.isActive) {
                await tx.product.update({
                  where: { id: item.productId },
                  data: { isActive: true },
                });
              }
            }
          });
        }
      }

      // Create status history
      await db.orderStatusHistory.create({
        data: {
          orderId: id,
          status: body.status,
          comment: body.comment,
        },
      });
    }

    if (body.paymentStatus) {
      updateData.paymentStatus = body.paymentStatus;
    }

    if (body.trackingNumber !== undefined) {
      updateData.trackingNumber = body.trackingNumber;
    }

    const order = await db.order.update({
      where: { id },
      data: updateData,
      include: { orderItems: true },
    });

    // Send notifications for payment status change
    if (body.paymentStatus === 'paid' && currentOrder.paymentStatus !== 'paid') {
      // Get user info for notifications
      const user = currentOrder.userId ? await db.user.findUnique({
        where: { id: currentOrder.userId },
        select: { id: true, telegramId: true, firstName: true, lastName: true, username: true },
      }) : null;

      // Prepare order data for notifications
      const orderForNotification = {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        subtotal: order.subtotal,
        discount: order.discount,
        deliveryCost: order.deliveryCost,
        total: order.total,
        deliveryMethod: order.deliveryMethod,
        deliveryService: order.deliveryService,
        deliveryCity: order.deliveryCity,
        deliveryStreet: order.deliveryStreet,
        deliveryHouse: order.deliveryHouse,
        deliveryApartment: order.deliveryApartment,
        deliveryPostalCode: order.deliveryPostalCode,
        deliveryComment: order.deliveryComment,
        deliverySlot: order.deliverySlot,
        contactName: order.contactName,
        contactPhone: order.contactPhone,
        items: (order.orderItems || []).map((item: any) => ({
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
        createdAt: order.createdAt,
      };

      // Send payment notifications asynchronously
      sendPaymentNotifications(orderForNotification as any, user || undefined).catch(err => {
        console.error('[Orders] Failed to send payment notifications:', err);
      });

      // Create in-app notification for payment
      if (currentOrder.userId) {
        try {
          await db.notification.create({
            data: {
              id: nanoid(),
              userId: currentOrder.userId,
              type: 'payment',
              title: 'Оплата получена',
              message: `Оплата за заказ #${order.orderNumber} на сумму ${order.total.toLocaleString('ru-RU')} ₽ успешно получена!`,
              data: JSON.stringify({ orderId: order.id, orderNumber: order.orderNumber }),
            },
          });
          // Payment notification created
        } catch (notifError) {
          console.error('[Orders] Failed to create payment notification:', notifError);
        }
      }
    }

    // Send notifications for order status change to customer
    if (body.status && body.status !== currentOrder.status) {
      // Get user info for notifications
      const user = currentOrder.userId ? await db.user.findUnique({
        where: { id: currentOrder.userId },
        select: { id: true, telegramId: true, firstName: true, lastName: true, username: true },
      }) : null;

      // Prepare order data for notifications
      const orderForNotification = {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        subtotal: order.subtotal,
        discount: order.discount,
        deliveryCost: order.deliveryCost,
        total: order.total,
        deliveryMethod: order.deliveryMethod,
        deliverySlot: order.deliverySlot,
        items: (order.orderItems || []).map((item: any) => ({
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
        })),
        createdAt: order.createdAt,
      };

      // Send status update notification to customer (pass previous status for transition)
      notifyCustomerAboutStatusUpdate(orderForNotification as any, body.status, user?.telegramId, currentOrder.status).catch(err => {
        console.error('[Orders] Failed to send status notification:', err);
      });

      // Notify collectors about status change
      try {
        const collectorIds = await getCollectorTelegramIds(db);
        notifyCollectorsAboutStatusChange(orderForNotification as any, body.status, collectorIds).catch(err => {
          console.error('[Orders] Failed to send collector status notification:', err);
        });
      } catch (collectorErr) {
        console.error('[Orders] Failed to get collector IDs:', collectorErr);
      }

      // Create in-app notification for status change
      if (currentOrder.userId) {
        const statusLabels: Record<string, string> = {
          pending: 'Ожидает обработки',
          processing: 'В обработке',
          confirmed: 'Подтверждён',
          shipped: 'Отправлен',
          delivered: 'Доставлен',
          completed: 'Выполнен',
          cancelled: 'Отменён',
        };
        
        try {
          await db.notification.create({
            data: {
              id: nanoid(),
              userId: currentOrder.userId,
              type: 'order_status',
              title: 'Статус заказа изменён',
              message: `Заказ #${order.orderNumber}: ${statusLabels[body.status] || body.status}`,
              data: JSON.stringify({ orderId: order.id, orderNumber: order.orderNumber, status: body.status }),
            },
          });
          // Status notification created
        } catch (notifError) {
          console.error('[Orders] Failed to create status notification:', notifError);
        }
      }
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

// DELETE /api/orders/[id] - Delete order (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL && !process.env.NEON_DATABASE_URL) {
      return NextResponse.json({ success: true, message: 'Demo order deleted' });
    }

    const { db } = await import('@/lib/db');
    
    if (!db) {
      return NextResponse.json({ success: true, message: 'Demo order deleted' });
    }

    // Get order items first to return to stock if needed
    const order = await getOrderWithItems(db, id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // If order was not cancelled, return items to stock and delete order in a transaction
    if (order.status !== 'cancelled') {
      const orderItems = order.orderItems || [];
      await db.$transaction(async (tx: any) => {
        for (const item of orderItems) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
              skuCount: { decrement: item.quantity },
            },
          });
        }
        // Delete order (cascade will delete items and status history)
        await tx.order.delete({
          where: { id },
        });
      });
    } else {
      // Already cancelled, just delete
      await db.order.delete({
        where: { id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
  }
}
