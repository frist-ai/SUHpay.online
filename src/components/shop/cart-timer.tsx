'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const CART_TIMER_MINUTES = 15;
const CART_TIMER_MS = CART_TIMER_MINUTES * 60 * 1000;

export function CartTimer() {
  const { cartTimerStartedAt, clearCart } = useShopStore();
  const [tick, setTick] = useState(0);
  const expiredRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!cartTimerStartedAt) {
      clearTimerInterval();
      expiredRef.current = false;
      return;
    }

    const expiresAt = cartTimerStartedAt + CART_TIMER_MS;
    expiredRef.current = false;

    clearTimerInterval();
    intervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));

      if (remaining <= 0) {
        expiredRef.current = true;
        clearCart();
        clearTimerInterval();
      }

      setTick(t => t + 1);
    }, 1000);

    return () => clearTimerInterval();
  }, [cartTimerStartedAt, clearCart, clearTimerInterval]);

  const timeLeft = cartTimerStartedAt !== null
    ? Math.max(0, Math.ceil((cartTimerStartedAt + CART_TIMER_MS - Date.now()) / 1000))
    : null;

  const hasTime = timeLeft !== null && timeLeft <= CART_TIMER_MINUTES * 60 && cartTimerStartedAt !== null;
  const isExpired = expiredRef.current;
  const minutes = Math.floor((timeLeft ?? 0) / 60);
  const seconds = (timeLeft ?? 0) % 60;
  const isUrgent = timeLeft !== null && timeLeft <= 120;
  const isWarning = timeLeft !== null && timeLeft <= 300;

  void tick;

  if (!hasTime) return null;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[11px] font-medium tabular-nums transition-colors',
      isUrgent
        ? 'text-red-500'
        : isWarning
          ? 'text-amber-500'
          : 'text-muted-foreground'
    )}>
      {isExpired ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {isExpired ? 'Время вышло' : `${minutes}:${seconds.toString().padStart(2, '0')}`}
    </span>
  );
}
