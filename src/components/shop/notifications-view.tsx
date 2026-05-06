'use client';

import { useState, useCallback, useMemo } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { useNotifications, type Notification } from '@/hooks/use-notifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Bell,
  CheckCheck,
  Package,
  MessageSquare,
  Tag,
  Star,
  Info,
  Trash2,
  Loader2,
  Sparkles,
  ChevronLeft,
  Gift,
  Shield,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticFeedback } from '@/lib/telegram';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

// ─── Notification type config ────────────────────────────────────────

interface NotificationTypeConfig {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

const notificationTypeConfig: Record<string, NotificationTypeConfig> = {
  order_update: {
    icon: Package,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-500/10',
  },
  order_created: {
    icon: Package,
    iconColor: 'text-green-500',
    iconBg: 'bg-green-500/10',
  },
  order_status: {
    icon: Package,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-500/10',
  },
  support_message: {
    icon: MessageSquare,
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-500/10',
  },
  support_reply: {
    icon: MessageSquare,
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-500/10',
  },
  promo: {
    icon: Tag,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-500/10',
  },
  discount: {
    icon: Tag,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-500/10',
  },
  loyalty: {
    icon: Star,
    iconColor: 'text-yellow-500',
    iconBg: 'bg-yellow-500/10',
  },
  loyalty_points: {
    icon: Gift,
    iconColor: 'text-pink-500',
    iconBg: 'bg-pink-500/10',
  },
  payment: {
    icon: CreditCard,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-500/10',
  },
  system: {
    icon: Info,
    iconColor: 'text-gray-500',
    iconBg: 'bg-gray-500/10',
  },
  security: {
    icon: Shield,
    iconColor: 'text-red-500',
    iconBg: 'bg-red-500/10',
  },
};

function getTypeConfig(type: string): NotificationTypeConfig {
  return notificationTypeConfig[type] || {
    icon: Bell,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
  };
}

// ─── Group notifications by date ────────────────────────────────────

interface NotificationGroup {
  label: string;
  notifications: Notification[];
}

function groupNotificationsByDate(notifications: Notification[]): NotificationGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  const groups: NotificationGroup[] = [
    { label: 'Сегодня', notifications: [] },
    { label: 'Вчера', notifications: [] },
    { label: 'Ранее', notifications: [] },
  ];

  for (const notification of notifications) {
    const date = new Date(notification.createdAt);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (dayStart.getTime() >= today.getTime()) {
      groups[0].notifications.push(notification);
    } else if (dayStart.getTime() >= yesterday.getTime()) {
      groups[1].notifications.push(notification);
    } else {
      groups[2].notifications.push(notification);
    }
  }

  // Only return non-empty groups
  return groups.filter(g => g.notifications.length > 0);
}

// ─── Format notification time ───────────────────────────────────────

function formatNotificationTime(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return 'Только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  if (hours < 24) return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// ─── Animated bell illustration for empty state ─────────────────────

function BellIllustration() {
  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" fill="none">
      {/* Bell body */}
      <motion.path
        d="M60 20 C 40 20, 30 35, 30 55 L 30 70 L 22 82 L 98 82 L 90 70 L 90 55 C 90 35, 80 20, 60 20Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
        className="text-brand/60"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
      />
      {/* Bell clapper */}
      <motion.path
        d="M50 82 C 50 90, 70 90, 70 82"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="text-brand/40"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 1.0, ease: 'easeOut' }}
      />
      {/* Ring waves */}
      <motion.path
        d="M100 45 C 108 50, 108 60, 100 65"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="text-brand/25"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: [0, 1, 0], opacity: [0, 0.6, 0] }}
        transition={{ duration: 2, delay: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.path
        d="M108 38 C 120 46, 120 64, 108 72"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-brand/15"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: [0, 1, 0], opacity: [0, 0.4, 0] }}
        transition={{ duration: 2, delay: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Sparkle */}
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 1.5, delay: 2.2, repeat: Infinity, repeatDelay: 3 }}
      >
        <line x1="60" y1="8" x2="60" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand/40" />
        <line x1="57" y1="11" x2="63" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-brand/40" />
      </motion.g>
    </svg>
  );
}

// ─── Swipeable notification item ────────────────────────────────────

function SwipeableNotificationItem({
  notification,
  index,
  onTap,
  onDismiss,
}: {
  notification: Notification;
  index: number;
  onTap: (n: Notification) => void;
  onDismiss: (id: string) => void;
}) {
  const config = getTypeConfig(notification.type);
  const Icon = config.icon;

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -80) {
      onDismiss(notification.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -200, height: 0, marginBottom: 0, padding: 0, overflow: 'hidden' }}
      transition={{
        opacity: { duration: 0.2 },
        y: { duration: 0.3, delay: index * 0.04, ease: 'easeOut' },
      }}
      layout
    >
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.3, right: 0 }}
        onDragEnd={handleDragEnd}
        className="relative"
      >
        {/* Red delete background (shows on swipe) */}
        <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 rounded-xl bg-red-500/10">
          <div className="flex items-center gap-1 text-red-500 text-xs font-medium">
            <Trash2 className="h-3.5 w-3.5" />
            Удалить
          </div>
        </div>

        <button
          className={cn(
            'relative w-full flex items-start gap-3 p-3 rounded-xl transition-colors text-left',
            'active:scale-[0.99] active:bg-muted/50',
            !notification.isRead
              ? 'bg-primary/[0.04] dark:bg-primary/[0.06]'
              : 'bg-background hover:bg-muted/30',
          )}
          onClick={() => onTap(notification)}
        >
          {/* Icon */}
          <div className={cn('p-2.5 rounded-xl shrink-0', config.iconBg)}>
            <Icon className={cn('h-4.5 w-4.5', config.iconColor)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={cn(
                'text-sm leading-snug',
                !notification.isRead ? 'font-semibold text-foreground' : 'font-medium text-foreground/80',
              )}>
                {notification.title}
              </p>
              {/* Unread dot */}
              {!notification.isRead && (
                <motion.div
                  className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 mt-1"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
              {notification.message}
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-1.5">
              {formatNotificationTime(notification.createdAt)}
            </p>
          </div>
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Loading skeleton ───────────────────────────────────────────────

function NotificationsSkeleton() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header skeleton */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 bg-muted rounded animate-pulse" />
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
            <div className="w-10 h-10 rounded-xl bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-3 w-full bg-muted rounded animate-pulse" />
              <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Notifications View ────────────────────────────────────────

export function NotificationsView() {
  const { user, setCurrentView } = useShopStore();
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    deleteNotifications,
    refetch,
  } = useNotifications(user?.id);

  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Group notifications by date
  const groupedNotifications = useMemo(
    () => groupNotificationsByDate(notifications),
    [notifications],
  );

  // Handle notification tap
  const handleNotificationTap = useCallback(async (notification: Notification) => {
    hapticFeedback('light');

    // Mark as read first
    if (!notification.isRead) {
      await markAsRead([notification.id]);
    }

    // Navigate based on notification type
    if (notification.type === 'support_message' || notification.type === 'support_reply') {
      setCurrentView('support');
    } else if (
      notification.type === 'order_update' ||
      notification.type === 'order_created' ||
      notification.type === 'order_status' ||
      notification.type === 'payment'
    ) {
      setCurrentView('orders');
    } else if (notification.type === 'promo' || notification.type === 'discount') {
      setCurrentView('catalog');
    } else if (notification.type === 'loyalty' || notification.type === 'loyalty_points') {
      setCurrentView('profile');
    }
  }, [markAsRead, setCurrentView]);

  // Handle mark all as read
  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) return;
    hapticFeedback('light');
    setMarkingAllRead(true);
    await markAsRead();
    setMarkingAllRead(false);
  }, [markAsRead, unreadCount]);

  // Handle swipe-to-dismiss
  const handleDismiss = useCallback(async (id: string) => {
    hapticFeedback('light');
    await deleteNotifications([id]);
  }, [deleteNotifications]);

  // Handle delete all
  const handleDeleteAll = useCallback(async () => {
    hapticFeedback('medium');
    await deleteNotifications();
  }, [deleteNotifications]);

  // ─── Loading ─────────────────────────────────────────────────────
  if (loading) {
    return <NotificationsSkeleton />;
  }

  // ─── Empty state ─────────────────────────────────────────────────
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">Уведомления</h1>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <motion.div
            className="flex flex-col items-center text-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <motion.div
              className="w-32 h-32 mb-6 text-brand"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
            >
              <BellIllustration />
            </motion.div>

            <motion.h2
              className="text-xl font-bold mb-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.3 }}
            >
              Пока пусто
            </motion.h2>

            <motion.p
              className="text-muted-foreground mb-6 max-w-xs text-sm leading-relaxed"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.4 }}
            >
              Здесь будут отображаться уведомления о заказах, акциях и сообщениях поддержки
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.6, type: 'spring', stiffness: 180 }}
            >
              <Button
                onClick={() => setCurrentView('catalog')}
                className="bg-gradient-to-r from-brand to-brand/80 hover:from-brand/90 hover:to-brand/70 text-brand-foreground shadow-lg shadow-brand/20 hover:shadow-brand/30 active:scale-[0.97] transition-all px-6 py-2.5 rounded-xl font-semibold"
                size="lg"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Перейти в каталог
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── Main view with notifications ────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">Уведомления</h1>
            {unreadCount > 0 && (
              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 text-xs px-2">
                {unreadCount} {unreadCount === 1 ? 'непрочитанное' : unreadCount < 5 ? 'непрочитанных' : 'непрочитанных'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                onClick={handleMarkAllRead}
                disabled={markingAllRead}
              >
                {markingAllRead ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )}
                Прочитать все
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleDeleteAll}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Notification list */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-14 liquid-glass-scroll">
        <div className="p-3">
          <AnimatePresence initial={false}>
            {groupedNotifications.map((group) => (
              <div key={group.label} className="mb-5 last:mb-0">
                {/* Date group header */}
                <motion.div
                  className="flex items-center gap-2 mb-2 px-1"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-border/50" />
                  <span className="text-[11px] text-muted-foreground/50">
                    {group.notifications.length} {group.notifications.length === 1 ? 'уведомление' : group.notifications.length < 5 ? 'уведомления' : 'уведомлений'}
                  </span>
                </motion.div>

                {/* Notification items */}
                <Card className="overflow-hidden border-border/40">
                  <CardContent className="p-1.5">
                    <div className="divide-y divide-border/30">
                      {group.notifications.map((notification, idx) => (
                        <SwipeableNotificationItem
                          key={notification.id}
                          notification={notification}
                          index={idx}
                          onTap={handleNotificationTap}
                          onDismiss={handleDismiss}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
