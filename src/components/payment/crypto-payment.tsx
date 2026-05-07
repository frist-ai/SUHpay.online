'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Copy, 
  CheckCircle2, 
  AlertTriangle,
  Info,
  ExternalLink
} from 'lucide-react';
import { calculateCryptoAmount } from '@/lib/payment-config';

// Import QRCode with no SSR to avoid issues
import dynamic from 'next/dynamic';
const QRCode = dynamic(() => import('react-qr-code').then(mod => mod.default), { ssr: false });

interface CryptoPaymentProps {
  orderNumber: string;
  amount: number;
  network: 'TRC-20' | 'ERC-20' | 'BSC' | null;
  walletAddress: string;
  usdtRate?: number;
  networkFee?: number;
  onConfirm: () => void;
}

const networkInfo = {
  'TRC-20': {
    name: 'TRC-20 (Tron)',
    currency: 'USDT',
    explorer: 'https://tronscan.org/#/transaction/',
  },
  'ERC-20': {
    name: 'ERC-20 (Ethereum)',
    currency: 'USDT',
    explorer: 'https://etherscan.io/tx/',
  },
  'BSC': {
    name: 'BSC (Binance Smart Chain)',
    currency: 'USDT',
    explorer: 'https://bscscan.com/tx/',
  },
};

export function CryptoPayment({ 
  orderNumber, 
  amount, 
  network,
  walletAddress,
  usdtRate = 95,
  networkFee = 0,
  onConfirm 
}: CryptoPaymentProps) {
  const [copied, setCopied] = useState<'wallet' | 'amount' | null>(null);
  const [currentRate, setCurrentRate] = useState(usdtRate);

  useEffect(() => {
    // In real implementation, fetch current USDT rate
    // For now, use provided rate
    setCurrentRate(usdtRate);
  }, [usdtRate]);

  const cryptoAmount = calculateCryptoAmount(amount + networkFee, currentRate);
  const networkData = network ? networkInfo[network] : null;

  const formatRub = (val: number) => {
    return val.toLocaleString('ru-RU') + ' ₽';
  };

  const copyToClipboard = async (text: string, type: 'wallet' | 'amount') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Truncate wallet address for display
  const truncateAddress = (addr: string) => {
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  return (
    <div className="space-y-4">
      {/* Network badge */}
      {networkData && (
        <div className="flex justify-center">
          <Badge variant="outline" className="text-sm">
            ₮ USDT {networkData.name}
          </Badge>
        </div>
      )}

      {/* QR Code */}
      {walletAddress && (
        <div className="flex flex-col items-center p-4 bg-white rounded-xl">
          <QRCode
            value={walletAddress}
            size={180}
            level="M"
            className="rounded"
          />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Адрес кошелька
          </p>
        </div>
      )}

      {/* Wallet address */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          Адрес кошелька:
        </label>
        <div className="flex gap-2">
          <Input
            value={truncateAddress(walletAddress)}
            readOnly
            className="font-mono"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(walletAddress, 'wallet')}
          >
            {copied === 'wallet' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Amount in USDT */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          Сумма к оплате:
        </label>
        <div className="flex gap-2">
          <Input
            value={`${cryptoAmount.toFixed(2)} USDT`}
            readOnly
            className="font-mono font-bold text-lg"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(cryptoAmount.toFixed(2), 'amount')}
          >
            {copied === 'amount' ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          ≈ {formatRub(amount)} (курс: 1 USDT = {currentRate} ₽)
        </p>
      </div>

      {/* Network fee */}
      {networkFee > 0 && (
        <div className="text-sm text-muted-foreground p-2 bg-muted/50 rounded">
          Комиссия сети: +{formatRub(networkFee)}
        </div>
      )}

      {/* Warning */}
      <Card className="bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-yellow-700 dark:text-yellow-400">Важно:</p>
              <ul className="list-disc list-inside text-yellow-600 dark:text-yellow-300 space-y-0.5">
                <li>Отправляйте ТОЛЬКО USDT {network || 'TRC-20'}</li>
                <li>Комиссия сети за ваш счёт</li>
                <li>После оплаты нажмите "Я оплатил"</li>
              </ul>
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

        {networkData && (
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => window.open(networkData.explorer, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Проверить транзакцию
          </Button>
        )}
      </div>

      {/* No wallet configured */}
      {!walletAddress && (
        <div className="text-center text-sm text-muted-foreground p-4 bg-muted/30 rounded-xl">
          Оплата криптовалютой временно недоступна.
          <br />
          Выберите другой способ оплаты.
        </div>
      )}
    </div>
  );
}
