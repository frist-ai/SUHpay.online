'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingCart, Clock, CheckCircle2, Truck, XCircle, AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import { useOrderNotifications, type OrderNotification } from '@/hooks/use-order-notifications';
import { hapticFeedback } from '@/lib/telegram';
import { cn } from '@/lib/utils';
import { CopyableOrderNumber } from '@/components/shared/copyable-order-number';

interface OrderNotificationsBellProps {
  isAdmin: boolean;
  onViewOrders?: () => void;
}

// Get status icon and color
function getStatusConfig(status: string) {
  switch (status) {
    case 'pending':
      return { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' };
    case 'confirmed':
      return { icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' };
    case 'processing':
      return { icon: AlertCircle, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' };
    case 'shipped':
      return { icon: Truck, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30' };
    case 'delivered':
      return { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' };
    case 'cancelled':
      return { icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' };
    default:
      return { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted' };
  }
}

// Format relative time
function formatRelativeTime(date: string) {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  if (hours < 24) return `${hours} ч. назад`;
  if (days < 7) return `${days} дн. назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// Status labels
const statusLabels: Record<string, string> = {
  pending: 'Ожидает',
  confirmed: 'Подтвержден',
  processing: 'В обработке',
  shipped: 'Собран',
  delivered: 'Доставлен',
  cancelled: 'Отменен',
};

export function OrderNotificationsBell({ isAdmin, onViewOrders }: OrderNotificationsBellProps) {
  const [open, setOpen] = useState(false);
  const { newOrders, newOrdersCount, loading } = useOrderNotifications(isAdmin);

  const handleOrderClick = (order: OrderNotification) => {
    hapticFeedback('light');
    setOpen(false);
    onViewOrders?.();
  };

  const handleViewAll = () => {
    hapticFeedback('light');
    setOpen(false);
    onViewOrders?.();
  };

  if (!isAdmin) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <ShoppingCart className="h-5 w-5" />
          {newOrdersCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] animate-pulse bg-orange-500 hover:bg-orange-500"
            >
              {newOrdersCount > 9 ? '9+' : newOrdersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Заказы
          </h3>
          {newOrdersCount > 0 && (
            <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              {newOrdersCount} {newOrdersCount === 1 ? 'заказ' : newOrdersCount < 5 ? 'заказа' : 'заказов'}
            </Badge>
          )}
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : newOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">Нет новых заказов</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[260px]">
              <div className="divide-y">
                {newOrders.map((order) => {
                  const statusConfig = getStatusConfig(order.status);
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <div
                      key={order.id}
                      className="group flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleOrderClick(order)}
                    >
                      <div className={cn('p-2 rounded-xl flex-shrink-0', statusConfig.bg)}>
                        <StatusIcon className={cn('h-4 w-4', statusConfig.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <CopyableOrderNumber orderNumber={order.orderNumber} className="text-sm" />
                          {order.isNew && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500 text-white">
                              Новый
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {order.total.toLocaleString('ru-RU')} ₽ · {statusLabels[order.status] || order.status}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatRelativeTime(order.createdAt)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            
            {/* View all button */}
            <div className="p-3 border-t bg-muted/30">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full h-8 text-xs"
                onClick={handleViewAll}
              >
                <ShoppingCart className="h-3 w-3 mr-1" />
                Все заказы
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
