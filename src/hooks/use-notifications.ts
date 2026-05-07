'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

// Hook for fetching and managing notifications
export function useNotifications(userId: string | undefined) {
  const [state, setState] = useState<NotificationsState>({
    notifications: [],
    unreadCount: 0,
    loading: true,
    error: null,
  });
  const isMounted = useRef(true);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const res = await fetch(`/api/notifications?limit=20&userId=${userId}`, {
        headers: {
          'x-user-id': userId,
        },
      });
      
      if (res.ok && isMounted.current) {
        const data = await res.json();
        setState({
          notifications: data.notifications || [],
          unreadCount: data.unreadCount || 0,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('[Notifications] Error fetching:', error);
      if (isMounted.current) {
        setState(prev => ({ ...prev, loading: false }));
      }
    }
  }, [userId]);

  const markAsRead = useCallback(async (notificationIds?: string[]) => {
    if (!userId) return;

    // Optimistic update - immediately update UI
    setState(prev => {
      let updatedNotifications = prev.notifications;
      
      if (notificationIds) {
        // Mark specific notifications as read
        updatedNotifications = prev.notifications.map(n => 
          notificationIds.includes(n.id) ? { ...n, isRead: true } : n
        );
      } else {
        // Mark all as read
        updatedNotifications = prev.notifications.map(n => ({ ...n, isRead: true }));
      }
      
      const newUnreadCount = updatedNotifications.filter(n => !n.isRead).length;
      
      return {
        ...prev,
        notifications: updatedNotifications,
        unreadCount: newUnreadCount,
      };
    });

    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          notificationIds,
          markAll: !notificationIds,
          userId, // Also send userId in body for reliability
        }),
      });
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      // On error, refetch to get correct state
      await fetchNotifications();
    }
  }, [userId, fetchNotifications]);

  const deleteNotifications = useCallback(async (notificationIds?: string[]) => {
    if (!userId) return;

    // Optimistic update - immediately update UI
    setState(prev => {
      let updatedNotifications = prev.notifications;
      
      if (notificationIds) {
        // Delete specific notifications
        updatedNotifications = prev.notifications.filter(n => !notificationIds.includes(n.id));
      } else {
        // Delete all
        updatedNotifications = [];
      }
      
      const newUnreadCount = updatedNotifications.filter(n => !n.isRead).length;
      
      return {
        ...prev,
        notifications: updatedNotifications,
        unreadCount: newUnreadCount,
      };
    });

    try {
      await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          notificationIds,
          deleteAll: !notificationIds,
          userId,
        }),
      });
    } catch (error) {
      console.error('Error deleting notifications:', error);
      // On error, refetch to get correct state
      await fetchNotifications();
    }
  }, [userId, fetchNotifications]);

  useEffect(() => {
    isMounted.current = true;
    
    // Poll every 30 seconds (reduced from 15 to minimize API calls)
    const interval = setInterval(fetchNotifications, 30000);
    
    // Initial fetch
    void fetchNotifications();
    
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  return { 
    ...state, 
    refetch: fetchNotifications,
    markAsRead,
    deleteNotifications,
  };
}
