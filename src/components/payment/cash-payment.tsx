'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Banknote,
  CheckCircle2,
  Info,
  MapPin,
  Clock,
  Phone
} from 'lucide-react';

interface CashPaymentProps {
  orderNumber: string;
  amount: number;
  instructions?: string;
  deliveryAddress?: string;
  contactPhone?: string;
  onConfirm: () => void;
}

export function CashPayment({ 
  orderNumber, 
  amount, 
  instructions,
  deliveryAddress,
  contactPhone,
  onConfirm 
}: CashPaymentProps) {
  const [confirmed, setConfirmed] = useState(false);

  const formatAmount = (val: number) => {
    return val.toLocaleString('ru-RU') + ' ₽';
  };

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirm();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Banknote className="h-6 w-6 text-green-500" />
          <span className="text-lg font-semibold">Оплата при встрече</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Оплатите наличными или картой при получении
        </p>
      </div>

      {/* Amount */}
      <div className="text-center py-4 bg-muted/30 rounded-xl">
        <p className="text-sm text-muted-foreground">К оплате при получении:</p>
        <p className="text-3xl font-bold text-green-600">{formatAmount(amount)}</p>
      </div>

      {/* Delivery info */}
      {deliveryAddress && (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Адрес доставки</p>
                <p className="text-sm text-muted-foreground">{deliveryAddress}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact phone */}
      {contactPhone && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
          <Phone className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Телефон для связи</p>
            <p className="font-medium">{contactPhone}</p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="text-sm space-y-2">
              <p className="font-medium text-blue-700 dark:text-blue-400">Как это работает:</p>
              <ol className="list-decimal list-inside text-blue-600 dark:text-blue-300 space-y-1">
                <li>Курьер свяжется с вами перед доставкой</li>
                <li>Подготовьте точную сумму или карту</li>
                <li>Оплатите заказ при получении</li>
              </ol>
              {instructions && (
                <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-800">
                  <p className="text-blue-600 dark:text-blue-300">{instructions}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time info */}
      <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl text-sm">
        <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <span className="text-yellow-700 dark:text-yellow-400">
          Доставка обычно занимает 1-3 дня
        </span>
      </div>

      {/* Confirm button */}
      <Button 
        className="w-full bg-green-600 hover:bg-green-700" 
        size="lg"
        onClick={handleConfirm}
        disabled={confirmed}
      >
        {confirmed ? (
          <>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Подтверждено
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Подтвердить заказ
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Заказ будет сформирован и передан в доставку
      </p>
    </div>
  );
}
