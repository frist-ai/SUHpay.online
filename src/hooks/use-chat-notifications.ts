'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, useRef } from 'react';

interface ChatNotificationState {
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

// Hook for user to check unread messages from admin
export function useUserChatNotifications(userId: string | undefined) {
  const [state, setState] = useState<ChatNotificationState>({
    unreadCount: 0,
    loading: true,
    error: null,
  });
  const isMounted = useRef(true);
  const hasLoaded = useRef(false);

  const fetchUnread = useCallback(async () => {
    if (!userId) {
      if (!hasLoaded.current) {
        hasLoaded.current = true;
        setState(prev => ({ ...prev, loading: false }));
      }
      return;
    }

    try {
      const res = await fetch('/api/chat/unread', {
        headers: {
          'x-user-id': userId,
        },
      });

      if (res.ok && isMounted.current) {
        const data = await res.json();
        hasLoaded.current = true;
        setState({
          unreadCount: data.unreadByUser || 0,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
      if (isMounted.current) {
        setState(prev => ({ ...prev, loading: false }));
      }
    }
  }, [userId]);

  useEffect(() => {
    isMounted.current = true;
    
    // Poll every 10 seconds
    const interval = setInterval(fetchUnread, 10000);
    
    // Initial fetch
    void fetchUnread();
    
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchUnread]);

  return { ...state, refetch: fetchUnread };
}

// Hook for admin to check total unread messages from all users
export function useAdminChatNotifications(userId: string | undefined, userRole: string | undefined) {
  const [state, setState] = useState<ChatNotificationState>({
    unreadCount: 0,
    loading: true,
    error: null,
  });
  const isMounted = useRef(true);
  const hasLoaded = useRef(false);

  const fetchUnread = useCallback(async () => {
    if (!userId || userRole !== 'admin') {
      if (!hasLoaded.current) {
        hasLoaded.current = true;
        setState(prev => ({ ...prev, loading: false }));
      }
      return;
    }

    try {
      const res = await fetch('/api/admin/chat/unread', {
        headers: {
          'x-user-id': userId,
          'x-user-role': userRole,
        },
      });

      if (res.ok && isMounted.current) {
        const data = await res.json();
        hasLoaded.current = true;
        setState({
          unreadCount: data.totalUnread || 0,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('Error fetching admin unread count:', error);
      if (isMounted.current) {
        setState(prev => ({ ...prev, loading: false }));
      }
    }
  }, [userId, userRole]);

  useEffect(() => {
    isMounted.current = true;
    
    // Poll every 10 seconds
    const interval = setInterval(fetchUnread, 10000);
    
    // Initial fetch
    void fetchUnread();
    
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchUnread]);

  return { ...state, refetch: fetchUnread };
}
