'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useShopStore, Order } from '@/stores/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  motion,
  AnimatePresence,
} from 'framer-motion';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Search,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  User,
  Calendar,
  CreditCard,
  ExternalLink,
  Trash2,
  Save,
  MessageSquare,
  Archive,
  Inbox,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Store,
  Wallet,
  Banknote,
  Send,
  PackageCheck,
} from 'lucide-react';
import { cn, pluralize, formatRelativeTime } from '@/lib/utils';
import { CopyableOrderNumber } from '@/components/shared/copyable-order-number';
import { useToast } from '@/hooks/use-toast';

// ─── Status Configuration ──────────────────────────────────────────────────────

const statusConfig: Record<string, {
  label: string;
  icon: typeof Clock;
  color: string;
  dotColor: string;
  borderColor: string;
  bgColor: string;
  activeBtnClass: string;
}> = {
  pending: {
    label: 'Ожидает',
    icon: Clock,
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    dotColor: 'bg-yellow-500',
    borderColor: 'border-l-yellow-500',
    bgColor: 'bg-yellow-50/50 dark:bg-yellow-950/20',
    activeBtnClass: 'bg-yellow-500 text-white ring-yellow-500/30',
  },
  confirmed: {
    label: 'Подтвержден',
    icon: CheckCircle2,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    dotColor: 'bg-blue-500',
    borderColor: 'border-l-blue-500',
    bgColor: 'bg-blue-50/50 dark:bg-blue-950/20',
    activeBtnClass: 'bg-blue-500 text-white ring-blue-500/30',
  },
  processing: {
    label: 'В обработке',
    icon: AlertCircle,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    dotColor: 'bg-purple-500',
    borderColor: 'border-l-purple-500',
    bgColor: 'bg-purple-50/50 dark:bg-purple-950/20',
    activeBtnClass: 'bg-purple-500 text-white ring-purple-500/30',
  },
  shipped: {
    label: 'Отправлен',
    icon: Truck,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    dotColor: 'bg-green-500',
    borderColor: 'border-l-green-500',
    bgColor: 'bg-green-50/50 dark:bg-green-950/20',
    activeBtnClass: 'bg-green-500 text-white ring-green-500/30',
  },
  delivered: {
    label: 'Доставлен',
    icon: CheckCircle2,
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    borderColor: 'border-l-emerald-500',
    bgColor: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    activeBtnClass: 'bg-emerald-500 text-white ring-emerald-500/30',
  },
  cancelled: {
    label: 'Отменен',
    icon: XCircle,
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    dotColor: 'bg-gray-500',
    borderColor: 'border-l-gray-400',
    bgColor: 'bg-gray-50/50 dark:bg-gray-950/20',
    activeBtnClass: 'bg-gray-500 text-white ring-gray-500/30',
  },
};

const paymentStatusConfig: Record<string, { label: string; color: string; dotColor: string; activeBtnClass: string }> = {
  pending: { label: 'Ожидает', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', dotColor: 'bg-yellow-500', activeBtnClass: 'bg-yellow-500 text-white ring-yellow-500/30' },
  paid: { label: 'Оплачено', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', dotColor: 'bg-green-500', activeBtnClass: 'bg-green-500 text-white ring-green-500/30' },
  refunded: { label: 'Возврат', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', dotColor: 'bg-red-500', activeBtnClass: 'bg-red-500 text-white ring-red-500/30' },
  failed: { label: 'Ошибка', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', dotColor: 'bg-gray-500', activeBtnClass: 'bg-gray-500 text-white ring-gray-500/30' },
};

// ─── Filter Tabs Configuration ─────────────────────────────────────────────────

type FilterTab = 'all' | 'pending' | 'processing_group' | 'shipping' | 'completed' | 'cancelled';

const filterTabs: { key: FilterTab; label: string; statuses: string[]; icon: typeof Inbox }[] = [
  { key: 'all', label: 'Все', statuses: [], icon: Inbox },
  { key: 'pending', label: 'Новые', statuses: ['pending', 'confirmed'], icon: Clock },
  { key: 'processing_group', label: 'В обработке', statuses: ['processing'], icon: AlertCircle },
  { key: 'shipping', label: 'В доставке', statuses: ['shipped'], icon: Truck },
  { key: 'completed', label: 'Завершены', statuses: ['delivered'], icon: CheckCircle2 },
  { key: 'cancelled', label: 'Отменены', statuses: ['cancelled'], icon: XCircle },
];

// ─── Status flows ──────────────────────────────────────────────────────────────

const deliveryStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;
const deliveryStatusConfig: Record<string, { label: string; icon: typeof Clock }> = {
  pending:    { label: 'Ожидает',    icon: Clock },
  confirmed:  { label: 'Подтвержден', icon: CheckCircle2 },
  processing: { label: 'Сборка',      icon: AlertCircle },
  shipped:    { label: 'Отправлен',   icon: Truck },
  delivered:  { label: 'Доставлен',   icon: CheckCircle2 },
};

const paymentStatuses = ['pending', 'paid', 'refunded', 'failed'] as const;
const paymentStatusLabel: Record<string, { label: string; icon: typeof CreditCard }> = {
  pending:  { label: 'Ожидает',  icon: Clock },
  paid:     { label: 'Оплачено', icon: CheckCircle2 },
  refunded: { label: 'Возврат',  icon: RotateCcw },
  failed:   { label: 'Ошибка',   icon: XCircle },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const isArchivable = (o: Order) => {
  if (o.status === 'cancelled') return true;
  if (o.status === 'delivered' && o.paymentStatus === 'paid') return true;
  return false;
};

function DeliveryMethodIcon({ method, className }: { method: string; className?: string }) {
  switch (method) {
    case 'courier': return <Truck className={className} />;
    case 'pickup': return <Store className={className} />;
    case 'pvz': return <PackageCheck className={className} />;
    case 'cdek': return <Send className={className} />;
    default: return <Package className={className} />;
  }
}

const getDeliveryMethodLabel = (method: string) => {
  switch (method) {
    case 'courier': return 'Курьер';
    case 'pickup': return 'Самовывоз';
    case 'pvz': return 'ПВЗ';
    case 'cdek': return 'СДЭК';
    default: return method;
  }
};

function PaymentMethodIcon({ method, className }: { method: string | null; className?: string }) {
  switch (method) {
    case 'card': return <CreditCard className={className} />;
    case 'cash': return <Banknote className={className} />;
    case 'sbp': return <Wallet className={className} />;
    case 'telegram': return <Send className={className} />;
    default: return <CreditCard className={className} />;
  }
}

const formatPrice = (price: number) => price.toLocaleString('ru-RU') + ' ₽';

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// ─── Empty State Component ─────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description }: { icon: typeof ShoppingBag; title: string; description: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
      className="text-center py-16"
    >
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-base font-medium text-muted-foreground">{title}</p>
      <p className="text-sm text-muted-foreground/70 mt-1">{description}</p>
    </motion.div>
  );
}

function getEmptyTitle(filter: FilterTab): string {
  switch (filter) {
    case 'pending': return 'Нет новых заказов';
    case 'processing_group': return 'Нет заказов в обработке';
    case 'shipping': return 'Нет заказов в доставке';
    case 'completed': return 'Нет завершённых заказов';
    case 'cancelled': return 'Нет отменённых заказов';
    default: return 'Заказы не найдены';
  }
}

function getEmptyDescription(filter: FilterTab): string {
  switch (filter) {
    case 'pending': return 'Новые заказы появятся, когда клиенты оформят покупку';
    case 'processing_group': return 'Заказы перейдут сюда после подтверждения';
    case 'shipping': return 'Заказы перейдут сюда после сборки';
    case 'completed': return 'Доставленные заказы появятся здесь';
    case 'cancelled': return 'Отменённые заказы будут показаны здесь';
    default: return '';
  }
}

// ─── Compact Order Card Component ──────────────────────────────────────────────

type StatusPickerTab = 'payment' | 'delivery';

interface OrderCardProps {
  order: Order;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusChange: (orderId: string, newStatus: string) => void;
  onPaymentStatusChange: (orderId: string, newStatus: string) => void;
  onCancel: (order: Order) => void;
  onDelete: (order: Order) => void;
  onSaveTracking: (order: Order) => void;
  trackingNumber: string;
  setTrackingNumber: (v: string) => void;
  saving: boolean;
}

function OrderCard({
  order,
  isExpanded,
  onToggle,
  onStatusChange,
  onPaymentStatusChange,
  onCancel,
  onDelete,
  onSaveTracking,
  trackingNumber,
  setTrackingNumber,
  saving,
}: OrderCardProps) {
  const status = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = status.icon;
  const pStatus = paymentStatusConfig[order.paymentStatus] || paymentStatusConfig.pending;
  const [pickerTab, setPickerTab] = useState<StatusPickerTab>('payment');

  return (
    <motion.div
      layout
      id={`order-${order.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
    >
      <Card
        className={cn(
          'overflow-hidden transition-all border-l-4',
          status.borderColor,
          isExpanded && 'shadow-md',
        )}
      >
        {/* ─── Compact Card Header ──────────────────────────────────────────── */}
        <CardContent
          className="p-3 cursor-pointer select-none"
          onClick={onToggle}
        >
          {/* Row 1: Order number + status badge + time */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <CopyableOrderNumber orderNumber={order.orderNumber} />
              {order.customerComment && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 shrink-0">
                      <MessageSquare className="h-2.5 w-2.5" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <p className="text-xs">{order.customerComment}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className={cn('gap-1 text-[10px] px-1.5 py-0', status.color)}>
                <StatusIcon className="h-2.5 w-2.5" />
                {status.label}
              </Badge>
            </div>
          </div>

          {/* Row 2: Customer, delivery method, payment status, price — all in one line */}
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{order.contactName || '—'}</span>
            <span className="text-muted-foreground/30">·</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 shrink-0">
                  <DeliveryMethodIcon method={order.deliveryMethod} className="h-3 w-3" />
                  <span className="truncate hidden sm:inline">{getDeliveryMethodLabel(order.deliveryMethod)}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>{getDeliveryMethodLabel(order.deliveryMethod)}</TooltipContent>
            </Tooltip>
            <span className="text-muted-foreground/30">·</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 shrink-0">
                  <CreditCard className={cn('h-3 w-3', pStatus.dotColor.replace('bg-', 'text-').replace('-500', '-600'))} />
                  <span className={cn('truncate font-medium', pStatus.color)}>{pStatus.label}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>Статус оплаты</TooltipContent>
            </Tooltip>
            <span className="flex-1" />
            <span className="font-semibold text-xs text-foreground">{formatPrice(order.total)}</span>
          </div>

          {/* Row 3: Item summary, time, expand arrow */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-muted-foreground truncate">
              {order.items?.length || 0} {pluralize(order.items?.length || 0, 'товар', 'товара', 'товаров')}
              {order.items?.[0] && ` · ${order.items[0].productName}`}
              {(order.items?.length || 0) > 1 && ` +${order.items.length - 1}`}
            </span>
            <span className="flex-1" />
            <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
              {formatRelativeTime(order.createdAt)}
            </span>
            <ChevronDown className={cn(
              'h-3.5 w-3.5 text-muted-foreground/40 shrink-0 transition-transform',
              isExpanded && 'rotate-180',
            )} />
          </div>
        </CardContent>

        {/* ─── Expanded Detail View ─────────────────────────────────────────── */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-3 max-h-[75vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <Separator />

                {/* ── Status Picker: Payment / Delivery ────────────────────── */}
                <div>
                  <div className="flex gap-1 p-0.5 bg-muted rounded-lg mb-2">
                    <button
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all',
                        pickerTab === 'payment'
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => setPickerTab('payment')}
                    >
                      <CreditCard className="h-3 w-3" />
                      Оплата
                      <span className={cn('h-1.5 w-1.5 rounded-full', pStatus.dotColor)} />
                    </button>
                    <button
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all',
                        pickerTab === 'delivery'
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                      onClick={() => setPickerTab('delivery')}
                    >
                      <Truck className="h-3 w-3" />
                      Доставка
                      <span className={cn('h-1.5 w-1.5 rounded-full', status.dotColor)} />
                    </button>
                  </div>

                  {/* Payment status picker */}
                  {pickerTab === 'payment' && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-1.5"
                    >
                      {/* Main action: mark as paid */}
                      {order.paymentStatus !== 'paid' && (
                        <button
                          className={cn(
                            'flex items-center gap-2.5 w-full py-2.5 px-3 rounded-lg text-xs font-medium transition-all border',
                            'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/30',
                          )}
                          onClick={() => onPaymentStatusChange(order.id, 'paid')}
                        >
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 shrink-0">
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          </div>
                          <span className="font-medium">Подтвердить оплату</span>
                          <span className="flex-1" />
                        </button>
                      )}

                      {/* Active status indicator */}
                      {order.paymentStatus === 'paid' && (
                        <div className={cn(
                          'flex items-center gap-2.5 w-full py-2 px-3 rounded-lg text-xs font-medium border',
                          'bg-green-100 dark:bg-green-900/30 border-transparent ring-2 ring-green-500/30',
                        )}>
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 shrink-0">
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          </div>
                          <span className="text-green-700 dark:text-green-400 font-medium">Оплачено</span>
                          <span className="flex-1" />
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        </div>
                      )}

                      {/* Danger zone — separated, harder to misclick */}
                      <div className="pt-1">
                        <p className="text-[10px] text-muted-foreground/60 px-3 pb-1 uppercase tracking-wider font-medium">Дополнительно</p>
                        {(order.paymentStatus === 'pending' || order.paymentStatus === 'failed') && (
                          <button
                            className="flex items-center gap-2.5 w-full py-1.5 px-3 rounded-lg text-[11px] font-medium transition-all border opacity-50 hover:opacity-100 hover:bg-muted/50 bg-transparent border-transparent text-muted-foreground"
                            onClick={() => {
                              if (confirm('Отметить как «Ошибка оплаты»?')) {
                                onPaymentStatusChange(order.id, 'failed');
                              }
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Ошибка оплаты</span>
                          </button>
                        )}
                        {order.paymentStatus === 'paid' && (
                          <button
                            className="flex items-center gap-2.5 w-full py-1.5 px-3 rounded-lg text-[11px] font-medium transition-all border opacity-50 hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/20 bg-transparent border-transparent text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                            onClick={() => {
                              if (confirm('Оформить возврат по заказу?')) {
                                onPaymentStatusChange(order.id, 'refunded');
                              }
                            }}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Возврат средств</span>
                          </button>
                        )}
                        {order.paymentStatus === 'failed' && (
                          <button
                            className="flex items-center gap-2.5 w-full py-1.5 px-3 rounded-lg text-[11px] font-medium transition-all border opacity-50 hover:opacity-100 hover:bg-muted/50 bg-transparent border-transparent text-muted-foreground"
                            onClick={() => onPaymentStatusChange(order.id, 'paid')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Перепроверить — отметить оплаченным</span>
                          </button>
                        )}
                        {order.paymentStatus === 'refunded' && (
                          <button
                            className="flex items-center gap-2.5 w-full py-1.5 px-3 rounded-lg text-[11px] font-medium transition-all border opacity-50 hover:opacity-100 hover:bg-muted/50 bg-transparent border-transparent text-muted-foreground"
                            onClick={() => onPaymentStatusChange(order.id, 'paid')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Вернуть в «Оплачено»</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Delivery status picker */}
                  {pickerTab === 'delivery' && (
                    <motion.div
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-1"
                    >
                      {deliveryStatuses.map((ds) => {
                        const isActive = order.status === ds;
                        const cfg = deliveryStatusConfig[ds];
                        const DsIcon = cfg.icon;
                        const currentIdx = deliveryStatuses.indexOf(order.status as typeof deliveryStatuses[number]);
                        const targetIdx = deliveryStatuses.indexOf(ds);
                        // Allow jumping to any forward status (not just next step)
                        const canTransition = targetIdx > currentIdx;

                        return (
                          <button
                            key={ds}
                            className={cn(
                              'flex items-center gap-2.5 w-full py-2 px-3 rounded-lg text-xs font-medium transition-all border',
                              isActive
                                ? cn(statusConfig[ds]?.activeBtnClass || 'bg-muted text-foreground', 'border-transparent ring-2')
                                : canTransition
                                  ? 'bg-muted/50 border-transparent text-muted-foreground hover:bg-muted'
                                  : 'opacity-30 cursor-not-allowed bg-muted/20 border-transparent text-muted-foreground',
                            )}
                            onClick={() => {
                              if (canTransition) {
                                onStatusChange(order.id, ds);
                              }
                            }}
                          >
                            <div className={cn(
                              'flex items-center justify-center w-6 h-6 rounded-full shrink-0',
                              isActive
                                ? statusConfig[ds]?.dotColor
                                : 'bg-muted',
                            )}>
                              <DsIcon className="h-3 w-3 text-white" />
                            </div>
                            <span>{cfg.label}</span>
                            <span className="flex-1" />
                            {isActive && <CheckCircle2 className="h-3.5 w-3.5 text-white/80" />}
                          </button>
                        );
                      })}

                      {/* Cancel button in delivery section */}
                      {order.status !== 'cancelled' && order.status !== 'delivered' && (
                        <button
                          className="flex items-center gap-2.5 w-full py-2 px-3 rounded-lg text-xs font-medium transition-all border bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/30 mt-1"
                          onClick={() => onCancel(order)}
                        >
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500 shrink-0">
                            <XCircle className="h-3 w-3 text-white" />
                          </div>
                          <span>Отменить заказ</span>
                        </button>
                      )}
                    </motion.div>
                  )}
                </div>

                <Separator />

                {/* ── Customer Comment ──────────────────────────────────────── */}
                {order.customerComment && (
                  <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-orange-700 dark:text-orange-400 mb-0.5">
                      <MessageSquare className="h-3 w-3" />
                      Комментарий клиента
                    </div>
                    <p className="text-xs text-orange-600 dark:text-orange-300">{order.customerComment}</p>
                  </div>
                )}

                {/* ── Items ────────────────────────────────────────────────── */}
                <div>
                  <h4 className="text-xs font-medium mb-1.5 text-muted-foreground">Товары</h4>
                  <div className="space-y-1">
                    {order.items?.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 py-1">
                        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate">{item.productName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.quantity} × {formatPrice(item.price)}
                          </p>
                        </div>
                        <p className="font-medium text-xs whitespace-nowrap">{formatPrice(item.total)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* ── Totals ───────────────────────────────────────────────── */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Подытог</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>Скидка</span>
                      <span>-{formatPrice(order.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Доставка</span>
                    <span>{order.deliveryCost === 0 ? 'Бесплатно' : formatPrice(order.deliveryCost)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-sm pt-0.5">
                    <span>Итого</span>
                    <span>{formatPrice(order.total)}</span>
                  </div>
                </div>

                <Separator />

                {/* ── Customer + Delivery + Payment Info (compact) ──────────── */}
                <div className="grid grid-cols-1 gap-2 text-xs">
                  {/* Customer */}
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{order.contactName || '—'}</span>
                    {order.contactPhone && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="truncate">{order.contactPhone}</span>
                      </>
                    )}
                  </div>
                  {(order as Order & { contactEmail?: string }).contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{(order as Order & { contactEmail?: string }).contactEmail}</span>
                    </div>
                  )}
                  {/* Delivery */}
                  <div className="flex items-center gap-2">
                    <DeliveryMethodIcon method={order.deliveryMethod} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      {getDeliveryMethodLabel(order.deliveryMethod)}
                      {order.deliveryCity && ` · ${order.deliveryCity}`}
                      {order.deliveryStreet && `, ${order.deliveryStreet}`}
                      {order.deliveryHouse && `, д. ${order.deliveryHouse}`}
                    </span>
                  </div>
                  {/* Payment */}
                  <div className="flex items-center gap-2">
                    <PaymentMethodIcon method={order.paymentMethod ?? null} className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Badge className={cn('text-[10px] px-1.5 py-0', pStatus.color)}>
                      {pStatus.label}
                    </Badge>
                  </div>
                </div>

                {/* ── Tracking Number ───────────────────────────────────────── */}
                {(order.status === 'shipped' || order.status === 'delivered' || order.trackingNumber) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-xs font-medium mb-1.5 text-muted-foreground">Трекинг-номер</h4>
                      <div className="flex gap-1.5">
                        <Input
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value)}
                          placeholder="Введите трекинг-номер"
                          className="h-8 text-xs"
                        />
                        <Button
                          onClick={() => onSaveTracking(order)}
                          disabled={saving}
                          size="sm"
                          className="shrink-0 h-8"
                        >
                          {saving ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground" />
                          ) : (
                            <Save className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      {order.trackingNumber && (
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                          <ExternalLink className="h-2.5 w-2.5" />
                          <span className="font-mono">{order.trackingNumber}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <Separator />

                {/* ── Order Date ───────────────────────────────────────────── */}
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Создан: {formatDate(order.createdAt)}</span>
                </div>

                {/* ── Bottom Actions ───────────────────────────────────────── */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1 h-8 text-xs"
                    onClick={() => onCancel(order)}
                    disabled={order.status === 'cancelled'}
                  >
                    <XCircle className="h-3 w-3" />
                    Отменить
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1 gap-1 h-8 text-xs"
                    onClick={() => onDelete(order)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Удалить
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function OrdersManager() {
  const { setCurrentView } = useShopStore();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchDebug, setFetchDebug] = useState<Record<string, unknown> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showArchive, setShowArchive] = useState(false);

  // Dialog states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [deleteMonthConfirmOpen, setDeleteMonthConfirmOpen] = useState(false);
  const [monthToDelete, setMonthToDelete] = useState<string | null>(null);
  const [deletingMonth, setDeletingMonth] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();

      if (!res.ok) {
        const msg = data.reason || data.error || `Ошибка ${res.status}`;
        setFetchError(msg);
        setFetchDebug(data.debug || null);
        setOrders([]);
        return;
      }

      setFetchDebug(null);
      setOrders(data.orders || []);
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : 'Ошибка сети');
      setFetchDebug(null);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrders();
    setTimeout(() => setRefreshing(false), 600);
  }, [fetchOrders]);

  const currentOrders = useMemo(() =>
    orders.filter(o => !isArchivable(o)),
    [orders]
  );

  const archiveOrders = useMemo(() =>
    orders.filter(o => isArchivable(o)),
    [orders]
  );

  // Group archive orders by month
  const archiveByMonth = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    for (const order of archiveOrders) {
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
  }, [archiveOrders]);

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else next.add(monthKey);
      return next;
    });
  };

  const handleDeleteMonthArchive = async () => {
    if (!monthToDelete) return;
    const monthData = archiveByMonth.find(m => m.key === monthToDelete);
    if (!monthData) return;

    setDeletingMonth(true);
    let deletedCount = 0;
    for (const order of monthData.orders) {
      try {
        await fetch(`/api/orders/${order.id}`, { method: 'DELETE' });
        deletedCount++;
      } catch (e) {
        console.error('Error deleting order:', e);
      }
    }
    setDeletingMonth(false);
    setDeleteMonthConfirmOpen(false);
    setMonthToDelete(null);
    toast({
      title: 'Архив удалён',
      description: `Удалено ${deletedCount} ${pluralize(deletedCount, 'заказ', 'заказа', 'заказов')} за ${monthData.label.toLowerCase()}`,
    });
    await fetchOrders();
  };

  // Filter logic
  const sourceOrders = useMemo(() =>
    showArchive ? archiveOrders : currentOrders,
    [showArchive, currentOrders, archiveOrders]
  );

  const filteredOrders = useMemo(() => {
    const activeFilterConfig = filterTabs.find(f => f.key === activeFilter);
    return sourceOrders.filter(o => {
      const matchesSearch = o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            o.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            o.contactPhone?.includes(searchQuery);
      const matchesStatus = !activeFilterConfig?.statuses.length || activeFilterConfig.statuses.includes(o.status);
      return matchesSearch && matchesStatus;
    });
  }, [sourceOrders, searchQuery, activeFilter]);

  // Group orders by payment status for visual separators (only for current orders)
  const orderGroups = useMemo(() => {
    if (showArchive) {
      return [{ label: '', orders: filteredOrders, color: '' }];
    }
    const unpaid = filteredOrders.filter(o => o.paymentStatus !== 'paid');
    const paid = filteredOrders.filter(o => o.paymentStatus === 'paid');
    const groups: { label: string; orders: Order[]; color: string }[] = [];
    if (unpaid.length > 0) groups.push({ label: `Неоплаченные (${unpaid.length})`, orders: unpaid, color: 'text-amber-600' });
    if (paid.length > 0) groups.push({ label: `Оплаченные (${paid.length})`, orders: paid, color: 'text-green-600' });
    return groups;
  }, [filteredOrders, showArchive]);

  // Count per filter tab
  const filterCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: sourceOrders.length,
      pending: sourceOrders.filter(o => ['pending', 'confirmed'].includes(o.status)).length,
      processing_group: sourceOrders.filter(o => o.status === 'processing').length,
      shipping: sourceOrders.filter(o => o.status === 'shipped').length,
      completed: sourceOrders.filter(o => o.status === 'delivered').length,
      cancelled: sourceOrders.filter(o => o.status === 'cancelled').length,
    };
    return counts;
  }, [sourceOrders]);

  // ─── Handlers ──────────────────────────────────────────────────────────────────

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast({
          title: 'Статус обновлен',
          description: `Заказ переведен в статус "${statusConfig[newStatus]?.label}"`,
        });
        await fetchOrders();
      }
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить статус',
        variant: 'destructive',
      });
    }
  };

  const handlePaymentStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: newStatus }),
      });

      if (res.ok) {
        toast({
          title: 'Статус оплаты обновлен',
          description: `Статус оплаты: "${paymentStatusConfig[newStatus]?.label}"`,
        });
        await fetchOrders();
      }
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить статус оплаты',
        variant: 'destructive',
      });
    }
  };

  const handleSaveTracking = async (order: Order) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber }),
      });

      if (res.ok) {
        toast({ title: 'Трекинг-номер сохранен' });
        await fetchOrders();
      }
    } catch (error) {
      console.error('Error saving tracking:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить трекинг-номер',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (order: Order) => {
    setOrderToDelete(order);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    try {
      const res = await fetch(`/api/orders/${orderToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Заказ удален' });
        await fetchOrders();
        setExpandedOrderId(null);
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({ title: 'Ошибка', description: 'Не удалось удалить заказ', variant: 'destructive' });
    } finally {
      setDeleteConfirmOpen(false);
      setOrderToDelete(null);
    }
  };

  const handleCancelClick = (order: Order) => {
    setOrderToCancel(order);
    setCancelConfirmOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!orderToCancel) return;
    try {
      const res = await fetch(`/api/orders/${orderToCancel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      if (res.ok) {
        toast({ title: 'Заказ отменен' });
        await fetchOrders();
        setExpandedOrderId(null);
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast({ title: 'Ошибка', description: 'Не удалось отменить заказ', variant: 'destructive' });
    } finally {
      setCancelConfirmOpen(false);
      setOrderToCancel(null);
    }
  };

  const toggleExpand = (orderId: string, order: Order) => {
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
    } else {
      setExpandedOrderId(orderId);
      setTrackingNumber(order.trackingNumber || '');
      setTimeout(() => {
        const el = document.getElementById(`order-${orderId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  };

  // When toggling archive mode, reset filter and collapse
  const toggleArchive = () => {
    setShowArchive(prev => !prev);
    setActiveFilter('all');
    setSearchQuery('');
    setExpandedOrderId(null);
    setTimeout(() => listRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  // ─── Loading State ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* ─── Header ──────────────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center gap-2 p-3 pb-2">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setCurrentView('admin')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight">
              {showArchive ? 'Архив заказов' : 'Управление заказами'}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {currentOrders.length} текущих · {archiveOrders.length} в архиве
            </p>
          </div>
          {/* Archive toggle button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleArchive}
                className={cn('shrink-0', showArchive && 'text-primary')}
              >
                <Archive className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{showArchive ? 'Текущие заказы' : 'Архив'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                className={cn('shrink-0', refreshing && 'animate-spin')}
                disabled={refreshing}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Обновить</TooltipContent>
          </Tooltip>
        </div>

        {/* ─── Search + Filter Tabs (only for current orders) ──────────────────────── */}
        {!showArchive && (
          <>
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Поиск по номеру, имени, телефону..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            <div className="px-3 pb-2.5">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {filterTabs.map((tab) => {
              const TabIcon = tab.icon;
              const count = filterCounts[tab.key];
              const isActive = activeFilter === tab.key;

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all shrink-0',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  <TabIcon className="h-2.5 w-2.5" />
                  {tab.label}
                  {count > 0 && (
                    <span className={cn(
                      'ml-0.5 text-[9px] font-semibold rounded-full px-1 py-0.5 min-w-[14px] text-center',
                      isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/10 text-muted-foreground',
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
          </>
        )}
      </div>

      {/* ─── Pull-to-refresh indicator ──────────────────────────────────────────── */}
      <AnimatePresence>
        {refreshing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 32, opacity: 1 }}
            className="shrink-0 flex items-center justify-center bg-primary/5 border-b border-primary/10"
            transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
          >
            <div className="flex items-center gap-1.5 text-primary text-xs">
              <RefreshCw className="h-3 w-3 animate-spin" />
              <span className="font-medium">Обновление...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Error banner ───────────────────────────────────────────────────────── */}
      {fetchError && (
        <Card className="mx-3 mt-2 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="flex items-start gap-2 p-3">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-red-800 dark:text-red-300">Ошибка загрузки</p>
              <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5 break-all">{fetchError}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchOrders} className="shrink-0 text-red-600 hover:text-red-800 h-7 text-xs">
              Повторить
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Orders List ────────────────────────────────────────────────────────── */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        <div className="p-3 pb-14">
          {showArchive ? (
            /* ── Archive View — grouped by months ── */
            archiveByMonth.length === 0 ? (
              <EmptyState
                icon={Archive}
                title="Архив пуст"
                description="Завершённые и отменённые заказы появятся здесь"
              />
            ) : (
              <div className="space-y-2">
                {archiveByMonth.map((month) => {
                  const isExpanded = expandedMonths.has(month.key);
                  const monthFilteredOrders = month.orders.filter(o => {
                    const matchesSearch = o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.contactName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          o.contactPhone?.includes(searchQuery);
                    return matchesSearch;
                  });
                  const showExpanded = isExpanded || (searchQuery && monthFilteredOrders.length > 0);

                  return (
                    <div key={month.key}>
                      <button
                        className="w-full flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
                        onClick={() => toggleMonth(month.key)}
                      >
                        {showExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="font-medium text-xs capitalize">{month.label}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          {month.orders.length}
                        </Badge>
                        <div className="flex-1" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMonthToDelete(month.key);
                            setDeleteMonthConfirmOpen(true);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </button>

                      {showExpanded && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
                          className="mt-1.5 space-y-2 pl-1"
                        >
                          {monthFilteredOrders.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground text-center py-3">
                              Нет заказов по выбранным фильтрам
                            </p>
                          ) : (
                            monthFilteredOrders.map((order) => (
                              <OrderCard
                                key={order.id}
                                order={order}
                                isExpanded={expandedOrderId === order.id}
                                onToggle={() => toggleExpand(order.id, order)}
                                onStatusChange={handleStatusChange}
                                onPaymentStatusChange={handlePaymentStatusChange}
                                onCancel={handleCancelClick}
                                onDelete={handleDeleteClick}
                                onSaveTracking={handleSaveTracking}
                                trackingNumber={trackingNumber}
                                setTrackingNumber={setTrackingNumber}
                                saving={saving}
                              />
                            ))
                          )}
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* ── Current Orders View ── */
            filteredOrders.length === 0 ? (
              <EmptyState
                icon={activeFilter === 'all' ? ShoppingBag : filterTabs.find(f => f.key === activeFilter)?.icon || ShoppingBag}
                title={activeFilter === 'all' ? 'Заказы не найдены' : getEmptyTitle(activeFilter)}
                description={activeFilter === 'all' ? 'Новых заказов пока нет' : getEmptyDescription(activeFilter)}
              />
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {orderGroups.map((group, gi) => (
                    <div key={group.label || 'single'}>
                      {group.label && (
                        <div className="flex items-center gap-3 my-3 px-1">
                          <div className="h-px flex-1 bg-border" />
                          <span className={`text-[10px] font-semibold ${group.color} uppercase tracking-wider`}>{group.label}</span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                      )}
                      {group.orders.map(order => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          isExpanded={expandedOrderId === order.id}
                          onToggle={() => toggleExpand(order.id, order)}
                          onStatusChange={handleStatusChange}
                          onPaymentStatusChange={handlePaymentStatusChange}
                          onCancel={handleCancelClick}
                          onDelete={handleDeleteClick}
                          onSaveTracking={handleSaveTracking}
                          trackingNumber={trackingNumber}
                          setTrackingNumber={setTrackingNumber}
                          saving={saving}
                        />
                      ))}
                    </div>
                  ))}
                </AnimatePresence>
              </div>
            )
          )}
        </div>
      </div>

      {/* ─── Delete Month Archive Confirmation Dialog ──────────────────────────── */}
      <AlertDialog open={deleteMonthConfirmOpen} onOpenChange={setDeleteMonthConfirmOpen}>
        <AlertDialogContent style={{ zIndex: 100 }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить архив за месяц?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const m = archiveByMonth.find(m => m.key === monthToDelete);
                return m ? `Вы уверены, что хотите удалить все ${m.orders.length} ${pluralize(m.orders.length, 'заказ', 'заказа', 'заказов')} за ${m.label.toLowerCase()}? Это действие нельзя отменить.` : '';
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingMonth}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMonthArchive}
              disabled={deletingMonth}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingMonth ? 'Удаление...' : 'Удалить все'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete Confirmation Dialog ────────────────────────────────────────── */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent style={{ zIndex: 100 }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить заказ?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить заказ #{orderToDelete?.orderNumber}? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Cancel Confirmation Dialog ────────────────────────────────────────── */}
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent style={{ zIndex: 100 }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить заказ?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите отменить заказ #{orderToCancel?.orderNumber}? Товары будут возвращены на склад.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Нет, оставить</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel}>
              Да, отменить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
