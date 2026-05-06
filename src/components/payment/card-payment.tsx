'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Shield, 
  Lock,
  ExternalLink,
  Loader2,
  Info
} from 'lucide-react';

interface CardPaymentProps {
  orderNumber: string;
  amount: number;
  provider: 'yookassa' | 'prodamus' | 'tinkoff' | null;
  shopId: string | null;
  testMode?: boolean;
  onPay: () => Promise<void>;
}

const providerInfo = {
  yookassa: {
    name: 'ЮKassa',
    logo: '💳',
    description: 'Безопасная оплата через ЮKassa',
  },
  prodamus: {
    name: 'Prodamus',
    logo: '💳',
    description: 'Оплата через Prodamus',
  },
  tinkoff: {
    name: 'Тинькофф Касса',
    logo: '💳',
    description: 'Оплата через Тинькофф',
  },
};

export function CardPayment({ 
  orderNumber, 
  amount, 
  provider,
  shopId,
  testMode = true,
  onPay 
}: CardPaymentProps) {
  const [loading, setLoading] = useState(false);

  const formatAmount = (val: number) => {
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

  const providerData = provider ? providerInfo[provider] : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Оплата банковской картой</span>
        </div>
        {providerData && (
          <p className="text-sm text-muted-foreground">
            {providerData.description}
          </p>
        )}
      </div>

      {/* Test mode badge */}
      {testMode && (
        <div className="flex justify-center">
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800">
            🧪 Тестовый режим
          </Badge>
        </div>
      )}

      {/* Security badges */}
      <div className="flex justify-center gap-4 py-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Shield className="h-4 w-4 text-green-500" />
          <span>Secure</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          <span>Visa</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          <span>MC</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CreditCard className="h-4 w-4" />
          <span>Мир</span>
        </div>
      </div>

      {/* Pay button */}
      <Button 
        className="w-full" 
        size="lg"
        onClick={handlePay}
        disabled={loading || !shopId}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Перенаправление...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 mr-2" />
            Оплатить {formatAmount(amount)}
          </>
        )}
      </Button>

      {/* Info */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              После нажатия вы будете перенаправлены на защищённую страницу оплаты.
              Мы не храним данные вашей карты.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* No provider configured */}
      {!provider && (
        <div className="text-center text-sm text-muted-foreground p-4 bg-muted/30 rounded-xl">
          Оплата картой временно недоступна.
          <br />
          Выберите другой способ оплаты.
        </div>
      )}
    </div>
  );
}
