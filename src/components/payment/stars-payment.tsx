'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Star, 
  Lock,
  Loader2,
  Info,
  AlertTriangle
} from 'lucide-react';
import { calculateStarsAmount } from '@/lib/payment-config';

interface StarsPaymentProps {
  orderNumber: string;
  amount: number;
  rate?: number;
  isDigital: boolean;
  onPay: () => Promise<void>;
}

export function StarsPayment({ 
  orderNumber, 
  amount, 
  rate = 0.5,
  isDigital,
  onPay 
}: StarsPaymentProps) {
  const [loading, setLoading] = useState(false);

  const starsAmount = calculateStarsAmount(amount, rate);
  const formatRub = (val: number) => {
    return val.toLocaleString('ru-RU') + ' ₽';
  };

  const handlePay = async () => {
    setLoading(true);
    try {
      await onPay();
    } finally {
      setLoading(false);
    }
  };

  // Stars only available for digital goods
  if (!isDigital) {
    return (
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Star className="h-6 w-6 text-yellow-500" />
            <span className="text-lg font-semibold">Telegram Stars</span>
          </div>
        </div>

        <Card className="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-yellow-700 dark:text-yellow-400">Внимание:</p>
                <p className="text-yellow-600 dark:text-yellow-300">
                  Telegram Stars доступны только для цифровых товаров и услуг.
                </p>
                <p className="text-yellow-600 dark:text-yellow-300">
                  Выберите другой способ оплаты.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
          <span className="text-lg font-semibold">Оплата Telegram Stars</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Быстрая оплата внутри Telegram
        </p>
      </div>

      {/* Stars amount */}
      <div className="text-center py-4">
        <div className="text-4xl font-bold flex items-center justify-center gap-2">
          <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
          {starsAmount.toLocaleString('ru-RU')}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          ≈ {formatRub(amount)} (курс: 1 ⭐ = {rate} ₽)
        </p>
      </div>

      {/* Digital only badge */}
      <div className="flex justify-center">
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          Только для цифровых товаров
        </Badge>
      </div>

      {/* Pay button */}
      <Button 
        className="w-full bg-yellow-500 hover:bg-yellow-600 text-black" 
        size="lg"
        onClick={handlePay}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Обработка...
          </>
        ) : (
          <>
            <Star className="h-4 w-4 mr-2" />
            Оплатить {starsAmount.toLocaleString('ru-RU')} звёзд
          </>
        )}
      </Button>

      {/* Info */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p>Оплата производится через Telegram Stars.</p>
              <p className="mt-1">Звёзды можно приобрести внутри Telegram.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
