// Order notifications via Telegram Bot
import { getTelegramBot, isBotConfigured } from './telegram-bot';

interface OrderItem {
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

interface OrderData {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  subtotal: number;
  discount: number;
  deliveryCost: number;
  total: number;
  deliveryMethod?: string;
  deliveryService?: string;
  deliveryCity?: string;
  deliveryStreet?: string;
  deliveryHouse?: string;
  deliveryApartment?: string;
  deliveryPostalCode?: string;
  deliveryComment?: string;
  deliverySlot?: string;
  customerComment?: string;
  contactName?: string;
  contactPhone?: string;
  items?: OrderItem[];
  createdAt?: string;
}

interface UserData {
  id: string;
  telegramId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}

// Get admin IDs from environment
function getAdminIds(): number[] {
  const adminIdsStr = process.env.ADMIN_TELEGRAM_IDS || process.env.ADMIN_IDS || '';
  return adminIdsStr
    .split(',')
    .map(id => id.trim())
    .filter(id => id && /^\d+$/.test(id))
    .map(id => parseInt(id, 10));
}

// Format price
function formatPrice(amount: number): string {
  return amount.toLocaleString('ru-RU') + ' ₽';
}

// Get delivery method label
function getDeliveryMethodLabel(method?: string): string {
  const labels: Record<string, string> = {
    pickup: 'Самовывоз',
    courier: 'Доставка курьером',
    cdek: 'СДЭК',
    post: 'Почта России',
    boxberry: 'Boxberry',
  };
  return method ? labels[method] || method : 'Не указан';
}

// Get payment method label
function getPaymentMethodLabel(method?: string): string {
  const labels: Record<string, string> = {
    card: 'Банковская карта',
    sbp: 'СБП (QR-код)',
    cash: 'Наличные при получении',
    crypto: 'Криптовалюта (USDT)',
    stars: 'Telegram Stars',
    card_transfer: 'Перевод на карту',
  };
  return method ? labels[method] || method : 'Не указан';
}

// Get status label
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '⏳ Ожидает обработки',
    processing: '🔄 В обработке',
    confirmed: '✅ Подтверждён',
    shipped: '🚚 Отправлен',
    delivered: '📦 Доставлен',
    completed: '✅ Выполнен',
    cancelled: '❌ Отменён',
  };
  return labels[status] || status;
}

// Get payment status label
function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '⏳ Ожидает оплаты',
    paid: '✅ Оплачен',
    failed: '❌ Ошибка оплаты',
    refunded: '💸 Возврат',
  };
  return labels[status] || status;
}

// Generate order message for admin
function generateAdminOrderMessage(order: OrderData, user?: UserData): string {
  const lines: string[] = [];
  
  lines.push('🔔 <b>Новый заказ!</b>');
  lines.push(`#${order.orderNumber}`);
  lines.push('');
  
  // Customer info
  if (user || order.contactName || order.contactPhone) {
    const userName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '';
    const username = user?.username ? ` @${user.username}` : '';
    const contact = order.contactName ? ` (${order.contactName})` : '';
    const phone = order.contactPhone ? ` · ${order.contactPhone}` : '';
    
    lines.push(`👤 ${userName}${contact}${username} · ${order.contactPhone || ''}`);
    lines.push('');
  }
  
  // Items
  if (order.items && order.items.length > 0) {
    lines.push('Товары:');
    order.items.forEach((item) => {
      lines.push(`• ${item.productName} ×${item.quantity} — ${formatPrice(item.total)}`);
    });
    lines.push('');
  }
  
  // Delivery on its own line
  lines.push(`🚚 ${getDeliveryMethodLabel(order.deliveryMethod)}`);
  
  // Payment on its own line with status
  lines.push(`💳 ${getPaymentMethodLabel(order.paymentMethod)} — ${getPaymentStatusLabel(order.paymentStatus)}`);
  
  // Separator
  lines.push('──────────────');

  // ⬇️ COMMENTS — prominently placed right after items, before total
  if (order.customerComment) {
    lines.push('');
    lines.push(`💬 <b>Комментарий:</b> <i>${order.customerComment}</i>`);
  }
  if (order.deliveryComment) {
    lines.push(`🔑 <i>Доставка: ${order.deliveryComment}</i>`);
  }
  if (order.deliverySlot) {
    lines.push(`🕐 <i>Время доставки: ${order.deliverySlot}</i>`);
  }

  // Total
  if (order.discount > 0) {
    lines.push(``);
    lines.push(`<b>💰 ${formatPrice(order.total)}</b> <s>${formatPrice(order.subtotal + order.deliveryCost)}</s>`);
  } else {
    lines.push(`<b>💰 ${formatPrice(order.total)}</b>`);
  }
  
  return lines.join('\n');
}

// Generate order message for customer
function generateCustomerOrderMessage(order: OrderData): string {
  const lines: string[] = [];
  
  lines.push('✅ <b>Заказ оформлен!</b>');
  lines.push(`#${order.orderNumber}`);
  lines.push('');
  
  // Items
  if (order.items && order.items.length > 0) {
    lines.push('<b>Ваш заказ:</b>');
    order.items.forEach((item) => {
      lines.push(`• ${item.productName} ×${item.quantity}`);
    });
    lines.push('');
  }
  
  // Delivery
  lines.push(`🚚 ${getDeliveryMethodLabel(order.deliveryMethod)}`);
  if (order.deliveryCity && order.deliveryStreet) {
    const address = [
      order.deliveryCity,
      order.deliveryStreet,
      order.deliveryHouse ? `д.${order.deliveryHouse}` : null,
      order.deliveryApartment ? `кв.${order.deliveryApartment}` : null,
    ].filter(Boolean).join(', ');
    lines.push(`📍 ${address}`);
  }
  lines.push('');
  
  // Payment
  lines.push(`💳 ${getPaymentMethodLabel(order.paymentMethod)}`);
  lines.push(`Статус: ${getPaymentStatusLabel(order.paymentStatus)}`);
  lines.push('');
  
  // Total
  lines.push('──────────────');
  lines.push(`<b>💰 К оплате: ${formatPrice(order.total)}</b>`);
  lines.push('');
  lines.push('🙏 Спасибо за заказ!');
  
  return lines.join('\n');
}

// Generate payment receipt message (for customer)
function generatePaymentReceiptMessage(order: OrderData): string {
  const lines: string[] = [];
  
  lines.push('💳 <b>Оплата получена</b>');
  lines.push(`#${order.orderNumber}`);
  lines.push('');
  
  // Items count
  if (order.items && order.items.length > 0) {
    const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
    lines.push(`📦 ${totalItems} ${totalItems === 1 ? 'товар' : totalItems < 5 ? 'товара' : 'товаров'}`);
  }
  
  lines.push(`💰 ${formatPrice(order.total)}`);
  lines.push(`${getPaymentMethodLabel(order.paymentMethod)}`);
  lines.push('');
  lines.push('🙏 Спасибо за покупку!');
  
  return lines.join('\n');
}

// Generate status update message (for customer)
function generateStatusUpdateMessage(order: OrderData, newStatus: string, previousStatus?: string): string {
  const lines: string[] = [];
  
  lines.push('📦 <b>Статус заказа изменён</b>');
  lines.push(`#${order.orderNumber}`);
  lines.push('');
  
  // Show status transition
  if (previousStatus && previousStatus !== newStatus) {
    lines.push(`${getStatusLabel(previousStatus)} → ${getStatusLabel(newStatus)}`);
  } else {
    lines.push(getStatusLabel(newStatus));
  }
  
  // Total amount
  lines.push(`💰 ${formatPrice(order.total)}`);
  
  return lines.join('\n');
}

// Send notification to admins
export async function notifyAdminsAboutNewOrder(order: OrderData, user?: UserData): Promise<void> {
  if (!isBotConfigured()) {
    return;
  }
  
  const bot = getTelegramBot();
  if (!bot) return;
  
  const adminIds = getAdminIds();
  if (adminIds.length === 0) {
    return;
  }
  
  const message = generateAdminOrderMessage(order, user);
  
  for (const adminId of adminIds) {
    try {
      await bot.sendMessage(adminId, message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error(`[Notifications] Failed to send to admin ${adminId}:`, error);
    }
  }
}

// Send notification to customer
export async function notifyCustomerAboutOrder(
  order: OrderData, 
  telegramId?: string | null
): Promise<void> {
  if (!isBotConfigured()) {
    return;
  }
  
  if (!telegramId) {
    return;
  }
  
  const bot = getTelegramBot();
  if (!bot) return;
  
  const telegramIdNum = parseInt(telegramId, 10);
  if (isNaN(telegramIdNum)) {
    return;
  }
  
  const message = generateCustomerOrderMessage(order);
  
  try {
    await bot.sendMessage(telegramIdNum, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error(`[Notifications] Failed to send to customer ${telegramId}:`, error);
  }
}

// Send payment receipt to customer
export async function sendPaymentReceiptToCustomer(
  order: OrderData,
  telegramId?: string | null
): Promise<void> {
  if (!isBotConfigured()) {
    return;
  }
  
  if (!telegramId) {
    return;
  }
  
  const bot = getTelegramBot();
  if (!bot) return;
  
  const telegramIdNum = parseInt(telegramId, 10);
  if (isNaN(telegramIdNum)) {
    return;
  }
  
  const message = generatePaymentReceiptMessage(order);
  
  try {
    await bot.sendMessage(telegramIdNum, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error(`[Notifications] Failed to send receipt to customer ${telegramId}:`, error);
  }
}

// Notify about payment to admins (compact format)
export async function notifyAdminsAboutPayment(order: OrderData): Promise<void> {
  if (!isBotConfigured()) return;
  
  const bot = getTelegramBot();
  if (!bot) return;
  
  const adminIds = getAdminIds();
  if (adminIds.length === 0) return;
  
  const message = `💰 <b>Оплата получена</b>\n\n📦 Заказ #${order.orderNumber}\n💳 ${formatPrice(order.total)} — ${getPaymentMethodLabel(order.paymentMethod)}`;
  
  for (const adminId of adminIds) {
    try {
      await bot.sendMessage(adminId, message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error(`[Notifications] Failed to send payment notification to admin ${adminId}:`, error);
    }
  }
}

// Send status update to customer
export async function notifyCustomerAboutStatusUpdate(
  order: OrderData,
  newStatus: string,
  telegramId?: string | null,
  previousStatus?: string
): Promise<void> {
  if (!isBotConfigured()) return;
  
  if (!telegramId) return;
  
  const bot = getTelegramBot();
  if (!bot) return;
  
  const telegramIdNum = parseInt(telegramId, 10);
  if (isNaN(telegramIdNum)) return;
  
  const message = generateStatusUpdateMessage(order, newStatus, previousStatus);
  
  try {
    await bot.sendMessage(telegramIdNum, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error(`[Notifications] Failed to send status update to customer ${telegramId}:`, error);
  }
}

// Generate collector notification about new order
function generateCollectorNewOrderMessage(order: OrderData): string {
  const lines: string[] = [];

  lines.push('📋 <b>Новый заказ — нужно собрать!</b>');
  lines.push(`#${order.orderNumber}`);
  lines.push('');

  // Contact info
  if (order.contactName || order.contactPhone) {
    const name = order.contactName || '—';
    const phone = order.contactPhone || '—';
    lines.push(`👤 ${name} · ${phone}`);
    lines.push('');
  }

  // Items
  if (order.items && order.items.length > 0) {
    const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
    lines.push(`📦 ${totalItems} ${totalItems === 1 ? 'позиция' : totalItems < 5 ? 'позиции' : 'позиций'}:`);
    order.items.forEach((item) => {
      lines.push(`• ${item.productName} ×${item.quantity}`);
    });
    lines.push('');
  }

  // Delivery
  lines.push(`🚚 ${getDeliveryMethodLabel(order.deliveryMethod)}`);
  if (order.deliveryCity) {
    lines.push(`📍 ${order.deliveryCity}${order.deliveryStreet ? `, ${order.deliveryStreet}` : ''}${order.deliveryHouse ? `, д.${order.deliveryHouse}` : ''}`);
  }
  if (order.deliverySlot) {
    lines.push(`🕐 ${order.deliverySlot}`);
  }
  if (order.deliveryComment) {
    lines.push(`🔑 Доставка: ${order.deliveryComment}`);
  }
  // Payment status
  lines.push(`💳 ${getPaymentStatusLabel(order.paymentStatus)}`);

  // Comments section — prominently displayed for collectors
  if (order.customerComment) {
    lines.push('');
    lines.push('──────────────');
    lines.push(`💬 <b>Комментарий покупателя:</b>`);
    lines.push(`<i>${order.customerComment}</i>`);
  }

  // Total
  lines.push('──────────────');
  lines.push(`<b>💰 ${formatPrice(order.total)}</b>`);

  return lines.join('\n');
}

// Generate collector notification about status change
function generateCollectorStatusMessage(order: OrderData, newStatus: string): string {
  const lines: string[] = [];

  if (newStatus === 'confirmed') {
    lines.push('🔧 <b>Заказ подтверждён — начните сборку!</b>');
  } else if (newStatus === 'processing') {
    lines.push('🔄 <b>Заказ в сборке</b>');
  } else if (newStatus === 'shipped') {
    lines.push('🚚 <b>Заказ отправлен</b>');
  } else if (newStatus === 'cancelled') {
    lines.push('❌ <b>Заказ отменён</b>');
  } else {
    lines.push(`📦 <b>Статус заказа обновлён</b>`);
  }

  lines.push(`#${order.orderNumber}`);
  lines.push('');
  lines.push(`${getStatusLabel(newStatus)}`);
  lines.push(`💰 ${formatPrice(order.total)}`);

  if (newStatus === 'confirmed' || newStatus === 'processing') {
    if (order.contactName || order.contactPhone) {
      lines.push('');
      lines.push(`👤 ${order.contactName || '—'} · ${order.contactPhone || '—'}`);
    }
    if (order.deliveryCity) {
      lines.push(`📍 ${order.deliveryCity}`);
    }
    // Show customer comment when confirming/processing so collector sees it
    if (order.customerComment) {
      lines.push(`💬 ${order.customerComment}`);
    }
    if (order.deliveryComment) {
      lines.push(`🔑 Доставка: ${order.deliveryComment}`);
    }
  }

  return lines.join('\n');
}

// Generate assembly reminder message
function generateAssemblyReminderMessage(orders: Array<{ orderNumber: string; total: number; contactName?: string | null; createdAt: string }>): string {
  const lines: string[] = [];

  lines.push('⏰ <b>Напоминание: заказы ждут сборки!</b>');
  lines.push('');

  for (const order of orders) {
    const hoursAgo = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 3600000);
    const timeStr = hoursAgo < 1 ? 'только что' : hoursAgo < 24 ? `${hoursAgo} ч. назад` : `${Math.floor(hoursAgo / 24)} дн. назад`;
    const name = order.contactName || '';
    lines.push(`• #${order.orderNumber} — ${formatPrice(order.total)}${name ? ` (${name})` : ''} — ${timeStr}`);
  }

  lines.push('');
  lines.push(`📊 Всего: ${orders.length} ${orders.length === 1 ? 'заказ' : orders.length < 5 ? 'заказа' : 'заказов'}`);
  lines.push('');
  lines.push('🔧 Пора приступить к сборке!');

  return lines.join('\n');
}

// Send notification to specific Telegram users (collectors, admins, etc.)
export async function notifyTelegramUsers(
  telegramIds: number[],
  message: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<void> {
  if (!isBotConfigured()) return;

  const bot = getTelegramBot();
  if (!bot) return;

  if (telegramIds.length === 0) return;

  for (const id of telegramIds) {
    try {
      await bot.sendMessage(id, message, { parse_mode: parseMode });
    } catch (error) {
      console.error(`[Notifications] Failed to send to user ${id}:`, error);
    }
  }
}

// Notify collectors about new order (needs assembly)
export async function notifyCollectorsAboutNewOrder(
  order: OrderData,
  collectorTelegramIds: number[]
): Promise<void> {
  if (collectorTelegramIds.length === 0) return;

  const message = generateCollectorNewOrderMessage(order);
  await notifyTelegramUsers(collectorTelegramIds, message);
}

// Notify collectors about order status change
export async function notifyCollectorsAboutStatusChange(
  order: OrderData,
  newStatus: string,
  collectorTelegramIds: number[]
): Promise<void> {
  if (collectorTelegramIds.length === 0) return;

  // Don't notify about delivered/cancelled (not relevant for assembly)
  if (newStatus === 'delivered') return;

  const message = generateCollectorStatusMessage(order, newStatus);
  await notifyTelegramUsers(collectorTelegramIds, message);
}

// Send assembly reminders to collectors
export async function sendAssemblyReminders(
  pendingOrders: Array<{ orderNumber: string; total: number; contactName?: string | null; createdAt: string }>,
  collectorTelegramIds: number[]
): Promise<void> {
  if (collectorTelegramIds.length === 0) return;
  if (pendingOrders.length === 0) return;

  const message = generateAssemblyReminderMessage(pendingOrders);
  await notifyTelegramUsers(collectorTelegramIds, message);
}

// Helper to get collector Telegram IDs from DB
export async function getCollectorTelegramIds(db: any): Promise<number[]> {
  try {
    const collectors = await db.staff.findMany({
      where: {
        role: 'collector',
        isActive: true,
      },
      select: { telegramId: true },
    });
    return collectors
      .map((c: { telegramId: string }) => parseInt(c.telegramId, 10))
      .filter((id: number) => !isNaN(id));
  } catch (error) {
    console.error('[Notifications] Failed to fetch collector IDs:', error);
    return [];
  }
}

// Main function to send all order notifications
export async function sendOrderNotifications(
  order: OrderData,
  user?: UserData,
  collectorTelegramIds?: number[]
): Promise<void> {
  await notifyAdminsAboutNewOrder(order, user);

  if (user?.telegramId) {
    await notifyCustomerAboutOrder(order, user.telegramId);
  }

  // Notify collectors about new order
  if (collectorTelegramIds && collectorTelegramIds.length > 0) {
    await notifyCollectorsAboutNewOrder(order, collectorTelegramIds);
  }
}

// Main function to send payment notifications
export async function sendPaymentNotifications(
  order: OrderData,
  user?: UserData
): Promise<void> {
  await notifyAdminsAboutPayment(order);

  if (user?.telegramId) {
    await sendPaymentReceiptToCustomer(order, user.telegramId);
  }
}
