'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  ArrowLeft,
  CreditCard,
  Smartphone,
  Coins,
  Star,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  ShoppingBag,
  XCircle
} from 'lucide-react';
import { useShopStore } from '@/stores/shop-store';
import { 
  PaymentSettings, 
  defaultPaymentSettings,
  paymentMethodsInfo,
  PaymentMethodId 
} from '@/lib/payment-config';
import { SBPPayment } from './sbp-payment';
import { CardPayment } from './card-payment';
import { CryptoPayment } from './crypto-payment';
import { StarsPayment } from './stars-payment';
import { CashPayment } from './cash-payment';
import { CardTransferPayment } from './card-transfer-payment';
import { useToast } from '@/hooks/use-toast';
import { pluralize } from '@/lib/utils';
import { CopyableOrderNumber } from '@/components/shared/copyable-order-number';

interface PaymentViewProps {
  orderId: string;
  orderNumber: string;
  amount: number;
  discount?: number;
  deliveryCost?: number;
  subtotal?: number;
  items?: Array<{ name: string; quantity: number; price: number }>;
  onBack: () => void;
  onSuccess: () => void;
}

export function PaymentView({
  orderId,
  orderNumber,
  amount,
  discount = 0,
  deliveryCost = 0,
  subtotal = 0,
  items = [],
  onBack,
  onSuccess
}: PaymentViewProps) {
  const { toast } = useToast();
  const { user, initData } = useShopStore();
  const [settings, setSettings] = useState<PaymentSettings>(defaultPaymentSettings);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodId | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'success' | 'failed'>('pending');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/payment-settings');
      const data = await res.json();
      setSettings(data);
      
      // Auto-select first enabled method
      const enabledMethods = getEnabledMethods();
      if (enabledMethods.length > 0) {
        setSelectedMethod(enabledMethods[0]);
      }
    } catch (error) {
      console.error('Error loading payment settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEnabledMethods = (): PaymentMethodId[] => {
    const methods: PaymentMethodId[] = [];
    if (settings.card.enabled) methods.push('card');
    if (settings.sbp.enabled) methods.push('sbp');
    if (settings.crypto.enabled) methods.push('crypto');
    if (settings.stars.enabled) methods.push('stars');
    if (settings.cardTransfer.enabled) methods.push('cardTransfer');
    if (settings.cash.enabled) methods.push('cash');
    return methods;
  };

  const formatPrice = (val: number) => {
    return val.toLocaleString('ru-RU') + ' ₽';
  };

  const handleCreateTransaction = async () => {
    try {
      const res = await fetch('/api/payment-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          orderNumber,
          amount,
          paymentMethod: selectedMethod,
          cryptoAmount: selectedMethod === 'crypto' 
            ? amount / (settings.crypto.fixedRate || 95) 
            : null,
        }),
      });
      const data = await res.json();
      setTransactionId(data.id);
      return data.id;
    } catch (error) {
      console.error('Error creating transaction:', error);
      return null;
    }
  };

  const handleConfirmPayment = async () => {
    setPaymentStatus('processing');
    
    try {
      // Create transaction if not exists
      const txId = transactionId || await handleCreateTransaction();
      
      if (!txId) {
        throw new Error('Failed to create transaction');
      }

      // Update transaction as paid (in real app, this would be verified)
      await fetch('/api/payment-transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: txId,
          status: 'paid',
        }),
      });

      setPaymentStatus('success');
      toast({
        title: 'Оплата прошла успешно!',
        description: `Заказ #${orderNumber} оплачен`,
      });
      
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentStatus('failed');
      toast({
        variant: 'destructive',
        title: 'Ошибка оплаты',
        description: 'Попробуйте ещё раз или выберите другой способ',
      });
    }
  };

  const handleCardPayment = async () => {
    // In real implementation, redirect to payment gateway
    await handleCreateTransaction();
    toast({
      title: 'Перенаправление на страницу оплаты',
      description: 'Ожидайте перенаправления...',
    });
    // Simulate redirect delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    // For demo, just confirm
    await handleConfirmPayment();
  };

  const handleStarsPayment = async () => {
    // In real implementation, use Telegram Stars API
    await handleCreateTransaction();
    await handleConfirmPayment();
  };

  // Handle back button - show cancel dialog
  const handleBackClick = () => {
    setShowCancelDialog(true);
  };

  // Cancel order and return items to stock
  const handleCancelOrder = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          comment: 'Отменено пользователем при оплате',
          initData,
        }),
      });

      if (res.ok) {
        toast({
          title: 'Заказ отменён',
          description: `Заказ #${orderNumber} был отменён`,
        });
        onBack();
      } else {
        throw new Error('Failed to cancel order');
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось отменить заказ',
      });
    } finally {
      setCancelling(false);
      setShowCancelDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Success state
  if (paymentStatus === 'success') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
        </div>
        <h2 className="text-xl font-bold mb-2">Оплата прошла успешно!</h2>
        <p className="text-muted-foreground mb-2">
          Заказ <CopyableOrderNumber orderNumber={orderNumber} size="md" />
        </p>
        <p className="text-sm text-muted-foreground">
          Сумма: {formatPrice(amount)}
        </p>
      </div>
    );
  }

  const enabledMethods = getEnabledMethods();

  // No payment methods enabled
  if (enabledMethods.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 bg-background/95 backdrop-blur border-b p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">Оплата</h1>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-bold mb-2">Оплата недоступна</h2>
          <p className="text-muted-foreground">
            Способы оплаты не настроены.
            <br />
            Обратитесь в поддержку.
          </p>
        </div>
      </div>
    );
  }

  const methodIcons: Record<PaymentMethodId, React.ReactNode> = {
    card: <CreditCard className="h-4 w-4" />,
    sbp: <Smartphone className="h-4 w-4" />,
    crypto: <Coins className="h-4 w-4" />,
    stars: <Star className="h-4 w-4" />,
    cardTransfer: <CreditCard className="h-4 w-4" />,
    cash: <ShoppingBag className="h-4 w-4" />,
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Cancel Order Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Отменить заказ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите отменить заказ #{orderNumber}? 
              Товары будут возвращены на склад.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>
              Продолжить оплату
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Отмена...
                </>
              ) : (
                'Отменить заказ'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur border-b p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBackClick}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Оплата заказа</h1>
            <CopyableOrderNumber orderNumber={orderNumber} className="text-xs" />
          </div>
          <Badge variant={paymentStatus === 'pending' ? 'outline' : 'secondary'}>
            {paymentStatus === 'pending' ? (
              <>
                <Clock className="h-3 w-3 mr-1" />
                Ожидает
              </>
            ) : (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Обработка
              </>
            )}
          </Badge>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Amount block */}
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                {discount > 0 && (
                  <p className="text-sm text-muted-foreground line-through mb-1">
                    {formatPrice(subtotal + deliveryCost)}
                  </p>
                )}
                <p className="text-3xl font-bold">{formatPrice(amount)}</p>
                <p className="text-sm text-muted-foreground">К оплате</p>
              </div>
              
              {/* Order summary */}
              {items.length > 0 && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  {items.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-muted-foreground truncate max-w-[60%]">
                        {item.name} × {item.quantity}
                      </span>
                      <span>{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  {items.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      и ещё {items.length - 3} {pluralize(items.length - 3, 'товар', 'товара', 'товаров')}
                    </p>
                  )}
                  {deliveryCost > 0 && (
                    <div className="flex justify-between text-sm pt-2 border-t">
                      <span className="text-muted-foreground">Доставка</span>
                      <span>{formatPrice(deliveryCost)}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment methods tabs */}
          <Tabs 
            value={selectedMethod || undefined} 
            onValueChange={(v) => setSelectedMethod(v as PaymentMethodId)}
          >
            <TabsList className="w-full">
              {enabledMethods.map((method) => (
                <TabsTrigger key={method} value={method} className="flex-1">
                  <span className="flex items-center gap-1">
                    {methodIcons[method]}
                    <span className="hidden sm:inline ml-1">
                      {paymentMethodsInfo[method].name}
                    </span>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="mt-4">
              <TabsContent value="card">
                <Card>
                  <CardContent className="p-4">
                    <CardPayment
                      orderNumber={orderNumber}
                      amount={amount}
                      provider={settings.card.provider}
                      shopId={settings.card.shopId}
                      testMode={settings.card.testMode}
                      onPay={handleCardPayment}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sbp">
                <Card>
                  <CardContent className="p-4">
                    <SBPPayment
                      orderNumber={orderNumber}
                      amount={amount}
                      phone={settings.sbp.phone || ''}
                      bankName={settings.sbp.bankName || undefined}
                      bankId={settings.sbp.bankId || undefined}
                      onConfirm={handleConfirmPayment}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="crypto">
                <Card>
                  <CardContent className="p-4">
                    <CryptoPayment
                      orderNumber={orderNumber}
                      amount={amount}
                      network={settings.crypto.network}
                      walletAddress={settings.crypto.walletAddress || ''}
                      usdtRate={settings.crypto.fixedRate || 95}
                      networkFee={settings.crypto.networkFee}
                      onConfirm={handleConfirmPayment}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="stars">
                <Card>
                  <CardContent className="p-4">
                    <StarsPayment
                      orderNumber={orderNumber}
                      amount={amount}
                      rate={settings.stars.rate}
                      isDigital={true} // Should be determined by order items
                      onPay={handleStarsPayment}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cardTransfer">
                <Card>
                  <CardContent className="p-4">
                    <CardTransferPayment
                      orderNumber={orderNumber}
                      amount={amount}
                      cardNumber={settings.cardTransfer.cardNumber || ''}
                      holderName={settings.cardTransfer.holderName || undefined}
                      bankName={settings.cardTransfer.bankName || undefined}
                      phone={settings.cardTransfer.phone || undefined}
                      onConfirm={handleConfirmPayment}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cash">
                <Card>
                  <CardContent className="p-4">
                    <CashPayment
                      orderNumber={orderNumber}
                      amount={amount}
                      instructions={settings.cash.instructions || undefined}
                      onConfirm={handleConfirmPayment}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
