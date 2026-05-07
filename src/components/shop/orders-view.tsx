'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useShopStore, Order, Product, OrderItem } from '@/stores/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  AlertCircle,
  MapPin,
  Phone,
  User,
  CreditCard,
  ChevronRight,
  Loader2,
  RotateCcw,
  ClipboardList,
  PackageCheck,
  Play,
  MessageSquare,
  ChevronDown,
  Star,
  Wallet,
  Banknote,
  Store,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, pluralize, formatPrice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from './empty-state';
import { PopularProducts } from './popular-products';
import { CopyableOrderNumber } from '@/components/shared/copyable-order-number';
import { motion, AnimatePresence } from 'framer-motion';

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string; borderColor: string; gradientFrom: string }> = {
  pending: {
    label: 'Ожидает',
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    borderColor: 'border-l-yellow-400',
    gradientFrom: 'from-yellow-50/50 dark:from-yellow-900/10',
  },
  confirmed: {
    label: 'Подтверждён',
    icon: CheckCircle2,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    borderColor: 'border-l-blue-400',
    gradientFrom: 'from-blue-50/50 dark:from-blue-900/10',
  },
  processing: {
    label: 'Комплектуется',
    icon: AlertCircle,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    borderColor: 'border-l-purple-400',
    gradientFrom: 'from-purple-50/50 dark:from-purple-900/10',
  },
  shipped: {
    label: 'Собран',
    icon: PackageCheck,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    borderColor: 'border-l-green-400',
    gradientFrom: 'from-green-50/50 dark:from-green-900/10',
  },
  delivered: {
    label: 'Доставлен',
    icon: CheckCircle2,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    borderColor: 'border-l-emerald-400',
    gradientFrom: 'from-emerald-50/50 dark:from-emerald-900/10',
  },
  cancelled: {
    label: 'Отменён',
    icon: XCircle,
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    borderColor: 'border-l-gray-400',
    gradientFrom: 'from-gray-50/30 dark:from-gray-900/10',
  },
};

// Order status flow for timeline
const statusFlow = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;
const statusFlowConfig: Record<string, { label: string; icon: typeof Clock; estimatedHours: string }> = {
  pending:     { label: 'Ожидает',       icon: Clock,       estimatedHours: '0–1 ч' },
  confirmed:   { label: 'Подтверждён',   icon: CheckCircle2, estimatedHours: '1–3 ч' },
  processing:  { label: 'Сборка',        icon: AlertCircle,  estimatedHours: '2–6 ч' },
  shipped:     { label: 'Собран',        icon: PackageCheck,  estimatedHours: '6–12 ч' },
  delivered:   { label: 'Доставлен',     icon: CheckCircle2,  estimatedHours: '' },
};

// Collector status transitions
const collectorTransitions: Record<string, { nextStatus: string; label: string; icon: typeof Play; color: string }> = {
  pending: { nextStatus: 'confirmed', label: 'Подтвердить', icon: CheckCircle2, color: 'bg-blue-500 hover:bg-blue-600 text-white' },
  confirmed: { nextStatus: 'processing', label: 'Начать сборку', icon: Play, color: 'bg-purple-500 hover:bg-purple-600 text-white' },
  processing: { nextStatus: 'shipped', label: 'Собран', icon: PackageCheck, color: 'bg-green-500 hover:bg-green-600 text-white' },
};

// Payment method config for icons
const paymentMethodConfig: Record<string, { label: string; icon: typeof CreditCard }> = {
  card:    { label: 'Карта',     icon: CreditCard },
  cash:    { label: 'Наличные',  icon: Banknote },
  crypto:  { label: 'Крипто',    icon: Wallet },
  stars:   { label: 'Звёзды',    icon: Star },
  sbp:     { label: 'СБП',       icon: Wallet },
};

// Delivery method config for icons
const deliveryMethodConfig: Record<string, { label: string; icon: typeof Truck }> = {
  courier: { label: 'Курьер',  icon: Truck },
  pvz:     { label: 'ПВЗ',     icon: MapPin },
  pickup:  { label: 'Самовывоз', icon: Store },
};

// ─── Product Image Thumbnails ───────────────────────────────────────────────

/** Fetches product details and returns image URLs for order items */
async function getProductImages(items: OrderItem[]): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  if (!items?.length) return imageMap;

  const uniqueIds = [...new Set(items.map(i => i.productId).filter(Boolean))];
  if (!uniqueIds.length) return imageMap;

  try {
    const ids = uniqueIds.join(',');
    const res = await fetch(`/api/products?ids=${encodeURIComponent(ids)}&all=true&includeCategory=false`);
    if (!res.ok) return imageMap;
    const data = await res.json();
    const products = (data.products || []) as Product[];
    for (const p of products) {
      if (p.images) {
        try {
          const imgs = JSON.parse(p.images) as string[];
          if (imgs?.[0]) imageMap.set(p.id, imgs[0]);
        } catch {
          // images might be a single string URL
          if (typeof p.images === 'string' && p.images.startsWith('http')) {
            imageMap.set(p.id, p.images);
          }
        }
      }
    }
  } catch {
    // silently fail — thumbnails are optional
  }
  return imageMap;
}

// ─── Thumbnail Stack Component ───────────────────────────────────────────────

function ProductThumbnailStack({ items, imageMap }: { items: OrderItem[]; imageMap: Map<string, string> }) {
  const uniqueProducts = [...new Map(items.map(i => [i.productId, i])).values()];
  const maxVisible = 4;
  const visibleProducts = uniqueProducts.slice(0, maxVisible);
  const extraCount = uniqueProducts.length - maxVisible;

  if (!visibleProducts.length) return null;

  return (
    <div className="flex items-center -space-x-2">
      {visibleProducts.map((item, idx) => {
        const imgUrl = imageMap.get(item.productId);
        return (
          <div
            key={item.productId}
            className="relative shrink-0"
            style={{ zIndex: maxVisible - idx }}
          >
            {imgUrl ? (
              <img
                src={imgUrl}
                alt={item.productName}
                loading="lazy"
                className="w-8 h-8 rounded-md border-2 border-background object-cover bg-muted"
              />
            ) : (
              <div className="w-8 h-8 rounded-md border-2 border-background bg-muted flex items-center justify-center">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
            {idx === maxVisible - 1 && extraCount > 0 && (
              <div className="absolute inset-0 rounded-md bg-background/70 flex items-center justify-center">
                <span className="text-[10px] font-semibold text-foreground">+{extraCount}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Thumbnail Skeleton ──────────────────────────────────────────────────────

function ThumbnailSkeleton() {
  return (
    <div className="flex items-center -space-x-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="w-8 h-8 rounded-md border-2 border-background bg-muted animate-pulse shrink-0"
          style={{ zIndex: 3 - i }}
        />
      ))}
    </div>
  );
}

// ─── Vertical Timeline Component ─────────────────────────────────────────────

function VerticalTimeline({ currentStatus, createdAt, updatedAt }: { currentStatus: string; createdAt: string; updatedAt: string }) {
  const currentIdx = statusFlow.indexOf(currentStatus as typeof statusFlow[number]);
  const isCancelled = currentStatus === 'cancelled';

  if (isCancelled) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <XCircle className="h-4 w-4 text-gray-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Заказ отменён</p>
          <p className="text-xs text-muted-foreground">{new Date(updatedAt).toLocaleString('ru-RU')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative py-1">
      {statusFlow.map((step, idx) => {
        const cfg = statusFlowConfig[step];
        const StepIcon = cfg.icon;
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;
        const isLast = idx === statusFlow.length - 1;

        // Calculate approximate timestamp for each step
        const stepTimestamp = isCompleted || isCurrent
          ? idx === 0
            ? createdAt
            : new Date(new Date(createdAt).getTime() + idx * 3600000).toISOString()
          : null;

        return (
          <div key={step} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all',
                  isCompleted && 'bg-brand text-brand-foreground',
                  isCurrent && 'bg-brand text-brand-foreground ring-2 ring-brand/30',
                  isFuture && 'bg-muted text-muted-foreground',
                )}
              >
                {isCurrent ? (
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <StepIcon className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <StepIcon className="h-4 w-4" />
                )}
              </div>
              {/* Connecting line */}
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 min-h-[28px] flex-1 transition-colors',
                    idx < currentIdx ? 'bg-brand' : 'bg-muted',
                  )}
                />
              )}
            </div>

            {/* Step content */}
            <div className={cn('pb-4 min-w-0', isLast && 'pb-0')}>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-sm font-medium',
                    isCompleted && 'text-brand',
                    isCurrent && 'text-brand',
                    isFuture && 'text-muted-foreground',
                  )}
                >
                  {cfg.label}
                </span>
                {isCurrent && (
                  <motion.span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-medium"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                    Сейчас
                  </motion.span>
                )}
              </div>
              {stepTimestamp && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(stepTimestamp).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
              {isCurrent && cfg.estimatedHours && (
                <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Следующий шаг ≈ {cfg.estimatedHours}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Orders View ────────────────────────────────────────────────────────

export function OrdersView() {
  const { user, isCollector, initData, setCurrentView, addToCart } = useShopStore();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'mine' | 'all'>('mine');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  // Product image maps for order cards
  const [cardImageMaps, setCardImageMaps] = useState<Map<string, Map<string, string>>>(new Map());
  const [imagesLoading, setImagesLoading] = useState(true);

  // Reorder state
  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderSuccess, setReorderSuccess] = useState(false);

  useEffect(() => {
    if (isCollector) {
      fetchMyOrders();
      fetchAllOrders();
    } else {
      fetchMyOrders();
    }
  }, [user?.id, isCollector]);

  // Fetch product images for orders when they load
  useEffect(() => {
    if (displayOrders.length === 0) {
      setImagesLoading(false);
      return;
    }
    setImagesLoading(true);
    let cancelled = false;
    async function loadImages() {
      const newMaps = new Map<string, Map<string, string>>();
      const allItems = displayOrders.flatMap(o => o.items || []);
      const imageMap = await getProductImages(allItems);
      if (cancelled) return;
      for (const order of displayOrders) {
        newMaps.set(order.id, imageMap);
      }
      setCardImageMaps(newMaps);
      setImagesLoading(false);
    }
    void loadImages();
    return () => { cancelled = true; };
  }, [orders, allOrders, activeTab]);

  const fetchMyOrders = async () => {
    try {
      if (!user?.id) {
        setOrders([]);
        return;
      }
      const res = await fetch(`/api/orders?userId=${user.id}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить заказы',
        variant: 'destructive',
      });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllOrders = async () => {
    try {
      const res = await fetch('/api/orders?limit=9999&excludeStatuses=shipped,delivered,cancelled');
      const data = await res.json();
      setAllOrders(data.orders || []);
    } catch (error) {
      console.error('Error fetching all orders:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить заказы',
        variant: 'destructive',
      });
      setAllOrders([]);
    }
  };

  // Display orders based on active tab
  const displayOrders = activeTab === 'all' ? allOrders : orders;

  const handleCancelClick = (order: Order) => {
    setOrderToCancel(order);
    setCancelConfirmOpen(true);
  };

  // Update order status (collector action)
  const handleStatusChange = async (order: Order, newStatus: string, comment?: string) => {
    setStatusUpdating(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, comment, initData }),
      });

      if (res.ok) {
        const statusLabels: Record<string, string> = {
          confirmed: 'подтверждён',
          processing: 'в сборке',
          shipped: 'собран',
        };
        toast({
          title: `Заказ ${statusLabels[newStatus] || newStatus}`,
          description: `#${order.orderNumber}`,
        });

        const updatedOrder = { ...order, status: newStatus };

        setAllOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
        setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
        if (selectedOrder?.id === order.id) {
          setSelectedOrder(updatedOrder);
        }

        if (newStatus === 'shipped') {
          setTimeout(() => { void fetchAllOrders(); void fetchMyOrders(); }, 500);
        }
      } else {
        const data = await res.json();
        toast({
          title: 'Ошибка',
          description: data.error || 'Не удалось обновить статус',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить статус',
        variant: 'destructive',
      });
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!orderToCancel) return;

    setCancelling(true);
    setCancelConfirmOpen(false);

    try {
      const res = await fetch(`/api/orders/${orderToCancel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          comment: 'Отменён покупателем',
          initData,
        }),
      });

      if (res.ok) {
        toast({
          title: 'Заказ отменён',
          description: 'Ваш заказ был успешно отменён',
        });
        setOrders(orders.map(o =>
          o.id === orderToCancel.id ? { ...o, status: 'cancelled' } : o
        ));
        setAllOrders(allOrders.map(o =>
          o.id === orderToCancel.id ? { ...o, status: 'cancelled' } : o
        ));
        if (selectedOrder?.id === orderToCancel.id) {
          setSelectedOrder({ ...selectedOrder, status: 'cancelled' });
        }
      } else {
        const data = await res.json();
        toast({
          title: 'Ошибка',
          description: data.error || 'Не удалось отменить заказ',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось отменить заказ',
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
      setOrderToCancel(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Group orders by month (for display)
  const ordersByMonth = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    for (const order of displayOrders) {
      const date = new Date(order.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(order);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, monthOrders]) => ({
        key,
        label: monthOrders[0]
          ? new Date(monthOrders[0].createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
          : '',
        orders: monthOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      }));
  }, [displayOrders]);

  // ─── Reorder handler ─────────────────────────────────────────────────────

  const handleReorder = useCallback(async (order: Order) => {
    if (!order.items?.length) return;
    setReorderLoading(true);
    setReorderSuccess(false);

    try {
      const ids = [...new Set(order.items.map((i) => i.productId))].join(',');
      const res = await fetch(`/api/products?ids=${encodeURIComponent(ids)}&all=true`);
      const data = await res.json();
      const list = (data.products || []) as Product[];
      const byId = new Map(list.map((p) => [p.id, p]));
      let addedCount = 0;
      let skipped = 0;
      for (const item of order.items) {
        const p = byId.get(item.productId);
        if (!p || !p.isActive || (p.stock ?? 0) <= 0) {
          skipped++;
          continue;
        }
        const qty = Math.min(item.quantity, p.stock);
        const result = addToCart(p, qty);
        if (result.success) {
          addedCount++;
        } else {
          skipped++;
        }
      }
      if (addedCount === 0) {
        toast({
          title: 'Товар закончился',
          description:
            skipped > 0
              ? 'Все позиции из заказа сейчас недоступны или закончились.'
              : 'Не удалось получить актуальные данные о товарах.',
          variant: 'out-of-stock',
          duration: 2500,
        });
        setReorderLoading(false);
        return;
      }

      // Show success animation
      setReorderSuccess(true);
      toast({
        title: 'Товары добавлены в корзину',
        description:
          skipped > 0
            ? `${addedCount} из ${order.items.length} товаров добавлены (пропущено: ${skipped}). Заказ #${order.orderNumber}`
            : `Товары из заказа #${order.orderNumber} снова в корзине`,
      });

      // Brief success animation, then navigate
      setTimeout(() => {
        setDetailDialogOpen(false);
        setCurrentView('cart');
        setReorderLoading(false);
        setReorderSuccess(false);
      }, 800);
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось повторить заказ',
        variant: 'destructive',
      });
      setReorderLoading(false);
    }
  }, [addToCart, setCurrentView, toast]);

  // ─── Loading Skeleton ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="h-5 w-24 bg-muted rounded animate-pulse" />
            <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-36 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                </div>
                <div className="flex items-center justify-between">
                  <ThumbnailSkeleton />
                  <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-5 w-20 bg-muted rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ─── Order Card Render ────────────────────────────────────────────────────

  const renderOrderCard = (order: Order, cardIndex: number) => {
    const status = statusConfig[order.status] || statusConfig.pending;
    const StatusIcon = status.icon;
    const transition = isCollector ? collectorTransitions[order.status] : null;
    const isUpdating = statusUpdating === order.id;

    const imageMap = cardImageMaps.get(order.id) || new Map<string, string>();

    // Payment/delivery icons
    const paymentCfg = order.paymentMethod ? paymentMethodConfig[order.paymentMethod] : null;
    const PaymentIcon = paymentCfg?.icon || CreditCard;
    const deliveryCfg = deliveryMethodConfig[order.deliveryMethod];
    const DeliveryIcon = deliveryCfg?.icon || Truck;

    return (
      <motion.div
        key={order.id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: cardIndex * 0.06, ease: 'easeOut' }}
        layout
      >
        <Card
          className={cn(
            'overflow-hidden transition-all cursor-pointer',
            'border-l-4',
            status.borderColor,
            'bg-gradient-to-r',
            status.gradientFrom,
            'to-background',
            transition ? 'hover:border-primary/50' : 'hover:border-primary/30',
            'hover:shadow-sm',
          )}
          onClick={() => {
            setSelectedOrder(order);
            setDetailDialogOpen(true);
          }}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CopyableOrderNumber orderNumber={order.orderNumber} />
                  {order.customerComment && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                          <MessageSquare className="h-3 w-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[200px]">
                        <p className="text-xs">{order.customerComment}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(order.createdAt)} в {formatTime(order.createdAt)}
                </p>
                {isCollector && order.contactName && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {order.contactName} · {order.contactPhone || '—'}
                  </p>
                )}
              </div>
              <Badge className={cn('gap-1 shrink-0', status.color)}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
            </div>

            {/* Product thumbnails + item count */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                {imagesLoading ? (
                  <ThumbnailSkeleton />
                ) : (
                  <ProductThumbnailStack items={order.items || []} imageMap={imageMap} />
                )}
                <span className="text-sm text-muted-foreground">
                  {order.items?.length || 0} {pluralize(order.items?.length || 0, 'товар', 'товара', 'товаров')}
                </span>
              </div>
            </div>

            {/* Payment & delivery method icons */}
            <div className="flex items-center gap-3 mb-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <PaymentIcon className="h-3.5 w-3.5" />
                    <span>{paymentCfg?.label || 'Оплата'}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Способ оплаты: {paymentCfg?.label || order.paymentMethod || 'не указан'}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <DeliveryIcon className="h-3.5 w-3.5" />
                    <span>{deliveryCfg?.label || 'Доставка'}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Способ доставки: {deliveryCfg?.label || order.deliveryMethod || 'не указан'}</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">{formatPrice(order.total)}</p>
              <div className="flex items-center gap-2">
                {/* Collector quick-action button on card */}
                {transition && (
                  <Button
                    size="sm"
                    className={cn(
                      'h-8 px-3 text-xs rounded-lg gap-1.5',
                      transition.color
                    )}
                    disabled={isUpdating}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleStatusChange(order, transition.nextStatus, `Статус изменён сборщиком`);
                    }}
                  >
                    {isUpdating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <transition.icon className="h-3 w-3" />
                    )}
                    {transition.label}
                  </Button>
                )}
                {!transition && (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold flex items-center gap-2">
            {isCollector ? <ClipboardList className="h-5 w-5" /> : null}
            Заказы
            {!isCollector && (
              <span className="text-sm font-normal text-muted-foreground">
                {orders.length} {pluralize(orders.length, 'заказ', 'заказа', 'заказов')}
              </span>
            )}
          </h1>
          {isCollector && (
            <div className="flex gap-0.5 bg-muted/60 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('mine')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  activeTab === 'mine'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Мои{orders.length > 0 ? ` (${orders.length})` : ''}
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  activeTab === 'all'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Все{allOrders.length > 0 ? ` (${allOrders.length})` : ''}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-14 liquid-glass-scroll">
        <div className="p-3">
          {displayOrders.length === 0 ? (
            <div className="flex flex-col items-center">
              <EmptyState
                icon="orders"
                title={activeTab === 'all' ? 'Нет активных заказов' : 'Заказов пока нет'}
                description={activeTab === 'all' ? 'Новые заказы от покупателей будут отображаться здесь' : 'Когда вы оформите заказ, он появится здесь'}
                buttonText="Перейти в каталог"
                onButtonClick={() => setCurrentView('catalog')}
              />
              {!isCollector && <PopularProducts />}
            </div>
          ) : (
            <div className="space-y-6">
              {ordersByMonth.map((month) => {
                const isCollapsed = collapsedMonths.has(month.key);
                return (
                <div key={month.key || month.label}>
                  <button
                    onClick={() => setCollapsedMonths(prev => {
                      const next = new Set(prev);
                      if (next.has(month.key)) next.delete(month.key);
                      else next.add(month.key);
                      return next;
                    })}
                    className="flex items-center justify-between w-full mb-3 px-1 group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: isCollapsed ? -90 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </motion.div>
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {month.label}
                      </h3>
                      <span className="text-xs font-normal text-muted-foreground">
                        ({month.orders.length})
                      </span>
                    </div>
                  </button>
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3">
                          {month.orders.map((order, idx) => renderOrderCard(order, idx))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Order Detail Dialog ────────────────────────────────────────────── */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Заказ <CopyableOrderNumber orderNumber={selectedOrder?.orderNumber ?? ''} size="md" />
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <motion.div
              className="space-y-5 min-w-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {/* Status Timeline — Vertical */}
              {selectedOrder.status === 'cancelled' ? (
                <div className="py-2">
                  <VerticalTimeline
                    currentStatus="cancelled"
                    createdAt={selectedOrder.createdAt}
                    updatedAt={selectedOrder.updatedAt}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    {(() => {
                      const status = statusConfig[selectedOrder.status] || statusConfig.pending;
                      const StatusIcon = status.icon;
                      return (
                        <Badge className={cn('gap-1', status.color)}>
                          <StatusIcon className="h-4 w-4" />
                          {status.label}
                        </Badge>
                      );
                    })()}

                    {/* Collector action button */}
                    {isCollector && collectorTransitions[selectedOrder.status] && (() => {
                      const t = collectorTransitions[selectedOrder.status];
                      const TIcon = t.icon;
                      const isUpdating = statusUpdating === selectedOrder.id;
                      return (
                        <Button
                          size="sm"
                          className={cn('h-8 px-4 text-xs rounded-lg gap-1.5', t.color)}
                          disabled={isUpdating}
                          onClick={() => void handleStatusChange(selectedOrder, t.nextStatus, `Статус изменён сборщиком`)}
                        >
                          {isUpdating ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <TIcon className="h-3 w-3" />
                          )}
                          {t.label}
                        </Button>
                      );
                    })()}
                  </div>

                  {/* Vertical Timeline */}
                  <VerticalTimeline
                    currentStatus={selectedOrder.status}
                    createdAt={selectedOrder.createdAt}
                    updatedAt={selectedOrder.updatedAt}
                  />
                </div>
              )}

              <Separator />

              {/* Items — with product images */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Товары</h4>
                <div className="space-y-1.5">
                  {selectedOrder.items?.map((item) => {
                    const imgMap = cardImageMaps.get(selectedOrder.id) || new Map<string, string>();
                    const imgUrl = imgMap.get(item.productId);
                    return (
                      <div key={item.id} className="flex justify-between items-center gap-2 py-1 text-sm">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-md bg-muted shrink-0 overflow-hidden flex items-center justify-center border border-border/50">
                            {imgUrl ? (
                              <img src={imgUrl} alt={item.productName} loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <span className="text-muted-foreground text-xs shrink-0">{item.quantity}×</span>
                          <p className="truncate text-sm">{item.productName}</p>
                        </div>
                        <p className="font-medium text-sm whitespace-nowrap">{formatPrice(item.total)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Delivery info */}
              <div className="space-y-2">
                <h4 className="font-medium">Доставка</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const dCfg = deliveryMethodConfig[selectedOrder.deliveryMethod];
                      const DIcon = dCfg?.icon || Truck;
                      return <DIcon className="h-4 w-4 text-muted-foreground" />;
                    })()}
                    <span>
                      {selectedOrder.deliveryMethod === 'courier' && 'Курьерская доставка'}
                      {selectedOrder.deliveryMethod === 'pvz' && 'Пункт выдачи'}
                      {selectedOrder.deliveryMethod === 'pickup' && 'Самовывоз'}
                    </span>
                  </div>
                  {selectedOrder.deliveryCity && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>
                        {selectedOrder.deliveryCity}
                        {selectedOrder.deliveryStreet && `, ${selectedOrder.deliveryStreet}`}
                        {selectedOrder.deliveryHouse && `, д. ${selectedOrder.deliveryHouse}`}
                        {selectedOrder.deliveryApartment && `, кв. ${selectedOrder.deliveryApartment}`}
                      </span>
                    </div>
                  )}
                  {selectedOrder.deliveryComment && (
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-lg p-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 mb-0.5">
                        <MapPin className="h-3 w-3" />
                        Комментарий к доставке
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-300">{selectedOrder.deliveryComment}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Contact info */}
              <div className="space-y-2">
                <h4 className="font-medium">Контакты</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedOrder.contactName || 'Не указан'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedOrder.contactPhone || 'Не указан'}</span>
                  </div>
                </div>
              </div>

              {/* Customer comment */}
              {selectedOrder.customerComment && (
                <>
                  <Separator />
                  <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/50 rounded-lg p-3 space-y-1.5">
                    <h4 className="font-medium text-sm text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Комментарий покупателя
                    </h4>
                    <p className="text-sm text-orange-600 dark:text-orange-300">
                      {selectedOrder.customerComment}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Подытог</span>
                  <span>{formatPrice(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span>Скидка</span>
                    <span>-{formatPrice(selectedOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Доставка</span>
                  <span>{selectedOrder.deliveryCost === 0 ? 'Бесплатно' : formatPrice(selectedOrder.deliveryCost)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                  <span>Итого</span>
                  <span>{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              {/* Payment */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {(() => {
                    const pCfg = selectedOrder.paymentMethod ? paymentMethodConfig[selectedOrder.paymentMethod] : null;
                    const PIcon = pCfg?.icon || CreditCard;
                    return <PIcon className="h-4 w-4 text-muted-foreground" />;
                  })()}
                  <span>Оплата</span>
                </div>
                <Badge variant={selectedOrder.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                  {selectedOrder.paymentStatus === 'paid' ? 'Оплачено' : 'Ожидает оплаты'}
                </Badge>
              </div>

              {/* ─── Reorder Button ─────────────────────────────────────────── */}
              {(selectedOrder.status === 'delivered' || selectedOrder.status === 'cancelled') && !isCollector && (
                <>
                  <Separator />
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <Button
                      type="button"
                      className={cn(
                        'w-full rounded-xl font-semibold transition-all',
                        reorderSuccess
                          ? 'bg-green-500 hover:bg-green-500 text-white'
                          : 'bg-gradient-to-r from-brand to-brand/80 hover:from-brand/90 hover:to-brand/70 text-brand-foreground shadow-lg shadow-brand/20 hover:shadow-brand/30',
                      )}
                      disabled={reorderLoading}
                      onClick={() => void handleReorder(selectedOrder)}
                    >
                      {reorderLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Добавляем товары...
                        </>
                      ) : reorderSuccess ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Добавлено в корзину!
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Повторить заказ
                          <span className="ml-2 text-xs opacity-80 font-normal">
                            ({selectedOrder.items?.length || 0} {pluralize(selectedOrder.items?.length || 0, 'товар', 'товара', 'товаров')})
                          </span>
                        </>
                      )}
                    </Button>
                  </motion.div>
                </>
              )}

              {/* Tracking */}
              {selectedOrder.trackingNumber && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium">Отслеживание</h4>
                    <div className="p-3 bg-muted rounded-xl">
                      <p className="text-sm font-mono">{selectedOrder.trackingNumber}</p>
                    </div>
                  </div>
                </>
              )}

              {/* Actions - only for own orders */}
              {(selectedOrder.status === 'pending' || selectedOrder.status === 'confirmed') && (
                selectedOrder.userId === user?.id
              ) && (
                <>
                  <Separator />
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleCancelClick(selectedOrder)}
                    disabled={cancelling}
                  >
                    {cancelling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Отмена...
                      </>
                    ) : (
                      'Отменить заказ'
                    )}
                  </Button>
                </>
              )}
            </motion.div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить заказ?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите отменить заказ #{orderToCancel?.orderNumber}? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Нет, оставить</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
            >
              Да, отменить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
