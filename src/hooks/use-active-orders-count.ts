'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook that fetches the count of "active" orders.
 *
 * For regular users: counts own pending + confirmed orders.
 * For collectors: counts ALL orders that need assembly
 *   (pending + confirmed + processing — excludes delivered/cancelled).
 *
 * Used to show a badge on the Orders button in the bottom nav.
 */
export function useActiveOrdersCount(
  userId: string | undefined,
  isCollector: boolean = false,
) {
  const [count, setCount] = useState(0);
  const isMounted = useRef(true);

  const fetchCount = useCallback(async () => {
    if (!userId || userId === 'demo-user') {
      if (isMounted.current) setCount(0);
      return;
    }

    try {
      if (isCollector) {
        // Collectors see ALL orders needing assembly (pending/confirmed/processing only)
        // Once collector presses "Собран" (shipped), order is done for them
        const res = await fetch(
          '/api/orders?limit=9999&excludeStatuses=shipped,delivered,cancelled',
        );
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted.current) {
          setCount(data.total ?? (data.orders || []).length);
        }
      } else {
        // Regular users: only own pending + confirmed
        const [pendingRes, confirmedRes] = await Promise.all([
          fetch(`/api/orders?userId=${userId}&status=pending&limit=1`),
          fetch(`/api/orders?userId=${userId}&status=confirmed&limit=1`),
        ]);

        if (!pendingRes.ok || !confirmedRes.ok) return;

        const pendingData = await pendingRes.json();
        const confirmedData = await confirmedRes.json();

        if (isMounted.current) {
          setCount((pendingData.total || 0) + (confirmedData.total || 0));
        }
      }
    } catch {
      // Silently fail — badge is non-critical
    }
  }, [userId, isCollector]);

  useEffect(() => {
    isMounted.current = true;
    void fetchCount();

    // Poll every 30 seconds for collectors (more frequent for real-time updates)
    const interval = setInterval(fetchCount, isCollector ? 10000 : 30000);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchCount, isCollector]);

  return count;
}
