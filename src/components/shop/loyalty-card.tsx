'use client';

import { useState, useEffect } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Gift,
  History,
  Sparkles,
  Crown,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoyaltyTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  balance: number;
  createdAt: string;
}

interface LoyaltyInfo {
  user: {
    loyaltyPoints: number;
    totalSpent: number;
    ordersCount: number;
    level: string;
    multiplier: number;
    nextLevel: string | null;
    nextThreshold: number | null;
    progress: number;
  };
  settings: {
    pointsPerRub: number;
    pointsToRub: number;
    maxPointsPayment: number;
  };
  transactions: LoyaltyTransaction[];
}

const levelConfig: Record<string, { label: string; icon: typeof Gift; color: string; bgColor: string }> = {
  bronze: { label: 'Бронза', icon: Award, color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  silver: { label: 'Серебро', icon: Award, color: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-800' },
  gold: { label: 'Золото', icon: Crown, color: 'text-yellow-500', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30' },
  platinum: { label: 'Платина', icon: Sparkles, color: 'text-purple-500', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
};

const typeLabels: Record<string, string> = {
  earn: 'Начисление за заказ',
  spend: 'Списание',
  refund: 'Возврат',
  bonus: 'Бонус',
  birthday: 'День рождения 🎂',
  welcome: 'Приветственные баллы 🎉',
};

export function LoyaltyCard() {
  const { user } = useShopStore();
  const [loyaltyInfo, setLoyaltyInfo] = useState<LoyaltyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchLoyaltyInfo();
    }
  }, [user?.id]);

  // Refresh data when history dialog opens
  useEffect(() => {
    if (historyOpen && user?.id) {
      fetchLoyaltyInfo();
    }
  }, [historyOpen, user?.id]);

  const fetchLoyaltyInfo = async () => {
    if (!user?.id) return;
    
    try {
      const res = await fetch(`/api/loyalty?userId=${user.id}`, { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const data = await res.json();
      // Only set loyaltyInfo if the response contains the user property
      if (res.ok && data.user) {
        setLoyaltyInfo(data);
      } else {
        console.error('Error fetching loyalty info:', data.error);
        setLoyaltyInfo(null);
      }
    } catch (error) {
      console.error('Error fetching loyalty info:', error);
      setLoyaltyInfo(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-8 bg-muted rounded w-1/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!loyaltyInfo || !loyaltyInfo.user) return null;

  const { user: loyaltyUser, settings, transactions } = loyaltyInfo;
  const level = levelConfig[loyaltyUser.level] || levelConfig.bronze;
  const LevelIcon = level.icon;

  const pointsValue = Math.floor(loyaltyUser.loyaltyPoints * settings.pointsToRub);

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Header with level */}
          <div className={cn('relative p-4 overflow-hidden', level.bgColor)}>
            {/* Shimmer overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3s_infinite] pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <LevelIcon className={cn('h-5 w-5', level.color)} />
                <span className={cn('font-semibold', level.color)}>{level.label}</span>
                {loyaltyUser.multiplier > 1 && (
                  <Badge variant="secondary" className="text-xs">
                    ×{loyaltyUser.multiplier} бонусов
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="h-4 w-4 mr-1" />
                История
              </Button>
            </div>

            {/* Points */}
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{loyaltyUser.loyaltyPoints.toLocaleString('ru-RU')}</span>
              <span className="text-sm text-muted-foreground">баллов</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              = {pointsValue.toLocaleString('ru-RU')} ₽ для оплаты
            </p>
          </div>

          {/* Progress to next level */}
          {loyaltyUser.nextLevel && (
            <div className="p-4 border-b">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">До {levelConfig[loyaltyUser.nextLevel]?.label}</span>
                <span className="font-medium">
                  {loyaltyUser.nextThreshold && (loyaltyUser.nextThreshold - loyaltyUser.totalSpent).toLocaleString('ru-RU')} ₽
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all rounded-full',
                    loyaltyUser.level === 'bronze' && 'bg-amber-500',
                    loyaltyUser.level === 'silver' && 'bg-gray-400',
                    loyaltyUser.level === 'gold' && 'bg-yellow-500',
                    loyaltyUser.level === 'platinum' && 'bg-purple-500',
                    !['bronze','silver','gold','platinum'].includes(loyaltyUser.level) && 'bg-primary'
                  )}
                  style={{ width: `${Math.min(100, loyaltyUser.progress)}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="p-4 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xl font-bold">{loyaltyUser.ordersCount}</p>
              <p className="text-xs text-muted-foreground">Заказов</p>
            </div>
            <div>
              <p className="text-xl font-bold">{loyaltyUser.totalSpent.toLocaleString('ru-RU')}</p>
              <p className="text-xs text-muted-foreground">Потрачено ₽</p>
            </div>
          </div>

          <Separator />

          {/* How it works */}
          <div className="p-4">
            <p className="text-sm font-medium mb-2">Как это работает:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="text-brand">• За каждый потраченный рубль — 1 балл</li>
              <li className="text-brand">• Чем выше уровень, тем больше бонусов</li>
              <li className="text-brand">• Баллами можно оплатить до {settings.maxPointsPayment}% заказа</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              История баллов
            </DialogTitle>
          </DialogHeader>

          {transactions.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>История пуста</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-xl">
                  <div>
                    <p className="font-medium text-sm">{typeLabels[tx.type] || tx.type}</p>
                    <p className="text-xs text-muted-foreground">{tx.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(tx.createdAt).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      'font-bold',
                      tx.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    )}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </p>
                    <p className="text-xs text-muted-foreground">Баланс: {tx.balance}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
