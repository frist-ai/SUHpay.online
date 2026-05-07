'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Smartphone, 
  Copy, 
  CheckCircle2, 
  Phone, 
  Building,
  Info,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPhone, sbpBanks } from '@/lib/payment-config';

// Import QRCode with no SSR to avoid issues
import dynamic from 'next/dynamic';
const QRCode = dynamic(() => import('react-qr-code').then(mod => mod.default), { ssr: false });

// Check if mobile device
const isMobileDevice = () => {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

interface SBPPaymentProps {
  orderNumber: string;
  amount: number;
  phone: string;
  bankName?: string;
  bankId?: string;
  onConfirm: () => void;
  onContactSupport?: () => void;
}

export function SBPPayment({ 
  orderNumber, 
  amount, 
  phone, 
  bankName,
  bankId,
  onConfirm,
  onContactSupport 
}: SBPPaymentProps) {
  const [copied, setCopied] = useState<'phone' | 'amount' | null>(null);
  const [isMobile] = useState(isMobileDevice);

  const formatAmount = (val: number) => {
    return val.toLocaleString('ru-RU') + ' ₽';
  };

  const copyToClipboard = async (text: string, type: 'phone' | 'amount') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Generate SBP QR data
  const qrData = bankId && phone 
    ? `https://qr.nspk.ru/${bankId}?receiver=${phone.replace(/\D/g, '')}&sum=${Math.round(amount * 100)}&n=01&order=${orderNumber}`
    : '';

  // Find bank for deep link
  const bank = sbpBanks.find(b => b.id === bankName?.toLowerCase() || b.name === bankName);
  
  // Deep link for mobile banking
  const getBankDeepLink = () => {
    if (!bank) return null;
    const cleanPhone = phone.replace(/\D/g, '');
    // Different banks have different deep link formats
    return `https://qr.nspk.ru/${bank.bankId}?receiver=${cleanPhone}&sum=${Math.round(amount * 100)}`;
  };

  return (
    <div className="space-y-4">
      {/* QR Code */}
      {qrData && (
        <div className="flex flex-col items-center p-4 bg-white rounded-xl">
          <QRCode
            value={qrData}
            size={200}
            level="M"
            className="rounded"
          />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Отсканируйте в приложении банка
          </p>
        </div>
      )}

      {/* Divider */}
      {qrData && (
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">или</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* Phone number */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Номер для перевода:
        </label>
        <div className="flex gap-2">
          <Input
            value={formatPhone(phone)}
            readOnly
            className="font-mono text-lg"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(phone.replace(/\D/g, ''), 'phone')}
          >
            {copied === 'phone' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground flex items-center gap-2">
          💰 Сумма:
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

      {/* Order number */}
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

      {/* Bank info */}
      {bankName && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-xl">
          <Building className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Банк: {bankName}</span>
        </div>
      )}

      {/* Instructions */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Инструкция:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Откройте приложение банка</li>
                <li>Отсканируйте QR или введите номер</li>
                <li>Проверьте сумму и подтвердите</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-2">
        <Button 
          className="w-full" 
          size="lg"
          onClick={onConfirm}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Я оплатил
        </Button>

        {/* Mobile: Open in bank app */}
        {isMobile && bank && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              const link = getBankDeepLink();
              if (link) window.open(link, '_blank');
            }}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Открыть в {bank.name}
          </Button>
        )}

        {onContactSupport && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={onContactSupport}
          >
            📞 Связаться с поддержкой
          </Button>
        )}
      </div>
    </div>
  );
}
