import { NextRequest, NextResponse } from 'next/server';
import { sendOrderNotifications, sendPaymentNotifications, getCollectorTelegramIds } from '@/lib/order-notifications';
import { addLoyaltyPoints, calculateOrderPoints, updateUserStatsAfterOrder } from '@/lib/loyalty';
import { verifyUserWithCollector } from '@/lib/auth-helpers';
import { nanoid } from 'nanoid';

// Demo orders data
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
  },
];

// Generate order number
function generateOrderNumber() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TG${year}${month}-${random}`;
}

// Helper function to get orders with proper relation names
async function getOrdersWithItems(db: any, where: Record<string, unknown>, limit: number, offset: number) {
  try {
    // Use schema relation names (orderItems, not items)
    const orders = await db.order.findMany({
      where,
      include: { orderItems: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    
    // Map orderItems to items for frontend compatibility
    // Explicitly preserve customerComment and deliveryComment
    return orders.map((order: any) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      subtotal: order.subtotal,
      discount: order.discount,
      deliveryCost: order.deliveryCost,
      total: order.total,
      deliveryMethod: order.deliveryMethod,
      deliveryService: order.deliveryService,
      trackingNumber: order.trackingNumber,
      deliveryCity: order.deliveryCity,
      deliveryStreet: order.deliveryStreet,
      deliveryHouse: order.deliveryHouse,
      deliveryApartment: order.deliveryApartment,
      deliveryPostalCode: order.deliveryPostalCode,
      deliveryComment: order.deliveryComment,
      deliverySlot: order.deliverySlot,
      customerComment: order.customerComment,
      contactName: order.contactName,
      contactPhone: order.contactPhone,
      contactEmail: order.contactEmail,
      confirmedAt: order.confirmedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.orderItems || [],
    }));
  } catch {
    // Fallback without relations
    const orders = await db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    return orders.map((order: any) => ({
      ...order,
      items: [],
    }));
  }
}

// GET /api/orders - Get orders
export async function GET(request: NextRequest) {
  try {
    const { user: authedUser, isCollector, error: authError } = await verifyUserWithCollector(request);
    if (authError) return authError;
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    // Admins and collectors can see all orders (collectors need to assemble them)
    const isAdmin = authedUser.role === 'admin';
    const canSeeAllOrders = isAdmin || isCollector;
    
    // Non-admin/collector users can only see their own orders
    const userId = canSeeAllOrders ? searchParams.get('userId') : authedUser.id;

    // Filter demo orders if needed
    let filteredOrders = [...DEMO_ORDERS];
    if (status) {
      filteredOrders = filteredOrders.filter(o => o.status === status);
    }

    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      // No DATABASE_URL, returning demo orders
      return NextResponse.json({
        orders: filteredOrders,
        total: filteredOrders.length,
        limit: 20,
        offset: 0,
        hasMore: false,
      });
    }

    // Try to use database
    const { db } = await import('@/lib/db');
    
    if (!db) {
      // No db client, returning demo orders
      return NextResponse.json({
        orders: filteredOrders,
        total: filteredOrders.length,
        limit: 20,
        offset: 0,
        hasMore: false,
      });
    }

    const limit = parseInt(searchParams.get('limit') || '9999');
    const offset = parseInt(searchParams.get('offset') || '0');

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    // Exclude certain statuses (e.g., for collector view)
    const excludeStatuses = searchParams.get('excludeStatuses');
    if (excludeStatuses) {
      const statuses = excludeStatuses.split(',').map(s => s.trim());
      if (statuses.length === 1) {
        where.status = { not: statuses[0] };
      } else {
        where.status = { notIn: statuses };
      }
    }

    const [orders, total] = await Promise.all([
      getOrdersWithItems(db, where, limit, offset),
      db.order.count({ where }),
    ]);

    return NextResponse.json({
      orders,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    // Return demo data on any error
    return NextResponse.json({
      orders: DEMO_ORDERS,
      total: DEMO_ORDERS.length,
      limit: 20,
      offset: 0,
      hasMore: false,
    });
  }
}

// POST /api/orders - Create new order
export async function POST(request: NextRequest) {
  try {
    // ── Auth check: user must be authenticated ──
    const { user: authedUser, error: authError } = await verifyUserWithCollector(request);
    if (authError) return authError;
    if (!authedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const orderNumber = generateOrderNumber();

    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      // No DATABASE_URL, returning demo order creation
      return NextResponse.json({
        id: 'demo-' + Date.now(),
        orderNumber,
        status: 'pending',
        paymentStatus: 'pending',
        ...body,
        createdAt: new Date().toISOString(),
        items: body.items || [],
      }, { status: 201 });
    }

    // Try to use database
    const { db } = await import('@/lib/db');
    
    if (!db) {
      // No db client, returning demo order creation
      return NextResponse.json({
        id: 'demo-' + Date.now(),
        orderNumber,
        status: 'pending',
        paymentStatus: 'pending',
        ...body,
        createdAt: new Date().toISOString(),
        items: body.items || [],
      }, { status: 201 });
    }

    const items = body.items || [];

    // ── Idempotency: reject duplicate order within 30 seconds for the same user ──
    const recentOrder = await db.order.findFirst({
      where: {
        userId: authedUser.id,
        createdAt: { gte: new Date(Date.now() - 30_000) },
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recentOrder) {
      // Check if the same items (same productIds) — simple dedup
      const recentItems = await db.orderItem.findMany({
        where: { orderId: recentOrder.id },
      });
      const incomingIds = items.map((i: { productId: string }) => i.productId).sort().join(',');
      const recentIds = recentItems.map((i: { productId: string }) => i.productId).sort().join(',');
      if (incomingIds === recentIds) {
        console.warn(`[Orders] Duplicate order prevented for user ${authedUser.id}, existing: ${recentOrder.orderNumber}`);
        return NextResponse.json({
          id: recentOrder.id,
          orderNumber: recentOrder.orderNumber,
          userId: recentOrder.userId,
          status: recentOrder.status,
          paymentStatus: recentOrder.paymentStatus,
          paymentMethod: recentOrder.paymentMethod,
          subtotal: recentOrder.subtotal,
          discount: recentOrder.discount,
          deliveryCost: recentOrder.deliveryCost,
          total: recentOrder.total,
          deliveryMethod: recentOrder.deliveryMethod,
          deliveryService: recentOrder.deliveryService,
          trackingNumber: recentOrder.trackingNumber,
          deliveryCity: recentOrder.deliveryCity,
          deliveryStreet: recentOrder.deliveryStreet,
          deliveryHouse: recentOrder.deliveryHouse,
          deliveryApartment: recentOrder.deliveryApartment,
          deliveryPostalCode: recentOrder.deliveryPostalCode,
          deliveryComment: recentOrder.deliveryComment,
          deliverySlot: recentOrder.deliverySlot,
          customerComment: recentOrder.customerComment,
          contactName: recentOrder.contactName,
          contactPhone: recentOrder.contactPhone,
          contactEmail: recentOrder.contactEmail,
          createdAt: recentOrder.createdAt,
          updatedAt: recentOrder.updatedAt,
          items: recentItems,
          duplicate: true,
        }, { status: 409 });
      }
    }

    // ── Validate financial fields from request body ──
    const rawDiscount = Number(body.discount) || 0;
    const rawDeliveryCost = Number(body.deliveryCost) || 0;

    if (!Number.isFinite(rawDiscount) || rawDiscount < 0) {
      return NextResponse.json(
        { error: 'Invalid discount value', details: 'discount must be a finite non-negative number' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(rawDeliveryCost) || rawDeliveryCost < 0) {
      return NextResponse.json(
        { error: 'Invalid delivery cost', details: 'deliveryCost must be a finite non-negative number' },
        { status: 400 },
      );
    }

    // ── Transactional order creation with atomic stock reservation ──
    const order = await db.$transaction(async (tx) => {
      // 1. Fetch all products and verify existence
      const productIds = items.map((item: { productId: string }) => item.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      const productMap = new Map<string, any>(products.map((p: any) => [p.id, p]));

      // Verify all products exist
      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }
      }

      // 2. Build order items and compute subtotal
      let subtotal = 0;
      const orderItems = items.map((item: { productId: string; quantity: number }) => {
        const product = productMap.get(item.productId)!;
        const price = product.discountPrice || product.price;
        const total = price * item.quantity;
        subtotal += total;
        return {
          productId: item.productId,
          productName: product.name,
          productSku: product.sku,
          quantity: item.quantity,
          price,
          total,
        };
      });

      // 3. Validate computed financial totals
      if (subtotal <= 0) {
        throw new Error('INVALID_TOTALS: subtotal must be greater than 0');
      }
      const total = subtotal + rawDeliveryCost - rawDiscount;
      if (!Number.isFinite(total) || total < 0) {
        throw new Error('INVALID_TOTALS: total must be a finite non-negative number');
      }

      // 4. Atomically reserve stock for each product (prevents race conditions)
      // Uses UPDATE ... WHERE stock >= qty — a single atomic DB operation
      const insufficientStockItems: string[] = [];
      for (const item of items) {
        const product = productMap.get(item.productId)!;
        const result = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
            skuCount: { increment: item.quantity },
          },
        });

        if (result.count === 0) {
          // Stock was already depleted by another concurrent order
          const currentStock = await tx.product.findUnique({
            where: { id: item.productId },
            select: { stock: true },
          });
          insufficientStockItems.push(
            `${product.name} (SKU: ${product.sku || item.productId}): requested ${item.quantity}, available ${currentStock?.stock ?? 0}`,
          );
        }
      }

      if (insufficientStockItems.length > 0) {
        throw new Error(`INSUFFICIENT_STOCK: ${insufficientStockItems.join('; ')}`);
      }

      // 5. Auto-hide products whose stock reached 0 after decrement
      const updatedProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, stock: true, isActive: true },
      });
      for (const p of updatedProducts) {
        if (p.stock <= 0 && p.isActive) {
          await tx.product.update({
            where: { id: p.id },
            data: { isActive: false },
          });
        }
      }

      // 6. Create the order + order items
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          userId: authedUser.id,
          status: 'pending',
          paymentStatus: 'pending',
          paymentMethod: body.paymentMethod,
          subtotal,
          discount: rawDiscount,
          deliveryCost: rawDeliveryCost,
          total,
          deliveryMethod: body.deliveryMethod,
          deliveryService: body.deliveryService,
          deliveryCity: body.deliveryCity,
          deliveryStreet: body.deliveryStreet,
          deliveryHouse: body.deliveryHouse,
          deliveryApartment: body.deliveryApartment,
          deliveryPostalCode: body.deliveryPostalCode,
          deliveryComment: body.deliveryComment,
          deliverySlot: body.deliverySlot || null,
          contactName: body.contactName,
          contactPhone: body.contactPhone,
          contactEmail: body.contactEmail,
          customerComment: body.customerComment || null,
          orderItems: { create: orderItems },
        },
        include: { orderItems: true },
      });

      // 7. Create initial status history entry
      await tx.orderStatusHistory.create({
        data: { orderId: newOrder.id, status: 'pending', comment: 'Order created' },
      });

      return newOrder;
    });

    // Get user info for notifications
    const user = authedUser.id ? await db.user.findUnique({
      where: { id: authedUser.id },
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
      customerComment: order.customerComment,
      contactName: order.contactName,
      contactPhone: order.contactPhone,
      items: order.orderItems.map((item: any) => ({
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      })),
      createdAt: order.createdAt,
    };

    // Send Telegram notifications asynchronously (don't wait for them)
    // Include collector notifications
    const collectorIds = await getCollectorTelegramIds(db);
    sendOrderNotifications(orderForNotification as any, user || undefined, collectorIds).catch(err => {
      console.error('[Orders] Failed to send Telegram notifications:', err);
    });

    // Create in-app notification for the user
    if (authedUser.id) {
      try {
        await db.notification.create({
          data: {
            id: nanoid(),
            userId: authedUser.id,
            type: 'order_created',
            title: 'Заказ оформлен',
            message: `Ваш заказ #${order.orderNumber} успешно оформлен! Мы свяжемся с вами для подтверждения.`,
            data: JSON.stringify({ orderId: order.id, orderNumber: order.orderNumber }),
          },
        });
        // In-app notification created
      } catch (notifError) {
        console.error('[Orders] Failed to create in-app notification:', notifError);
      }

      // Award loyalty points for the order
      try {
        const pointsToAward = await calculateOrderPoints(authedUser.id, order.subtotal);
        if (pointsToAward > 0) {
          await addLoyaltyPoints(
            authedUser.id,
            pointsToAward,
            'earn',
            `Баллы за заказ #${orderNumber}`,
            order.id
          );
          // Loyalty points awarded
        }

        // Update user stats (total spent, orders count)
        await updateUserStatsAfterOrder(authedUser.id, order.total);
        // User stats updated
      } catch (loyaltyError) {
        console.error('[Orders] Failed to award loyalty points:', loyaltyError);
        // Don't fail the order if loyalty fails
      }
    }

    // Return order with items mapped from orderItems for frontend compatibility
    // Explicitly include all fields to ensure nothing is stripped
    return NextResponse.json({
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      subtotal: order.subtotal,
      discount: order.discount,
      deliveryCost: order.deliveryCost,
      total: order.total,
      deliveryMethod: order.deliveryMethod,
      deliveryService: order.deliveryService,
      trackingNumber: order.trackingNumber,
      deliveryCity: order.deliveryCity,
      deliveryStreet: order.deliveryStreet,
      deliveryHouse: order.deliveryHouse,
      deliveryApartment: order.deliveryApartment,
      deliveryPostalCode: order.deliveryPostalCode,
      deliveryComment: order.deliveryComment,
      deliverySlot: order.deliverySlot,
      customerComment: order.customerComment,
      contactName: order.contactName,
      contactPhone: order.contactPhone,
      contactEmail: order.contactEmail,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.orderItems || [],
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Return 400 for business logic errors (stock, validation) instead of 500
    if (message.startsWith('INSUFFICIENT_STOCK:')) {
      return NextResponse.json(
        { error: 'Insufficient stock', details: message.replace('INSUFFICIENT_STOCK: ', '') },
        { status: 400 },
      );
    }
    if (message.startsWith('INVALID_TOTALS:')) {
      return NextResponse.json(
        { error: 'Invalid order totals', details: message.replace('INVALID_TOTALS: ', '') },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: 'Failed to create order', details: message }, { status: 500 });
  }
}
