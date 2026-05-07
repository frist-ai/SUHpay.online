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
import { Bell, Check, MessageSquare, Package, Loader2, Trash2, X, ArrowRight } from 'lucide-react';
import { useNotifications, type Notification } from '@/hooks/use-notifications';
import { useShopStore } from '@/stores/shop-store';
import { hapticFeedback } from '@/lib/telegram';

interface NotificationBellProps {
  userId: string | undefined;
  onViewChat?: () => void;
  onViewOrder?: (orderId: string) => void;
}

// Get icon based on notification type
function getNotificationIcon(type: string) {
  switch (type) {
    case 'support_message':
    case 'support_reply':
      return MessageSquare;
    case 'order_update':
    case 'order_created':
    case 'order_status':
      return Package;
    case 'payment':
      return Check;
    default:
      return Bell;
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

export function NotificationBell({ userId, onViewChat, onViewOrder }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, markAsRead, deleteNotifications } = useNotifications(userId);
  const setCurrentView = useShopStore(s => s.setCurrentView);

  // Filter to only show unread notifications in the popup
  const visibleNotifications = notifications.filter(n => !n.isRead);
  const readNotifications = notifications.filter(n => n.isRead).slice(0, 5);

  const handleNotificationClick = async (notification: Notification) => {
    hapticFeedback('light');
    
    // Mark as read (this will immediately update the UI via optimistic update)
    await markAsRead([notification.id]);
    
    // Handle navigation
    if (notification.type === 'support_message' || notification.type === 'support_reply') {
      onViewChat?.();
      setOpen(false);
    } else if ((notification.type === 'order_update' || notification.type === 'order_created' || notification.type === 'order_status' || notification.type === 'payment') && notification.data) {
      try {
        const data = JSON.parse(notification.data);
        if (data.orderId) {
          onViewOrder?.(data.orderId);
          setOpen(false);
        }
      } catch {
        // Ignore parse errors
      }
    }
  };

  const handleMarkAllRead = async () => {
    hapticFeedback('light');
    await markAsRead();
  };

  const handleDeleteAll = async () => {
    hapticFeedback('light');
    await deleteNotifications();
  };

  const handleDeleteOne = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    hapticFeedback('light');
    await deleteNotifications([notificationId]);
  };

  const handleViewAll = () => {
    hapticFeedback('light');
    setOpen(false);
    setCurrentView('notifications');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] animate-pulse"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Уведомления</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} непрочитанн{unreadCount === 1 ? 'ое' : unreadCount < 5 ? 'ых' : 'ых'}
            </Badge>
          )}
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">Нет уведомлений</p>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[260px]">
              <div className="divide-y">
                {visibleNotifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  return (
                    <div
                      key={notification.id}
                      className="group relative flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors bg-primary/5 cursor-pointer"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="p-2 rounded-xl flex-shrink-0 bg-primary/20">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-primary">
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => handleDeleteOne(e, notification.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {/* Show read notifications separately */}
                {readNotifications.length > 0 && visibleNotifications.length > 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/30">
                    Прочитанные
                  </div>
                )}
                {readNotifications.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  return (
                    <div
                      key={notification.id}
                      className="group relative flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors opacity-60 cursor-pointer"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="p-2 rounded-xl flex-shrink-0 bg-muted">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDeleteOne(e, notification.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            
            {/* Action buttons at bottom */}
            <div className="border-t bg-muted/30">
              {/* View all notifications link */}
              <button
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/5 transition-colors"
                onClick={handleViewAll}
              >
                Все уведомления
                <ArrowRight className="h-3 w-3" />
              </button>
              {(unreadCount > 0 || notifications.length > 0) && (
                <div className="flex gap-2 px-3 pb-3">
                  {unreadCount > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 h-8 text-xs"
                      onClick={handleMarkAllRead}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Прочитать все
                    </Button>
                  )}
                  {notifications.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={handleDeleteAll}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Очистить
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
