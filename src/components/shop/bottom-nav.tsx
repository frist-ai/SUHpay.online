'use client';

import { useMemo, useCallback } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { cn } from '@/lib/utils';
import { Home, ShoppingBag, Package, User, LayoutDashboard } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { useActiveOrdersCount } from '@/hooks/use-active-orders-count';
import { motion, AnimatePresence } from 'framer-motion';


const navItems = [
  { id: 'catalog', label: 'Каталог', icon: Home },
  { id: 'cart', label: 'Корзина', icon: ShoppingBag },
  { id: 'orders', label: 'Заказы', icon: Package },
  { id: 'profile', label: 'Профиль', icon: User },
] as const;

const adminNavItems = [
  { id: 'admin', label: 'Админ', icon: LayoutDashboard },
  { id: 'catalog', label: 'Каталог', icon: Home },
  { id: 'cart', label: 'Корзина', icon: ShoppingBag },
  { id: 'orders', label: 'Заказы', icon: Package },
  { id: 'profile', label: 'Профиль', icon: User },
] as const;

export function BottomNav() {
  const { currentView, setCurrentView, cartCount, isAdmin, isCollector, user } = useShopStore();
  
  // Fetch notifications to show badge on profile
  const { unreadCount } = useNotifications(user?.id);
  // Fetch active orders count for badge on Orders button
  // Collectors see ALL uncollected orders, regular users see own pending/confirmed
  const activeOrdersCount = useActiveOrdersCount(user?.id, isCollector);

  const activeNav = useMemo(() => {
    if (currentView === 'admin' || currentView === 'products-manager' || currentView === 'orders-manager' || currentView === 'settings') {
      return 'admin';
    }
    if (currentView === 'cart' || currentView === 'checkout') {
      return 'cart';
    }
    return currentView;
  }, [currentView]);
  
  const items = isAdmin ? adminNavItems : navItems;

  const handleClick = useCallback((id: typeof currentView) => {
    setCurrentView(id);
  }, [setCurrentView]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      {/* Liquid Glass capsule */}
      <div className="mx-3 mb-1.5 max-w-lg rounded-full overflow-hidden">
        {/* Glass background — ultra-light translucent tint */}
        <div className="absolute inset-0 bg-black/5 dark:bg-black/20 backdrop-blur-[2rem] saturate-[1.5] rounded-full -z-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-white/8 dark:from-white/10 dark:via-white/2 dark:to-white/5 rounded-full -z-10" />
        {/* Top edge light reflection */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/15" />
        {/* Bottom edge */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-black/5 dark:bg-black/10" />
        {/* Inner shadow for depth */}
        <div className="absolute inset-0 shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.2),inset_0_-0.5px_0.5px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.1),inset_0_-0.5px_0.5px_rgba(0,0,0,0.1)] -z-10 rounded-full" />

        <div className="flex justify-around items-center h-[2.75rem] relative">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            const showCartBadge = item.id === 'cart' && cartCount > 0;
            const showOrdersBadge = item.id === 'orders' && activeOrdersCount > 0;
            const showNotificationBadge = item.id === 'profile' && unreadCount > 0;

            return (
              <button
                key={item.id}
                onClick={() => handleClick(item.id as typeof currentView)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 relative',
                  'transition-all duration-300 ease-out',
                  'active:scale-90 active:opacity-80',
                )}
              >
                {/* Active glow background */}
                <AnimatePresence mode="wait">
                  {isActive && (
                    <motion.div
                      layoutId="activeTabGlow"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-7 rounded-xl bg-white/40 dark:bg-white/15 blur-[2px]"
                    />
                  )}
                </AnimatePresence>

                <div className="relative flex items-center justify-center">
                  <Icon
                    className={cn(
                      'transition-all duration-300 ease-out',
                      isActive
                        ? 'h-[22px] w-[22px] text-blue-500 dark:text-blue-400'
                        : 'h-4 w-4 text-black/40 dark:text-white/45',
                    )}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                  {/* Cart badge — green circle, top-right with scale animation */}
                  <AnimatePresence>
                    {showCartBadge && (
                      <motion.span
                        key="cart-badge"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className={cn(
                          'absolute -top-1.5 -right-2.5',
                          'min-w-[16px] h-4 px-1 rounded-full',
                          'bg-red-500 text-white',
                          'text-[10px] leading-none font-semibold',
                          'flex items-center justify-center',
                          'shadow-sm',
                        )}
                      >
                        {cartCount > 99 ? '99+' : cartCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {/* Orders badge — subtle amber dot with count */}
                  <AnimatePresence>
                    {showOrdersBadge && (
                      <motion.span
                        key="orders-badge"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className={cn(
                          'absolute -top-1.5 -right-3',
                          'min-w-[16px] h-4 px-1 rounded-full',
                          'bg-red-500 text-white',
                          'text-[10px] leading-none font-semibold',
                          'flex items-center justify-center',
                          'shadow-sm',
                        )}
                      >
                        {activeOrdersCount > 9 ? '9+' : activeOrdersCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {/* Notification badge — on profile icon with scale animation */}
                  <AnimatePresence>
                    {showNotificationBadge && (
                      <motion.span
                        key="notif-badge"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className={cn(
                          'absolute -top-1.5 -right-2.5',
                          'min-w-[16px] h-4 px-1 rounded-full',
                          'bg-red-500 text-white',
                          'text-[10px] leading-none font-semibold',
                          'flex items-center justify-center',
                          'shadow-sm',
                        )}
                      >
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium truncate transition-all duration-300 ease-out leading-tight',
                    isActive
                      ? 'text-blue-500 dark:text-blue-400'
                      : 'text-black/35 dark:text-white/40',
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
