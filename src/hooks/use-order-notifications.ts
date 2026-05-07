'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface OrderNotification {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  contactName?: string;
  isNew: boolean;
}

interface OrderNotificationsState {
  newOrders: OrderNotification[];
  newOrdersCount: number;
  loading: boolean;
}

// Hook for fetching new/pending orders for admin notifications
export function useOrderNotifications(isAdmin: boolean) {
  const [state, setState] = useState<OrderNotificationsState>({
    newOrders: [],
    newOrdersCount: 0,
    loading: true,
  });
  const isMounted = useRef(true);
  const lastCheckRef = useRef<string | null>(null);

  const fetchNewOrders = useCallback(async () => {
    if (!isAdmin) {
      setState({ newOrders: [], newOrdersCount: 0, loading: false });
      return;
    }

    try {
      // Get pending and confirmed orders in parallel (faster)
      const [pendingRes, confirmedRes] = await Promise.all([
        fetch('/api/orders?status=pending&limit=10'),
        fetch('/api/orders?status=confirmed&limit=10'),
      ]);
      
      const pendingData = await pendingRes.json();
      const confirmedData = await confirmedRes.json();

      const pendingOrders = (pendingData.orders || []).map((o: OrderNotification) => ({ ...o, isNew: true }));
      const confirmedOrders = (confirmedData.orders || []).map((o: OrderNotification) => ({ ...o, isNew: o.paymentStatus === 'pending' || o.paymentStatus === 'pending_confirmation' }));

      // Combine and sort by date
      const allNewOrders = [...pendingOrders, ...confirmedOrders]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);

      // Check for truly new orders (created in last 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const trulyNewOrders = allNewOrders.filter(
        (o: OrderNotification) => new Date(o.createdAt).getTime() > fiveMinutesAgo
      );

      // Update last check time
      const now = new Date().toISOString();
      const hadNewOrders = trulyNewOrders.length > 0 && lastCheckRef.current;
      
      if (isMounted.current) {
        setState({
          newOrders: allNewOrders,
          newOrdersCount: allNewOrders.length,
          loading: false,
        });
      }

      lastCheckRef.current = now;

      // Return if there are new orders for toast notification
      return hadNewOrders && trulyNewOrders.length > 0;

    } catch (error) {
      console.error('[OrderNotifications] Error fetching:', error);
      if (isMounted.current) {
        setState(prev => ({ ...prev, loading: false }));
      }
      return false;
    }
  }, [isAdmin]);

  useEffect(() => {
    isMounted.current = true;

    // Initial fetch
    void fetchNewOrders();

    // Poll every 30 seconds
    const interval = setInterval(fetchNewOrders, 30000);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchNewOrders]);

  return {
    ...state,
    refetch: fetchNewOrders,
  };
}
