'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  CreditCard,
  Copy,
  CheckCircle2,
  User,
  Building,
  Phone,
  Info,
  AlertTriangle
} from 'lucide-react';

interface CardTransferPaymentProps {
  orderNumber: string;
  amount: number;
  cardNumber: string;
  holderName?: string;
  bankName?: string;
  phone?: string;
  onConfirm: () => void;
}

export function CardTransferPayment({ 
  orderNumber, 
  amount, 
  cardNumber,
  holderName,
  bankName,
  phone,
  onConfirm 
}: CardTransferPaymentProps) {
  const [copied, setCopied] = useState<'card' | 'amount' | null>(null);

  const formatAmount = (val: number) => {
    return val.toLocaleString('ru-RU') + ' ₽';
  };

  const formatCardNumber = (card: string) => {
    // Format: 1234 5678 9012 3456
    const cleaned = card.replace(/\D/g, '');
    return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const copyToClipboard = async (text: string, type: 'card' | 'amount') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Mask card number for display (show first 6 and last 4)
  const displayCardNumber = (card: string) => {
    const cleaned = card.replace(/\D/g, '');
    if (cleaned.length >= 10) {
      return `${cleaned.slice(0, 6)}****${cleaned.slice(-4)}`;
    }
    return formatCardNumber(card);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Перевод на карту</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Переведите сумму на банковскую карту
        </p>
      </div>

      {/* Card number */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Номер карты:
        </label>
        <div className="flex gap-2">
          <Input
            value={formatCardNumber(cardNumber)}
            readOnly
            className="font-mono text-lg tracking-wider"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(cardNumber.replace(/\D/g, ''), 'card')}
          >
            {copied === 'card' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Card holder */}
      {holderName && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Получатель</p>
            <p className="font-medium">{holderName}</p>
          </div>
        </div>
      )}

      {/* Bank name */}
      {bankName && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
          <Building className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Банк</p>
            <p className="font-medium">{bankName}</p>
          </div>
        </div>
      )}

      {/* Phone for SBP (if available) */}
      {phone && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Телефон для перевода</p>
            <p className="font-medium">{phone}</p>
          </div>
        </div>
      )}

      {/* Amount */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground flex items-center gap-2">
          💰 Сумма к переводу:
        </label>
        <div className="flex gap-2">
          <Input
            value={formatAmount(amount)}
            readOnly
            className="font-mono text-lg font-bold"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(amount.toString(), 'amount')}
          >
            {copied === 'amount' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Purpose */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground flex items-center gap-2">
          📝 Назначение:
        </label>
        <Input
          value={`Заказ #${orderNumber}`}
          readOnly
          className="font-mono"
        />
      </div>

      {/* Instructions */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Инструкция:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Скопируйте номер карты</li>
                <li>Откройте приложение банка</li>
                <li>Сделайте перевод на карту</li>
                <li>Нажмите "Я оплатил"</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning */}
      <Card className="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-yellow-700 dark:text-yellow-400">Важно:</p>
              <ul className="list-disc list-inside text-yellow-600 dark:text-yellow-300 space-y-0.5">
                <li>Переводите точную сумму</li>
                <li>Банк может взимать комиссию</li>
                <li>После оплаты нажмите "Я оплатил"</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirm button */}
      <Button 
        className="w-full" 
        size="lg"
        onClick={onConfirm}
      >
        <CheckCircle2 className="h-4 w-4 mr-2" />
        Я оплатил
      </Button>

      {/* No card configured */}
      {!cardNumber && (
        <div className="text-center text-sm text-muted-foreground p-4 bg-muted/30 rounded-xl">
          Перевод на карту временно недоступен.
          <br />
          Выберите другой способ оплаты.
        </div>
      )}
    </div>
  );
}
