'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useShopStore } from '@/stores/shop-store';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Coins, Flame, Zap, PartyPopper } from 'lucide-react';

interface TapState {
  taps: number;
  bonus: number;
  maxDaily: number;
  canEarn: boolean;
  claimed: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  size: number;
  color: string;
  delay: number;
}

interface FloatingNumber {
  id: number;
  x: number;
  y: number;
  value: number;
}

const PARTICLE_COLORS = [
  'oklch(0.72 0.19 155)',
  'oklch(0.78 0.15 140)',
  'oklch(0.82 0.12 130)',
  'oklch(0.85 0.18 100)',
  'oklch(0.75 0.16 160)',
  'oklch(0.70 0.20 150)',
];

export function TapGame({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useShopStore();
  const [tapState, setTapState] = useState<TapState>({ taps: 0, bonus: 0, maxDaily: 100, canEarn: true, claimed: false });
  const [isTapping, setIsTapping] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [floatingNumbers, setFloatingNumbers] = useState<FloatingNumber[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const particleId = useRef(0);
  const floatId = useRef(0);
  const lastSendTime = useRef(0);

  // Fetch today's tap state
  const fetchTapState = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/tap-bonus?userId=${user.id}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setTapState(data);
        if (data.bonus >= data.maxDaily) {
          setIsComplete(true);
        }
      }
    } catch (err) {
      console.error('Error fetching tap state:', err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (open) {
      fetchTapState();
    }
  }, [open, fetchTapState]);

  // Claim remaining bonus when dialog closes
  const handleClose = useCallback((newOpen: boolean) => {
    if (!newOpen && user?.id && tapState.bonus > 0 && !tapState.claimed) {
      // Fire and forget claim
      fetch('/api/tap-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, claim: true }),
      }).catch(() => {});
    }
    setIsComplete(false);
    onOpenChange(newOpen);
  }, [user?.id, tapState.bonus, tapState.claimed, onOpenChange]);

  // Clean up old particles
  useEffect(() => {
    if (particles.length > 0) {
      const timer = setTimeout(() => {
        setParticles(prev => prev.slice(-20));
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [particles]);

  // Clean up old floating numbers
  useEffect(() => {
    if (floatingNumbers.length > 0) {
      const timer = setTimeout(() => {
        setFloatingNumbers(prev => prev.slice(-5));
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [floatingNumbers]);

  const spawnParticles = useCallback((coinRect: DOMRect) => {
    const count = 3 + Math.floor(Math.random() * 3); // 3-5 particles per tap (smaller count = longer game feel)
    const newParticles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
      const distance = 100 + Math.random() * 140; // 100-240px spread (much bigger)
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - 40; // bias upward

      newParticles.push({
        id: particleId.current++,
        x: coinRect.width / 2,
        y: coinRect.height / 2,
        tx,
        ty,
        size: 8 + Math.random() * 10, // 8-18px particles (much bigger)
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
        delay: Math.random() * 0.05,
      });
    }

    setParticles(prev => [...prev.slice(-20), ...newParticles]);
  }, []);

  const spawnFloatingNumber = useCallback((value: number, coinRect: DOMRect) => {
    const newFloat: FloatingNumber = {
      id: floatId.current++,
      x: coinRect.width / 2 + (Math.random() - 0.5) * 60,
      y: coinRect.height * 0.1,
      value,
    };
    setFloatingNumbers(prev => [...prev.slice(-5), newFloat]);
  }, []);

  const handleTap = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    if (!user?.id || isSending) return;

    e.preventDefault();

    // Always show animation (even after limit)
    setIsTapping(true);

    const coinEl = e.currentTarget as HTMLElement;
    const rect = coinEl.getBoundingClientRect();
    spawnParticles(rect);

    // Show +1 only if still earning
    if (tapState.canEarn) {
      spawnFloatingNumber(1, rect);
    }

    // Throttle API calls: max 1 per 100ms
    const now = Date.now();
    const timeSinceLastSend = now - lastSendTime.current;

    if (timeSinceLastSend >= 100) {
      lastSendTime.current = now;
      setIsSending(true);

      // Optimistic update
      if (tapState.canEarn) {
        const newBonus = Math.min(tapState.bonus + 1, tapState.maxDaily);
        setTapState(prev => ({
          ...prev,
          taps: prev.taps + 1,
          bonus: newBonus,
          canEarn: newBonus < prev.maxDaily,
        }));
        if (newBonus >= tapState.maxDaily) {
          setIsComplete(true);
        }
      } else {
        setTapState(prev => ({
          ...prev,
          taps: prev.taps + 1,
        }));
      }

      try {
        const res = await fetch('/api/tap-bonus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });

        if (res.ok) {
          const data = await res.json();
          setTapState(data);
          if (!data.canEarn) {
            setIsComplete(true);
          }
        }
      } catch (err) {
        console.error('Error sending tap:', err);
        fetchTapState();
      } finally {
        setIsSending(false);
      }
    } else {
      // Just optimistic local update for fast tapping
      if (tapState.canEarn) {
        const newBonus = Math.min(tapState.bonus + 1, tapState.maxDaily);
        setTapState(prev => ({
          ...prev,
          taps: prev.taps + 1,
          bonus: newBonus,
          canEarn: newBonus < prev.maxDaily,
        }));
        if (newBonus >= tapState.maxDaily) {
          setIsComplete(true);
        }
      } else {
        setTapState(prev => ({
          ...prev,
          taps: prev.taps + 1,
        }));
      }
    }

    setTimeout(() => setIsTapping(false), 100);
  }, [user?.id, tapState, isSending, spawnParticles, spawnFloatingNumber, fetchTapState]);

  const progressPercent = Math.min(100, (tapState.bonus / tapState.maxDaily) * 100);
  const isAlmostDone = progressPercent >= 80 && !isComplete;
  const streak = Math.floor(tapState.taps / 50);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border-0 bg-gradient-to-b from-emerald-50 via-green-50 to-background dark:from-emerald-950/50 dark:via-green-950/30 dark:to-background sm:rounded-2xl rounded-2xl">
        {/* Header */}
        <div className="relative p-4 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand/10 dark:bg-brand/20 flex items-center justify-center">
                <Coins className="w-4 h-4 text-brand" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Тап-игра</h3>
                <p className="text-[11px] text-muted-foreground">
                  {isComplete ? 'Лимит исчерпан!' : `Лимит: ${tapState.bonus}/${tapState.maxDaily}`}
                </p>
              </div>
            </div>
            {tapState.taps > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>{tapState.taps} тапов</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Бонусы сегодня</span>
              <span className={isComplete ? 'text-brand font-bold' : 'font-medium'}>
                {tapState.bonus} / {tapState.maxDaily}
              </span>
            </div>
            <div className="h-2.5 bg-muted/80 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: isComplete
                    ? 'linear-gradient(90deg, oklch(0.72 0.19 155), oklch(0.78 0.15 140))'
                    : isAlmostDone
                      ? 'linear-gradient(90deg, oklch(0.78 0.15 140), oklch(0.85 0.18 100))'
                      : 'linear-gradient(90deg, oklch(0.72 0.19 155), oklch(0.78 0.15 140))',
                }}
              />
            </div>
          </div>

          {/* Streak indicator */}
          {streak > 0 && (
            <div className="flex items-center gap-1 mt-2 text-[11px] text-amber-600 dark:text-amber-400">
              <Flame className="w-3 h-3" />
              <span>Стрик: {streak}×50 тапов</span>
            </div>
          )}
        </div>

        {/* Coin area */}
        <div className="relative flex flex-col items-center justify-center py-8 px-4 select-none overflow-visible">
          {/* Glow background */}
          <div
            className="absolute w-56 h-56 rounded-full opacity-40 blur-2xl"
            style={{
              background: 'radial-gradient(circle, oklch(0.72 0.19 155), transparent 70%)',
              animation: isComplete ? 'none' : 'coin-glow 3s ease-in-out infinite',
            }}
          />

          {/* Coin */}
          <button
            onClick={handleTap}
            onTouchStart={(e) => e.stopPropagation()}
            className={`
              relative z-10 w-48 h-48 rounded-full flex items-center justify-center
              cursor-pointer transition-transform duration-100
              focus:outline-none active:outline-none
              ${!isComplete ? 'hover:scale-[1.02] active:scale-95' : 'active:scale-95'}
              ${isComplete ? 'opacity-50' : ''}
              ${isTapping && !isComplete ? 'animate-[coin-tap_0.1s_ease-out]' : 'animate-[coin-idle_2.5s_ease-in-out_infinite]'}
            `}
            style={{
              background: isComplete
                ? 'linear-gradient(135deg, oklch(0.60 0.10 155), oklch(0.65 0.12 155))'
                : 'linear-gradient(135deg, oklch(0.72 0.19 155), oklch(0.82 0.15 140))',
              boxShadow: isComplete
                ? '0 8px 32px oklch(0.72 0.19 155 / 0.15), inset 0 -4px 8px oklch(0 0 0 / 0.1), inset 0 4px 8px oklch(1 0 0 / 0.2)'
                : '0 16px 48px oklch(0.72 0.19 155 / 0.4), inset 0 -4px 8px oklch(0 0 0 / 0.1), inset 0 4px 8px oklch(1 0 0 / 0.3)',
              animation: isComplete
                ? 'celebrate 0.6s ease-out'
                : isTapping
                  ? 'coin-tap 0.1s ease-out'
                  : 'coin-idle 2.5s ease-in-out infinite, coin-glow 3s ease-in-out infinite',
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
            }}
          >
            {/* Inner circle */}
            <div
              className="absolute w-40 h-40 rounded-full"
              style={{
                background: isComplete
                  ? 'linear-gradient(135deg, oklch(0.60 0.10 155), oklch(0.65 0.12 155))'
                  : 'linear-gradient(135deg, oklch(0.78 0.16 145), oklch(0.72 0.19 155))',
                boxShadow: 'inset 0 2px 4px oklch(1 0 0 / 0.2), inset 0 -2px 4px oklch(0 0 0 / 0.1)',
              }}
            />

            {/* Coin icon */}
            <div className="relative z-10 flex flex-col items-center gap-0.5">
              {isComplete ? (
                <PartyPopper className="w-14 h-14 text-white drop-shadow-lg" />
              ) : (
                <Coins className="w-14 h-14 text-white drop-shadow-lg" />
              )}
              <span className="text-white font-black text-3xl drop-shadow-md mt-0.5">
                {tapState.bonus}
              </span>
              <span className="text-white/70 text-xs font-medium -mt-0.5">
                {isComplete ? 'из 100!' : 'из 100'}
              </span>
            </div>

            {/* Shine effect */}
            <div
              className="absolute top-3 left-8 w-20 h-10 rounded-full opacity-40"
              style={{
                background: 'linear-gradient(135deg, oklch(1 0 0), transparent)',
                transform: 'rotate(-20deg)',
              }}
            />

            {/* Particles — rendered outside coin for wider spread */}
            {particles.map(p => (
              <div
                key={p.id}
                className="absolute rounded-full pointer-events-none z-30"
                style={{
                  width: p.size,
                  height: p.size,
                  left: `calc(50% + ${p.x - p.size / 2}px)`,
                  top: `calc(50% + ${p.y - p.size / 2}px)`,
                  background: p.color,
                  boxShadow: `0 0 ${p.size / 2}px ${p.color}`,
                  '--tx': `${p.tx}px`,
                  '--ty': `${p.ty}px`,
                  animationDelay: `${p.delay}s`,
                  animation: 'particle-fly 0.8s ease-out forwards',
                } as React.CSSProperties}
              />
            ))}

            {/* Floating numbers */}
            {floatingNumbers.map(f => (
              <div
                key={f.id}
                className="absolute pointer-events-none z-40"
                style={{
                  left: `calc(50% + ${f.x - 20}px)`,
                  top: `calc(${f.y}px)`,
                  animation: 'particle-number 1s ease-out forwards',
                }}
              >
                <span className="text-brand font-black text-2xl drop-shadow-lg">
                  +{f.value}
                </span>
              </div>
            ))}
          </button>
        </div>

        {/* Bottom info */}
        <div className="px-4 pb-4">
          {isComplete ? (
            <div className="text-center">
              <p className="text-sm font-semibold text-brand mb-1">Лимит на сегодня! 🎉</p>
              <p className="text-xs text-muted-foreground">
                {tapState.claimed
                  ? `${tapState.bonus} баллов начислено. Приходите завтра!`
                  : 'Приходите завтра, чтобы снова тапать и получать бонусы'}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Тапай монету —{' '}
                <span className="font-semibold text-foreground">1 монета = 1 бонус</span>
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                До {tapState.maxDaily} бонусов в день • Тапай сколько угодно!
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
