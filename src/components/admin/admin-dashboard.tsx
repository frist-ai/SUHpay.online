'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useShopStore } from '@/stores/shop-store';
import { useAdminChatNotifications } from '@/hooks/use-chat-notifications';
import { useOrderNotifications } from '@/hooks/use-order-notifications';
import { NotificationBell } from '@/components/shared/notification-bell';
import { OrderNotificationsBell } from '@/components/shared/order-notifications-bell';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Package,
  FolderOpen,
  ClipboardList,
  Image as ImageIcon,
  Send,
  BarChart3,
  MessageSquarePlus,
  Percent,
  UserCircle,
  Sparkles,
  CreditCard,
  MessageSquare,
  Settings,
  Truck,
  ListOrdered,
  Users,
  Wallet,
  ChevronLeft,
  ShoppingBag,
  DollarSign,
  Star,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type SubView = 'main' | 'clients' | 'payment-delivery';

const slideVariants = {
  enter: { x: 40, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -40, opacity: 0 },
};

interface SubButton {
  label: string;
  description: string;
  icon: React.ReactNode;
  view: string;
  colorClass: string;
  bgClass: string;
}

const clientSubButtons: SubButton[] = [
  {
    label: 'Клиенты',
    description: 'Управление клиентами и контактами',
    icon: <UserCircle className="h-5 w-5" />,
    view: 'customers-manager',
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-100 dark:bg-blue-900/40',
  },
  {
    label: 'Запросы товаров',
    description: 'Запросы от клиентов на товары',
    icon: <MessageSquarePlus className="h-5 w-5" />,
    view: 'product-requests-manager',
    colorClass: 'text-orange-500',
    bgClass: 'bg-orange-100 dark:bg-orange-900/40',
  },
  {
    label: 'Рассылки',
    description: 'Массовые рассылки клиентам',
    icon: <Send className="h-5 w-5" />,
    view: 'broadcasts-manager',
    colorClass: 'text-green-500',
    bgClass: 'bg-green-100 dark:bg-green-900/40',
  },
  {
    label: 'Опросы',
    description: 'Опросы и обратная связь',
    icon: <BarChart3 className="h-5 w-5" />,
    view: 'polls-manager',
    colorClass: 'text-purple-500',
    bgClass: 'bg-purple-100 dark:bg-purple-900/40',
  },
];

const paymentSubButtons: SubButton[] = [
  {
    label: 'Оплата',
    description: 'Настройки способов оплаты',
    icon: <CreditCard className="h-5 w-5" />,
    view: 'payment-manager',
    colorClass: 'text-emerald-500',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/40',
  },
  {
    label: 'Доставка',
    description: 'Настройки способов доставки',
    icon: <Truck className="h-5 w-5" />,
    view: 'delivery-manager',
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-100 dark:bg-amber-900/40',
  },
];

// Dashboard stats from /api/stats
interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalUsers: number;
  averageCheck: number;
  loading: boolean;
}

// Menu item configuration
interface MenuItem {
  label: string;
  icon: React.ReactNode;
  view: string;
  colorClass: string;
  bgClass: string;
  hoverBgClass: string;
  badge?: () => number;
}

export function AdminDashboard() {
  const { setCurrentView, user } = useShopStore();
  const [subView, setSubView] = useState<SubView>('main');
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    totalRevenue: 0,
    totalUsers: 0,
    averageCheck: 0,
    loading: true,
  });

  // Fetch unread chat notifications for admin
  const { unreadCount: unreadChat } = useAdminChatNotifications(user?.id, user?.role);

  // Fetch new orders count for badge
  const { newOrdersCount } = useOrderNotifications(user?.role === 'admin');

  // Fetch dashboard stats
  useEffect(() => {
    if (user?.role !== 'admin') return;

    const fetchStats = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const res = await fetch(`/api/stats?from=${today.toISOString()}`);
        if (res.ok) {
          const data = await res.json();
          setStats({
            totalOrders: data.totalOrders ?? 0,
            totalRevenue: data.totalRevenue ?? 0,
            totalUsers: data.totalUsers ?? 0,
            averageCheck: data.averageCheck ?? 0,
            loading: false,
          });
        } else {
          setStats(prev => ({ ...prev, loading: false }));
        }
      } catch {
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    void fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [user?.role]);

  const subViewConfig: Record<string, { title: string }> = {
    clients: { title: 'Работа с клиентами' },
    'payment-delivery': { title: 'Оплата и доставка' },
  };

  const activeSubButtons =
    subView === 'clients' ? clientSubButtons : subView === 'payment-delivery' ? paymentSubButtons : clientSubButtons;

  // Menu items configuration
  const menuItems: MenuItem[] = [
    {
      label: 'Товары',
      icon: <Package className="h-5 w-5" />,
      view: 'products-manager',
      colorClass: 'text-orange-600',
      bgClass: 'bg-orange-100 dark:bg-orange-900/40',
      hoverBgClass: 'hover:bg-orange-50 dark:hover:bg-orange-900/20',
    },
    {
      label: 'Категории',
      icon: <FolderOpen className="h-5 w-5" />,
      view: 'categories-manager',
      colorClass: 'text-amber-600',
      bgClass: 'bg-amber-100 dark:bg-amber-900/40',
      hoverBgClass: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',
    },
    {
      label: 'Остатки',
      icon: <ClipboardList className="h-5 w-5" />,
      view: 'stock-manager',
      colorClass: 'text-red-600',
      bgClass: 'bg-red-100 dark:bg-red-900/40',
      hoverBgClass: 'hover:bg-red-50 dark:hover:bg-red-900/20',
    },
    {
      label: 'Баннеры',
      icon: <ImageIcon className="h-5 w-5" />,
      view: 'banners-manager',
      colorClass: 'text-pink-600',
      bgClass: 'bg-pink-100 dark:bg-pink-900/40',
      hoverBgClass: 'hover:bg-pink-50 dark:hover:bg-pink-900/20',
    },
    {
      label: 'Аналитика',
      icon: <BarChart3 className="h-5 w-5" />,
      view: 'analytics-manager',
      colorClass: 'text-emerald-600',
      bgClass: 'bg-emerald-100 dark:bg-emerald-900/40',
      hoverBgClass: 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
    },
    {
      label: 'Заказы',
      icon: <ListOrdered className="h-5 w-5" />,
      view: 'orders-manager',
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-100 dark:bg-blue-900/40',
      hoverBgClass: 'hover:bg-blue-50 dark:hover:bg-blue-900/20',
      badge: () => newOrdersCount,
    },
    {
      label: 'Промокоды',
      icon: <Percent className="h-5 w-5" />,
      view: 'promos-manager',
      colorClass: 'text-teal-600',
      bgClass: 'bg-teal-100 dark:bg-teal-900/40',
      hoverBgClass: 'hover:bg-teal-50 dark:hover:bg-teal-900/20',
    },
    {
      label: 'AI Combo',
      icon: <Sparkles className="h-5 w-5" />,
      view: 'ai-combo-manager',
      colorClass: 'text-purple-600',
      bgClass: 'bg-purple-100 dark:bg-purple-900/40',
      hoverBgClass: 'hover:bg-purple-50 dark:hover:bg-purple-900/20',
    },
    {
      label: 'Клиенты',
      icon: <Users className="h-5 w-5" />,
      view: '__clients__',
      colorClass: 'text-sky-600',
      bgClass: 'bg-sky-100 dark:bg-sky-900/40',
      hoverBgClass: 'hover:bg-sky-50 dark:hover:bg-sky-900/20',
    },
    {
      label: 'Оплата/Доставка',
      icon: <Wallet className="h-5 w-5" />,
      view: '__payment-delivery__',
      colorClass: 'text-amber-600',
      bgClass: 'bg-amber-100 dark:bg-amber-900/40',
      hoverBgClass: 'hover:bg-amber-50 dark:hover:bg-amber-900/20',
    },
    {
      label: 'Чат',
      icon: <MessageSquare className="h-5 w-5" />,
      view: 'chat-manager',
      colorClass: 'text-green-600',
      bgClass: 'bg-green-100 dark:bg-green-900/40',
      hoverBgClass: 'hover:bg-green-50 dark:hover:bg-green-900/20',
      badge: () => unreadChat,
    },
    {
      label: 'Настройки',
      icon: <Settings className="h-5 w-5" />,
      view: 'settings',
      colorClass: 'text-gray-600 dark:text-gray-400',
      bgClass: 'bg-gray-100 dark:bg-gray-800/40',
      hoverBgClass: 'hover:bg-gray-50 dark:hover:bg-gray-800/20',
    },
  ];

  // Metric cards data
  const metricCards = [
    {
      label: 'Заказы сегодня',
      value: stats.loading ? '—' : stats.totalOrders > 0 ? String(stats.totalOrders) : '—',
      icon: <ShoppingBag className="h-5 w-5 text-blue-600" />,
      iconBg: 'bg-blue-100 dark:bg-blue-900/40',
      gradient: 'from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20',
    },
    {
      label: 'Выручка',
      value: stats.loading ? '— ₽' : stats.totalRevenue > 0 ? `${stats.totalRevenue.toLocaleString('ru-RU')} ₽` : '— ₽',
      icon: <DollarSign className="h-5 w-5 text-emerald-600" />,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
      gradient: 'from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20',
    },
    {
      label: 'Клиенты',
      value: stats.loading ? '—' : stats.totalUsers > 0 ? String(stats.totalUsers) : '—',
      icon: <Users className="h-5 w-5 text-purple-600" />,
      iconBg: 'bg-purple-100 dark:bg-purple-900/40',
      gradient: 'from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20',
    },
    {
      label: 'Средний чек',
      value: stats.loading ? '— ₽' : stats.averageCheck > 0 ? `${Math.round(stats.averageCheck).toLocaleString('ru-RU')} ₽` : '— ₽',
      icon: <Star className="h-5 w-5 text-amber-600" />,
      iconBg: 'bg-amber-100 dark:bg-amber-900/40',
      gradient: 'from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20',
    },
  ];

  // Quick action chips
  const quickActions = [
    {
      label: 'Новые заказы',
      count: newOrdersCount,
      icon: <ShoppingBag className="h-3.5 w-3.5" />,
      borderColor: 'border-l-red-500',
      bgClass: 'bg-red-50 dark:bg-red-950/30',
      textColor: 'text-red-700 dark:text-red-400',
      view: 'orders-manager',
    },
    {
      label: 'Непрочитанные',
      count: unreadChat,
      icon: <MessageSquare className="h-3.5 w-3.5" />,
      borderColor: 'border-l-blue-500',
      bgClass: 'bg-blue-50 dark:bg-blue-950/30',
      textColor: 'text-blue-700 dark:text-blue-400',
      view: 'chat-manager',
    },
    {
      label: 'Низкий остаток',
      count: 0,
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      borderColor: 'border-l-amber-500',
      bgClass: 'bg-amber-50 dark:bg-amber-950/30',
      textColor: 'text-amber-700 dark:text-amber-400',
      view: 'stock-manager',
    },
  ];

  const handleMenuClick = (item: MenuItem) => {
    if (item.view === '__clients__') {
      setSubView('clients');
    } else if (item.view === '__payment-delivery__') {
      setSubView('payment-delivery');
    } else {
      setCurrentView(item.view as Parameters<typeof setCurrentView>[0]);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header with notifications */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2.5 flex items-center justify-between">
        <h1 className="text-lg font-bold">Панель администратора</h1>
        <div className="flex items-center gap-1">
          <OrderNotificationsBell
            isAdmin={user?.role === 'admin'}
            onViewOrders={() => setCurrentView('orders-manager')}
          />
          <NotificationBell
            userId={user?.id}
            onViewChat={() => setCurrentView('chat-manager')}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <AnimatePresence mode="wait">
          {subView === 'main' ? (
            <motion.div
              key="main"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="p-3 space-y-3"
            >
              {/* ── Metrics Overview ── */}
              <div className="grid grid-cols-2 gap-3">
                {metricCards.map((card, i) => (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: 'spring' as const,
                      stiffness: 300,
                      damping: 24,
                      delay: i * 0.07,
                    }}
                    className={cn(
                      'rounded-xl p-3 bg-gradient-to-br border border-white/30 dark:border-white/5',
                      card.gradient
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn('rounded-lg p-1.5', card.iconBg)}>
                        {card.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xl font-bold tracking-tight leading-tight truncate">
                          {card.value}
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                          {card.label}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* ── Quick Actions Row ── */}
              {quickActions.some(a => a.count > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring' as const, stiffness: 300, damping: 24, delay: 0.3 }}
                  className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4"
                >
                  {quickActions
                    .filter(a => a.count > 0)
                    .map(action => (
                      <button
                        key={action.label}
                        onClick={() => setCurrentView(action.view as Parameters<typeof setCurrentView>[0])}
                        className={cn(
                          'flex items-center gap-2 shrink-0 px-3 py-2 rounded-full border-l-4',
                          action.bgClass,
                          action.borderColor,
                          'transition-all active:scale-95'
                        )}
                      >
                        <span className={action.textColor}>{action.icon}</span>
                        <span className={cn('text-xs font-medium', action.textColor)}>
                          {action.label}
                        </span>
                        <Badge className="h-5 min-w-5 px-1.5 text-[10px] flex items-center justify-center bg-white/80 dark:bg-black/40 text-foreground shadow-sm">
                          {action.count}
                        </Badge>
                      </button>
                    ))}
                </motion.div>
              )}

              {/* ── Menu Grid ── */}
              <div className="grid grid-cols-3 gap-3">
                {menuItems.map((item, i) => {
                  const badgeCount = item.badge ? item.badge() : 0;
                  return (
                    <motion.button
                      key={item.view}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: 'spring' as const,
                        stiffness: 300,
                        damping: 24,
                        delay: 0.35 + i * 0.04,
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleMenuClick(item)}
                      className={cn(
                        'relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl',
                        'bg-card border border-border/60 shadow-sm',
                        'transition-colors',
                        item.hoverBgClass
                      )}
                    >
                      {/* Colored icon in rounded square bg */}
                      <div className={cn('rounded-xl p-2.5', item.bgClass)}>
                        <span className={item.colorClass}>{item.icon}</span>
                      </div>

                      {/* Label */}
                      <span className="text-xs font-medium text-center leading-tight">
                        {item.label}
                      </span>

                      {/* Optional badge */}
                      {badgeCount > 0 && (
                        <Badge className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1.5 text-[10px] flex items-center justify-center bg-red-500 text-white animate-pulse shadow-sm">
                          {badgeCount > 9 ? '9+' : badgeCount}
                        </Badge>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={subView}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex flex-col min-h-full"
            >
              {/* Sub-view header */}
              <div className="flex items-center gap-3 p-4 pb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSubView('main')}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-lg font-semibold">
                  {subViewConfig[subView]?.title ?? ''}
                </h2>
              </div>

              {/* Sub-view cards grid */}
              <div className="flex-1 p-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  {activeSubButtons.map((btn, i) => (
                    <motion.button
                      key={btn.view}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        type: 'spring' as const,
                        stiffness: 300,
                        damping: 24,
                        delay: i * 0.06,
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setCurrentView(btn.view as Parameters<typeof setCurrentView>[0])}
                      className={cn(
                        'border rounded-xl p-4 transition-colors cursor-pointer text-left flex items-start gap-3',
                        'bg-card shadow-sm',
                        'hover:bg-muted/50'
                      )}
                    >
                      <div className={cn('shrink-0 mt-0.5 rounded-lg p-2', btn.bgClass)}>
                        <span className={btn.colorClass}>{btn.icon}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{btn.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{btn.description}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
