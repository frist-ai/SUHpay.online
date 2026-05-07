'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useShopStore } from '@/stores/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft,
  MapPin,
  Truck,
  CreditCard,
  Smartphone,
  Coins,
  CheckCircle2,
  Loader2,
  Gift,
  XCircle,
  Tag,
  Home,
  Briefcase,
  Star,
  Store,
  Banknote,
  Package,
  User,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  Shield,
  Clock,
  Copy,
  MessageSquare
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDeliverySettings } from '@/hooks/use-delivery-settings';
import { PaymentSettings, defaultPaymentSettings, paymentMethodsInfo, PaymentMethodId, formatPhone } from '@/lib/payment-config';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { pluralize, formatPrice } from '@/lib/utils';
import { CopyableOrderNumber } from '@/components/shared/copyable-order-number';
import { validatePhone, normalizePhone, validateAddress } from '@/lib/validation';

interface SavedAddress {
  id: string;
  label: string | null;
  city: string;
  street: string;
  house: string;
  apartment: string | null;
  postalCode: string | null;
  entrance: string | null;
  floor: string | null;
  comment: string | null;
  isDefault: boolean;
}

const STEPS = [
  { id: 1, title: 'Доставка', icon: Truck },
  { id: 2, title: 'Контакты', icon: User },
  { id: 3, title: 'Оплата', icon: CreditCard },
  { id: 4, title: 'Готово', icon: CheckCircle2 },
];

export function CheckoutView() {
  const { 
    cart, 
    cartTotal, 
    user, 
    initData,
    setCurrentView, 
    clearCart,
    appliedPromo,
    setAppliedPromo,
    discount,
    checkoutStep,
    setCheckoutStep,
    goBack,
    canGoBack,
    cartDeliveryMethod: storeDeliveryMethod,
  } = useShopStore();
  
  const { toast } = useToast();
  const { settings: deliverySettings, getDeliveryCost, getAvailableDeliveryMethods, getActiveDeliverySlots } = useDeliverySettings();
  const deliveryMethods = getAvailableDeliveryMethods();
  const deliverySlots = getActiveDeliverySlots();
  
  const [loading, setLoading] = useState(false);
  const [promocode, setPromocode] = useState('');
  const [validating, setValidating] = useState(false);
  const [promoExpanded, setPromoExpanded] = useState(!!appliedPromo);
  const handleApplyCheckoutPromo = async () => {
    if (!promocode.trim()) return;
    setValidating(true);
    try {
      const res = await fetch('/api/promocodes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promocode.trim(), subtotal: cartTotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedPromo({
          code: data.promocode.code,
          discountType: data.promocode.discountType,
          discountValue: data.promocode.discountValue,
          discountAmount: data.discountAmount,
          message: data.message,
        });
        setPromocode('');
        toast({ title: 'Промокод применён!', description: data.message });
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось проверить промокод', variant: 'destructive' });
    } finally {
      setValidating(false);
    }
  };
  const [dataLoading, setDataLoading] = useState(true);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderDeliveryMethod, setOrderDeliveryMethod] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'success' | 'failed' | 'pending_confirmation' | 'cancelled'>('pending');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(defaultPaymentSettings);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodId | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showFullOrder, setShowFullOrder] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    deliveryMethod: storeDeliveryMethod || 'courier',
    paymentMethod: 'card',
    city: '',
    street: '',
    house: '',
    apartment: '',
    entrance: '',
    floor: '',
    comment: '',
    customerComment: '',
    name: user?.firstName || '',
    phone: user?.phone || '',
  });

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Защита от двойного создания заказа — useRef для синхронной блокировки
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Idempotency key — unique per component mount, sent with order creation
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  // Fetch saved addresses and payment settings
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!user?.id || user.id === 'demo-user') return;
      
      try {
        const res = await fetch(`/api/addresses?userId=${user.id}`);
        const addresses = await res.json();
        setSavedAddresses(addresses || []);
        
        const defaultAddress = addresses?.find((a: SavedAddress) => a.isDefault);
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
          fillAddressForm(defaultAddress);
        }
      } catch (error) {
        console.error('Error fetching addresses:', error);
      }
    };

    const fetchPaymentSettings = async () => {
      try {
        const res = await fetch('/api/payment-settings');
        const data = await res.json();
        setPaymentSettings(data);
        
        // Set first enabled method as default
        const enabledMethods = getEnabledPaymentMethods(data);
        if (enabledMethods.length > 0) {
          setSelectedPaymentMethod(enabledMethods[0]);
          setFormData(prev => ({ ...prev, paymentMethod: enabledMethods[0] }));
        }
      } catch (error) {
        console.error('Error fetching payment settings:', error);
      }
    };

    Promise.all([fetchAddresses(), fetchPaymentSettings()]).finally(() => {
      setDataLoading(false);
    });
  }, [user?.id]);

  // Update form data when user data becomes available
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || user.firstName || '',
        phone: prev.phone || user.phone || '',
      }));
    }
  }, [user?.firstName, user?.phone]);

  const getEnabledPaymentMethods = (settings: PaymentSettings): PaymentMethodId[] => {
    const methods: PaymentMethodId[] = [];
    if (settings.card.enabled) methods.push('card');
    if (settings.sbp.enabled) methods.push('sbp');
    if (settings.crypto.enabled) methods.push('crypto');
    if (settings.stars.enabled) methods.push('stars');
    if (settings.cardTransfer.enabled) methods.push('cardTransfer');
    if (settings.cash.enabled) methods.push('cash');
    return methods;
  };

  const fillAddressForm = (address: SavedAddress) => {
    setFormData(prev => ({
      ...prev,
      city: address.city,
      street: address.street,
      house: address.house,
      apartment: address.apartment || '',
      entrance: address.entrance || '',
      floor: address.floor || '',
      comment: address.comment || '',
    }));
  };

  const handleSelectAddress = (address: SavedAddress) => {
    setSelectedAddressId(address.id);
    fillAddressForm(address);
    setValidationErrors({});
  };

  const clearAddressForm = () => {
    setSelectedAddressId(null);
    setFormData(prev => ({
      ...prev,
      city: '',
      street: '',
      house: '',
      apartment: '',
      entrance: '',
      floor: '',
      comment: '',
    }));
  };

  // Calculate delivery cost using settings
  const deliveryCost = formData.deliveryMethod === 'pickup' ? 0 : getDeliveryCost(cartTotal);
  
  // Calculate total with discount and delivery
  const subtotal = cartTotal;
  const totalDiscount = discount;
  const total = subtotal - totalDiscount + deliveryCost;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
    // Clear selected address if user manually edits
    if (['city', 'street', 'house'].includes(field)) {
      setSelectedAddressId(null);
    }
  };

  // Validate current step
  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step === 1 && formData.deliveryMethod !== 'pickup') {
      if (!formData.city.trim()) errors.city = 'Укажите город';
      else if (!/^[А-ЯЁа-яёA-Za-z\s\-\.]+$/.test(formData.city.trim())) errors.city = 'Некорректный город';

      if (!formData.street.trim()) errors.street = 'Укажите улицу';
      else if (!/^[А-ЯЁа-яёA-Za-z0-9\s\-\.]+$/.test(formData.street.trim())) errors.street = 'Некорректная улица';

      if (!formData.house.trim()) errors.house = 'Укажите номер дома';
      else if (!/^[А-ЯЁа-яёA-Za-z0-9\s\-\/]+$/.test(formData.house.trim())) errors.house = 'Некорректный номер дома';

      if (formData.apartment.trim() && !/^[А-ЯЁа-яёA-Za-z0-9\s\-]+$/.test(formData.apartment.trim())) {
        errors.apartment = 'Некорректный номер квартиры';
      }
      if (formData.entrance.trim() && !/^[А-ЯЁа-яёA-Za-z0-9\s\-]+$/.test(formData.entrance.trim())) {
        errors.entrance = 'Некорректный подъезд';
      }
      if (formData.floor.trim() && !/^\d{1,3}$/.test(formData.floor.trim())) {
        errors.floor = 'Этаж должен быть числом';
      }

      if (deliverySlots.length > 0 && !selectedSlot) {
        errors.deliveryTime = 'Выберите время доставки';
      }
    }

    if (step === 2) {
      if (!formData.name.trim()) errors.name = 'Укажите имя';
      else if (formData.name.trim().length < 2) errors.name = 'Минимум 2 символа';

      const phoneError = validatePhone(formData.phone);
      if (phoneError) errors.phone = phoneError;
    }

    if (step === 3) {
      if (!selectedPaymentMethod) errors.payment = 'Выберите способ оплаты';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Navigation
  const handleBack = () => {
    if (checkoutStep > 1) {
      setCheckoutStep(checkoutStep - 1);
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (canGoBack()) {
      goBack();
    } else {
      setCurrentView('cart', false);
    }
  };

  const handleNext = () => {
    if (validateStep(checkoutStep)) {
      if (checkoutStep < 3) {
        setCheckoutStep(checkoutStep + 1);
        containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (selectedPaymentMethod === 'sbp' || selectedPaymentMethod === 'cardTransfer') {
        // SBP / Card Transfer: show payment dialog first, create order after "Я оплатил"
        setCheckoutStep(4);
      } else {
        handleCreateOrder();
      }
    }
  };

  const handleCreateOrder = async () => {
    // Синхронная блокировка — предотвращает двойной клик
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    if (!user?.id) {
      toast({
        variant: 'destructive',
        title: 'Вход не выполнен',
        description: 'Откройте магазин из Telegram или режим демо (?demo), чтобы оформить заказ.',
      });
      submittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          initData,
          userId: user.id,
          items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          deliveryMethod: formData.deliveryMethod,
          paymentMethod: selectedPaymentMethod,
          deliveryCity: formData.city,
          deliveryStreet: formData.street,
          deliveryHouse: formData.house,
          deliveryApartment: formData.apartment,
          deliveryPostalCode: '',
          deliveryComment: formData.comment,
          deliverySlot: selectedSlot ? `${deliverySlots.find(s => s.id === selectedSlot)?.startTime} – ${deliverySlots.find(s => s.id === selectedSlot)?.endTime}` : null,
          contactName: formData.name,
          contactPhone: normalizePhone(formData.phone),
          customerComment: formData.customerComment || null,
          subtotal: subtotal,
          discount: totalDiscount,
          deliveryCost: deliveryCost,
          total: total,
          promocodeId: appliedPromo?.code,
        }),
      });

      const data = await response.json();

      // 409 = сервер обнаружил дубль — используем существующий заказ
      if (response.status === 409 && data.duplicate) {
        console.warn('[checkout] Duplicate order detected, using existing:', data.orderNumber);
        toast({ title: 'Заказ уже создан', description: `№ ${data.orderNumber}` });
        // Продолжаем с существующим заказом
      } else if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: data.details || data.error || 'Не удалось создать заказ',
        });
        return;
      }

      setOrderId(data.id);
      setOrderNumber(data.orderNumber);
      setOrderTotal(total);
      setOrderDeliveryMethod(formData.deliveryMethod);

      // Наличные — сразу экран «готово»
      if (selectedPaymentMethod === 'cash') {
        flushSync(() => {
          setOrderSuccess(true);
          setCheckoutStep(4);
        });
        clearCart();
        toast({ title: 'Заказ оформлен', description: `№ ${data.orderNumber}` });
        return;
      }

      // Платёжная транзакция
      // For automatic payment methods (card, crypto, stars), create with 'paid' status directly
      // to avoid the need for a separate admin-only PATCH 'paid' call
      const isAutoPayment = selectedPaymentMethod === 'card' || selectedPaymentMethod === 'crypto' || selectedPaymentMethod === 'stars';
      const txRes = await fetch('/api/payment-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: data.id,
          orderNumber: data.orderNumber,
          amount: total,
          paymentMethod: selectedPaymentMethod,
          cryptoAmount:
            selectedPaymentMethod === 'crypto'
              ? total / (paymentSettings.crypto.fixedRate || 95)
              : null,
          initialStatus: isAutoPayment ? 'paid' : 'pending',
          initData,
        }),
      });
      const txData = await txRes.json().catch(() => ({}));

      if (!txRes.ok || !txData?.id) {
        console.error('[checkout] payment-transactions POST failed', txRes.status, txData);
        toast({
          variant: 'destructive',
          title: 'Заказ создан',
          description:
            (txData as { error?: string }).error ||
            'Не удалось зарегистрировать оплату. Нажмите «Завершить оплату» ниже.',
        });
        flushSync(() => {
          setTransactionId(null);
          setPaymentStatus('pending');
          setCheckoutStep(4);
        });
        return;
      }

      const txId = txData.id as string;
      setTransactionId(txId);

      const isManualPayment =
        selectedPaymentMethod === 'cardTransfer' || selectedPaymentMethod === 'sbp';

      if (isManualPayment) {
        const patchTx = await fetch('/api/payment-transactions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: txId, status: 'pending_confirmation', initData }),
        });
        const patchOrder = await fetch(`/api/orders/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentStatus: 'pending_confirmation', initData }),
        });
        if (!patchTx.ok || !patchOrder.ok) {
          toast({
            variant: 'destructive',
            title: 'Заказ создан',
            description: 'Не удалось обновить статус оплаты. Нажмите «Завершить оплату».',
          });
          flushSync(() => {
            setPaymentStatus('pending');
            setCheckoutStep(4);
          });
          return;
        }
        flushSync(() => {
          setPaymentStatus('pending_confirmation');
          setCheckoutStep(4);
        });
        clearCart();
        toast({ title: 'Ожидает подтверждения', description: 'Мы проверим оплату и подтвердим заказ' });
        return;
      }

      // Авто-оплата (карта, крипто, звёзды и т.д.)
      // Transaction was already created with 'paid' status, so no need to PATCH
      // Just update the order's paymentStatus
      if (isAutoPayment) {
        // Transaction already has 'paid' status from creation — sync order paymentStatus
        const patchOrder = await fetch(`/api/orders/${data.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentStatus: 'paid', initData }),
        });
        if (!patchOrder.ok) {
          const err = await patchOrder.json().catch(() => ({}));
          console.error('[checkout] PATCH order paymentStatus failed', patchOrder.status, err);
          toast({
            variant: 'destructive',
            title: 'Заказ создан',
            description:
              (err as { error?: string }).error ||
              'Не удалось обновить статус оплаты. Нажмите «Завершить оплату».',
          });
          flushSync(() => {
            setPaymentStatus('pending');
            setCheckoutStep(4);
          });
          return;
        }
      } else {
        // For manual payment methods that weren't created with 'paid', use PATCH
        const patchPaid = await fetch('/api/payment-transactions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: txId, status: 'paid', initData }),
        });
        if (!patchPaid.ok) {
          const err = await patchPaid.json().catch(() => ({}));
          console.error('[checkout] PATCH paid failed', patchPaid.status, err);
          toast({
            variant: 'destructive',
            title: 'Заказ создан',
            description:
              (err as { error?: string }).error ||
              'Не удалось подтвердить оплату. Нажмите «Завершить оплату».',
          });
          flushSync(() => {
            setPaymentStatus('pending');
            setCheckoutStep(4);
          });
          return;
        }
      }

      flushSync(() => {
        setPaymentStatus('success');
        setOrderSuccess(true);
        setCheckoutStep(4);
      });
      clearCart();
      toast({ title: 'Оплата прошла успешно!', description: `Заказ #${data.orderNumber} оплачен` });
    } catch (error) {
      console.error('Order error:', error);
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось создать заказ',
      });
      submittingRef.current = false;
      setIsSubmitting(false);
    } finally {
      setLoading(false);
      // Do NOT reset submittingRef here — it resets on explicit success/failure
    }
  };

  /** Если заказ уже создан, но оплата не прошла — повторить регистрацию транзакции и подтверждение */
  const handleFinalizePaymentRetry = async () => {
    if (!orderId || !orderNumber || !selectedPaymentMethod) return;
    setLoading(true);
    setPaymentStatus('processing');
    try {
      let txId = transactionId;
      if (!txId) {
        const isAutoPayment = selectedPaymentMethod === 'card' || selectedPaymentMethod === 'crypto' || selectedPaymentMethod === 'stars';
        const txRes = await fetch('/api/payment-transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            orderNumber,
            amount: orderTotal,
            paymentMethod: selectedPaymentMethod,
            cryptoAmount:
              selectedPaymentMethod === 'crypto'
                ? orderTotal / (paymentSettings.crypto.fixedRate || 95)
                : null,
            initialStatus: isAutoPayment ? 'paid' : 'pending',
            initData,
          }),
        });
        const txData = await txRes.json().catch(() => ({}));
        if (!txRes.ok || !txData?.id) {
          throw new Error((txData as { error?: string }).error || 'Транзакция не создана');
        }
        txId = txData.id;
        setTransactionId(txId);
      }

      const isManualPayment =
        selectedPaymentMethod === 'cardTransfer' || selectedPaymentMethod === 'sbp';
      const isAutoPayment = selectedPaymentMethod === 'card' || selectedPaymentMethod === 'crypto' || selectedPaymentMethod === 'stars';

      if (isManualPayment) {
        await fetch('/api/payment-transactions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: txId, status: 'pending_confirmation', initData }),
        });
        await fetch(`/api/orders/${orderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentStatus: 'pending_confirmation', initData }),
        });
        flushSync(() => {
          setPaymentStatus('pending_confirmation');
          setOrderSuccess(false);
          setCheckoutStep(4);
        });
        clearCart();
        toast({ title: 'Статус обновлён', description: 'Ожидаем подтверждения оплаты' });
      } else if (isAutoPayment) {
        // Transaction was created with 'paid' status — sync order paymentStatus
        await fetch(`/api/orders/${orderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentStatus: 'paid', initData }),
        });
        flushSync(() => {
          setPaymentStatus('success');
          setOrderSuccess(true);
          setCheckoutStep(4);
        });
        clearCart();
        toast({ title: 'Оплата подтверждена', description: `Заказ #${orderNumber}` });
      } else {
        const patchPaid = await fetch('/api/payment-transactions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: txId, status: 'paid', initData }),
        });
        if (!patchPaid.ok) throw new Error('Не удалось подтвердить оплату');
        flushSync(() => {
          setPaymentStatus('success');
          setOrderSuccess(true);
          setCheckoutStep(4);
        });
        clearCart();
        toast({ title: 'Оплата подтверждена', description: `Заказ #${orderNumber}` });
      }
    } catch (e) {
      console.error(e);
      setPaymentStatus('pending');
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Попробуйте ещё раз',
      });
    } finally {
      setLoading(false);
    }
  };

  const createTransaction = async (ordId: string, ordNumber: string, amountValue: number) => {
    const isAutoPayment = selectedPaymentMethod === 'card' || selectedPaymentMethod === 'crypto' || selectedPaymentMethod === 'stars';
    const res = await fetch('/api/payment-transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: ordId,
        orderNumber: ordNumber,
        amount: amountValue,
        paymentMethod: selectedPaymentMethod,
        cryptoAmount:
          selectedPaymentMethod === 'crypto'
            ? amountValue / (paymentSettings.crypto.fixedRate || 95)
            : null,
        initialStatus: isAutoPayment ? 'paid' : 'pending',
        initData,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.id) {
      throw new Error((data as { error?: string }).error || 'Не удалось создать транзакцию');
    }
    setTransactionId(data.id);
    return data.id as string;
  };

  const handleConfirmPayment = useCallback(async () => {
    // For SBP / Card Transfer: order might not exist yet — create it first
    // (handleCreateOrder manages its own submittingRef guard)
    if ((selectedPaymentMethod === 'sbp' || selectedPaymentMethod === 'cardTransfer') && !orderId) {
      await handleCreateOrder();
      // handleCreateOrder manages its own submittingRef reset via useEffect
      return;
    }

    // Синхронная блокировка — предотвращает двойной клик «Я оплатил»
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    if (!orderId || !orderNumber) return;
    const amountValue = orderTotal > 0 ? orderTotal : total;
    setPaymentStatus('processing');

    try {
      let txId = transactionId;
      if (!txId) {
        txId = await createTransaction(orderId, orderNumber, amountValue);
      }

      const isManualPayment =
        selectedPaymentMethod === 'cardTransfer' || selectedPaymentMethod === 'sbp';

      if (isManualPayment) {
        const patchTx = await fetch('/api/payment-transactions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: txId,
            status: 'pending_confirmation',
            initData,
          }),
        });
        const patchOrder = await fetch(`/api/orders/${orderId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentStatus: 'pending_confirmation',
            initData,
          }),
        });
        if (!patchTx.ok || !patchOrder.ok) {
          throw new Error('Не удалось сохранить статус');
        }

        flushSync(() => {
          setPaymentStatus('pending_confirmation');
          setOrderSuccess(false);
          setCheckoutStep(4);
        });
        clearCart();

        toast({
          title: 'Ожидает подтверждения',
          description: 'Мы проверим оплату и подтвердим заказ',
        });
      } else {
        // For auto payments, transaction was created with 'paid' status
        // Just sync order paymentStatus
        const isAutoPayment = selectedPaymentMethod === 'card' || selectedPaymentMethod === 'crypto' || selectedPaymentMethod === 'stars';
        if (isAutoPayment) {
          const patchOrder = await fetch(`/api/orders/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentStatus: 'paid', initData }),
          });
          if (!patchOrder.ok) {
            throw new Error('Не удалось обновить статус оплаты');
          }
        } else {
          const patchPaid = await fetch('/api/payment-transactions', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: txId,
              status: 'paid',
              initData,
            }),
          });
          if (!patchPaid.ok) {
            throw new Error('Не удалось подтвердить оплату');
          }
        }

        flushSync(() => {
          setPaymentStatus('success');
          setOrderSuccess(true);
          setCheckoutStep(4);
        });
        clearCart();

        toast({
          title: 'Оплата прошла успешно!',
          description: `Заказ #${orderNumber} оплачен`,
        });
      }
    } catch (error) {
      console.error('Payment error:', error);
      setPaymentStatus('failed');
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Попробуйте ещё раз',
      });
    }
  }, [orderId, orderNumber, orderTotal, total, selectedPaymentMethod, initData, paymentSettings, transactionId]);
  // Сбрасываем submittingRef при достижении терминального состояния оплаты
  useEffect(() => {
    if (paymentStatus === 'success' || paymentStatus === 'pending_confirmation' || paymentStatus === 'failed' || paymentStatus === 'cancelled') {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [paymentStatus]);

  // Сбрасываем submittingRef при успешном создании заказа (orderId появился)
  useEffect(() => {
    if (orderId) {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [orderId]);

  const getAddressIcon = (label: string | null) => {
    if (!label) return MapPin;
    const l = label.toLowerCase();
    if (l.includes('дом') || l.includes('home')) return Home;
    if (l.includes('работ') || l.includes('work')) return Briefcase;
    return MapPin;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Скопировано!' });
  };

  // Payment method icons
  const methodIcons: Record<PaymentMethodId, React.ReactNode> = {
    card: <CreditCard className="h-5 w-5" />,
    sbp: <Smartphone className="h-5 w-5" />,
    crypto: <Coins className="h-5 w-5" />,
    stars: <Star className="h-5 w-5 text-yellow-500" />,
    cardTransfer: <CreditCard className="h-5 w-5" />,
    cash: <Banknote className="h-5 w-5 text-green-500" />,
  };

  const enabledPaymentMethods = getEnabledPaymentMethods(paymentSettings);

  // Loading skeleton
  if (dataLoading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header skeleton */}
        <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center gap-3 px-4 py-2">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-5 w-48 rounded" />
          </div>

          {/* Step indicators skeleton */}
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-3 w-16 rounded mt-1.5" />
                  </div>
                  {idx < 2 && (
                    <div className="flex-1 h-0.5 mx-2">
                      <Skeleton className="h-0.5 w-full rounded" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form skeleton */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
          {/* Delivery method card */}
          <div className="rounded-xl border bg-card p-3 space-y-3">
            <Skeleton className="h-5 w-40 rounded" />
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl border">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-3 w-32 rounded ml-auto" />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl border">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-20 rounded ml-auto" />
              </div>
            </div>
          </div>

          {/* Address form card */}
          <div className="rounded-xl border bg-card p-3 space-y-3">
            <Skeleton className="h-5 w-36 rounded" />
            {/* City */}
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            {/* Street */}
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-14 rounded" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            {/* House + Apartment */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>
          </div>

          {/* Extra card skeleton */}
          <div className="rounded-xl border bg-card p-3 space-y-3">
            <Skeleton className="h-5 w-28 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Success state (step 4 with success or pending_confirmation)
  if (checkoutStep === 4 && (orderSuccess || paymentStatus === 'success' || paymentStatus === 'pending_confirmation')) {
    // Determine payment status text
    const isPaid = paymentStatus === 'success' || selectedPaymentMethod === 'cash';
    const isPendingConfirmation = paymentStatus === 'pending_confirmation';
    const isCashPayment = selectedPaymentMethod === 'cash';
    const isPickup = orderDeliveryMethod === 'pickup';
    
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 bg-background/95 backdrop-blur border-b px-4 py-2">
          <div className="flex items-center gap-3">
          </div>
        </div>
        
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex flex-col items-center p-3 pb-14 text-center">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 0.6, bounce: 0.4 }}
            className="w-24 h-24 rounded-full flex items-center justify-center mb-6 bg-gradient-to-br from-green-400 to-emerald-600 dark:from-green-500 dark:to-green-700 shadow-lg shadow-green-500/25"
          >
            <CheckCircle2 className="h-14 w-14 text-white" />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-sm"
          >
            <h2 className="text-2xl font-bold mb-2">Заказ оформлен!</h2>
            <p className="text-muted-foreground mb-2">
              № <CopyableOrderNumber orderNumber={orderNumber} size="md" />
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Мы свяжемся с вами для подтверждения
            </p>

            {/* Customer Comment */}
            {formData.customerComment && (
              <Card className="mb-4 bg-muted/50 border-muted">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Комментарий к заказу
                      </p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {formData.customerComment}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cash payment — single combined card (amount + instruction) */}
            {isCashPayment ? (
              <Card className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Banknote className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 text-left">
                      <p className="font-medium text-amber-800 dark:text-amber-200">
                        {isPickup 
                          ? 'Оплата при получении в пункте самовывоза'
                          : 'Оплата курьеру при получении заказа'}
                      </p>
                      <p className="text-3xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                        {formatPrice(orderTotal)}
                      </p>
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                        Приготовьте точную сумму
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
            /* Non-cash payment — single combined card (amount + status) */
            <Card className="mb-6">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                    isPaid && !isPendingConfirmation ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30',
                  )}>
                    {isPaid && !isPendingConfirmation ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className={cn(
                      'font-medium',
                      isPaid && !isPendingConfirmation ? 'text-green-800 dark:text-green-200' : 'text-blue-800 dark:text-blue-200',
                    )}>
                      {isPendingConfirmation ? 'Проверяем оплату' : isPaid ? 'Оплата прошла успешно' : 'Ожидает оплаты'}
                    </p>
                    <p className="text-3xl font-bold mt-1">
                      {formatPrice(orderTotal)}
                    </p>
                    {isPendingConfirmation && (
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        Обычно занимает несколько минут
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            )}
            
            <div className="flex flex-col gap-3 w-full">
              <Button size="lg" onClick={() => setCurrentView('orders', false)}>
                Перейти к заказам
              </Button>
              <Button size="lg" variant="outline" onClick={() => setCurrentView('catalog', false)}>
                Продолжить покупки
              </Button>
            </div>
          </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center gap-3 px-4 py-2">
          <Button
            variant="ghost" 
            size="icon" 
            aria-label="Назад"
            onClick={handleBack}
            disabled={loading || paymentStatus === 'processing'}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Оформление заказа</h1>
          </div>
        </div>
        
        {/* Step indicators */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between">
            {STEPS.slice(0, 3).map((s, idx) => (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <motion.div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                      checkoutStep > s.id 
                        ? 'bg-brand text-brand-foreground' 
                        : checkoutStep === s.id
                          ? 'bg-brand text-brand-foreground ring-2 ring-brand ring-offset-2 ring-offset-background'
                          : 'bg-muted text-muted-foreground'
                    )}
                    animate={{ scale: checkoutStep === s.id ? 1.1 : 1 }}
                  >
                    {checkoutStep > s.id ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <s.icon className="h-4 w-4" />
                    )}
                  </motion.div>
                  <span className={cn(
                    'text-xs mt-1',
                    checkoutStep >= s.id ? 'text-foreground font-medium' : 'text-muted-foreground'
                  )}>
                    {s.title}
                  </span>
                </div>
                {idx < 2 && (
                  <div className={cn(
                    'flex-1 h-0.5 mx-2 transition-colors',
                    checkoutStep > s.id ? 'bg-brand' : 'bg-muted'
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-44" ref={containerRef}>
        <div className="p-3 space-y-3">
          <AnimatePresence mode="wait">
          {/* Step 1: Delivery */}
          {checkoutStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Способ доставки
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={formData.deliveryMethod}
                      onValueChange={(value) => handleInputChange('deliveryMethod', value)}
                    >
                      {deliveryMethods.map((method) => {
                        const Icon = method.id === 'courier' ? Truck : method.id === 'pickup' ? Store : MapPin;
                        return (
                          <Label
                            key={method.id}
                            htmlFor={method.id}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                              formData.deliveryMethod === method.id
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'hover:bg-muted/50'
                            )}
                          >
                            <RadioGroupItem value={method.id} id={method.id} />
                            <Icon className="h-5 w-5 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="font-medium">{method.name}</p>
                              <p className="text-xs text-muted-foreground">{method.description}</p>
                            </div>
                            {method.basePrice > 0 && (
                              <span className="text-sm">
                                {method.freeFrom > 0 && cartTotal >= method.freeFrom ? (
                                  <span className="text-green-600 dark:text-green-400 font-medium">Бесплатно</span>
                                ) : (
                                  <span className="text-muted-foreground">от {method.basePrice} ₽</span>
                                )}
                              </span>
                            )}
                            {method.basePrice === 0 && (
                              <span className="text-sm text-green-600 dark:text-green-400 font-medium">Бесплатно</span>
                            )}
                          </Label>
                        );
                      })}
                    </RadioGroup>
                  </CardContent>
                </Card>

                {/* Delivery Time Slots — only for courier when slots exist */}
                {formData.deliveryMethod !== 'pickup' && deliverySlots.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Время доставки
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        {deliverySlots.map((slot) => {
                          const isSelected = selectedSlot === slot.id;
                          const label = `${slot.startTime} – ${slot.endTime}`;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setSelectedSlot(slot.id)}
                              className={cn(
                                'p-3 rounded-xl border text-center transition-all',
                                isSelected
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'hover:bg-muted/50'
                              )}
                            >
                              <span className={cn(
                                'text-sm font-medium',
                                isSelected ? 'text-primary' : 'text-foreground'
                              )}>
                                {label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {validationErrors.deliveryTime && (
                        <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3 shrink-0" />
                          {validationErrors.deliveryTime}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {formData.deliveryMethod !== 'pickup' && (
                  <>
                    {/* Saved Addresses */}
                    {savedAddresses.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Сохраненные адреса
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {savedAddresses.map((address) => {
                            const Icon = getAddressIcon(address.label);
                            const isSelected = selectedAddressId === address.id;
                            return (
                              <button
                                key={address.id}
                                type="button"
                                onClick={() => handleSelectAddress(address)}
                                className={cn(
                                  'w-full p-3 rounded-xl border text-left transition-all',
                                  isSelected
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                    : 'hover:bg-muted/50'
                                )}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={cn(
                                    'p-1.5 rounded-md',
                                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                  )}>
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      {address.label && (
                                        <span className="font-medium text-sm">{address.label}</span>
                                      )}
                                      {address.isDefault && (
                                        <Badge variant="secondary" className="text-[10px] h-5">
                                          <Star className="h-3 w-3 mr-0.5" />
                                          Основной
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                      {address.city}, {address.street}, {address.house}
                                      {address.apartment && `, кв. ${address.apartment}`}
                                    </p>
                                  </div>
                                  {isSelected && (
                                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2"
                            onClick={clearAddressForm}
                          >
                            Ввести новый адрес
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Address Input Form — hidden when a saved address is selected */}
                    {!selectedAddressId && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          Адрес доставки
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <Label htmlFor="city" className={cn(validationErrors.city && 'text-destructive')}>
                              Город *
                            </Label>
                            <Input
                              id="city"
                              value={formData.city}
                              onChange={(e) => handleInputChange('city', e.target.value)}
                              placeholder="Москва"
                              className={cn(validationErrors.city && 'border-destructive')}
                            />
                            {validationErrors.city && (
                              <p className="text-xs text-destructive mt-1">{validationErrors.city}</p>
                            )}
                          </div>
                          <div className="col-span-2">
                            <Label htmlFor="street" className={cn(validationErrors.street && 'text-destructive')}>
                              Улица *
                            </Label>
                            <Input
                              id="street"
                              value={formData.street}
                              onChange={(e) => handleInputChange('street', e.target.value)}
                              placeholder="Ленина"
                              className={cn(validationErrors.street && 'border-destructive')}
                            />
                            {validationErrors.street && (
                              <p className="text-xs text-destructive mt-1">{validationErrors.street}</p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="house" className={cn(validationErrors.house && 'text-destructive')}>
                              Дом *
                            </Label>
                            <Input
                              id="house"
                              value={formData.house}
                              onChange={(e) => handleInputChange('house', e.target.value)}
                              placeholder="1"
                              className={cn(validationErrors.house && 'border-destructive')}
                            />
                            {validationErrors.house && (
                              <p className="text-xs text-destructive mt-1">{validationErrors.house}</p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="apartment" className={cn(validationErrors.apartment && 'text-destructive')}>Квартира</Label>
                            <Input
                              id="apartment"
                              value={formData.apartment}
                              onChange={(e) => handleInputChange('apartment', e.target.value)}
                              placeholder="1"
                              className={cn(validationErrors.apartment && 'border-destructive')}
                            />
                            {validationErrors.apartment && (
                              <p className="text-xs text-destructive mt-1">{validationErrors.apartment}</p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="entrance" className={cn(validationErrors.entrance && 'text-destructive')}>Подъезд</Label>
                            <Input
                              id="entrance"
                              value={formData.entrance}
                              onChange={(e) => handleInputChange('entrance', e.target.value)}
                              placeholder="1"
                              className={cn(validationErrors.entrance && 'border-destructive')}
                            />
                            {validationErrors.entrance && (
                              <p className="text-xs text-destructive mt-1">{validationErrors.entrance}</p>
                            )}
                          </div>
                          <div>
                            <Label htmlFor="floor" className={cn(validationErrors.floor && 'text-destructive')}>Этаж</Label>
                            <Input
                              id="floor"
                              value={formData.floor}
                              onChange={(e) => handleInputChange('floor', e.target.value)}
                              placeholder="5"
                              className={cn(validationErrors.floor && 'border-destructive')}
                            />
                            {validationErrors.floor && (
                              <p className="text-xs text-destructive mt-1">{validationErrors.floor}</p>
                            )}
                          </div>
                          <div className="col-span-2">
                            <Label htmlFor="comment">Комментарий</Label>
                            <Input
                              id="comment"
                              value={formData.comment}
                              onChange={(e) => handleInputChange('comment', e.target.value)}
                              placeholder="Код домофона, как найти..."
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    )}
                  </>
                )}
                </>
              </motion.div>
            )}

            {/* Step 2: Contact info */}
            {checkoutStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Контактные данные
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor="name" className={cn(validationErrors.name && 'text-destructive')}>
                      Имя *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Иван"
                      className={cn(validationErrors.name && 'border-destructive')}
                    />
                    {validationErrors.name && (
                      <p className="text-xs text-destructive mt-1">{validationErrors.name}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="phone" className={cn(validationErrors.phone && 'text-destructive')}>
                      Телефон *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+7 (999) 123-45-67"
                      className={cn(validationErrors.phone && 'border-destructive')}
                    />
                    {validationErrors.phone && (
                      <p className="text-xs text-destructive mt-1">{validationErrors.phone}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Customer comment card — separate for visibility */}
              <Card className="border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/10">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/30">
                      <MessageSquare className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <Label htmlFor="customerCommentCard" className="text-sm font-medium text-orange-700 dark:text-orange-400">
                      Комментарий к заказу
                    </Label>
                  </div>
                  <textarea
                    id="customerCommentCard"
                    value={formData.customerComment || ''}
                    onChange={(e) => handleInputChange('customerComment', e.target.value)}
                    placeholder="Пожелания к заказу, передать привет, аллергии..."
                    className="flex w-full rounded-md border border-orange-200 dark:border-orange-800/50 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    rows={3}
                  />
                </CardContent>
              </Card>
              </motion.div>
            )}

            {/* Step 3: Payment */}
            {checkoutStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
              <>
                {/* Order summary */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Ваш заказ
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Order items list */}
                    <div className={cn(
                      showFullOrder && cart.length > 6 && 'max-h-[300px] overflow-y-auto'
                    )}>
                      {(showFullOrder ? cart : cart.slice(0, 3)).map((item) => (
                        <div key={item.productId} className="flex items-center justify-between text-sm gap-2">
                          <span className="text-muted-foreground truncate flex-1 min-w-0">
                            {item.product.name}
                          </span>
                          <span className="text-muted-foreground shrink-0 tabular-nums">
                            × {item.quantity}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {formatPrice((item.product.discountPrice || item.product.price) * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Expand/collapse toggle when > 3 items */}
                    {cart.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowFullOrder(!showFullOrder)}
                        className="flex items-center justify-center gap-1 w-full py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showFullOrder ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" />
                            Свернуть
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" />
                            Показать все товары ({cart.length} {pluralize(cart.length, 'товар', 'товара', 'товаров')})
                          </>
                        )}
                      </button>
                    )}
                    
                    <Separator />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Подытог</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                        <span className="flex items-center gap-1">
                          <Gift className="h-3 w-3" />
                          Скидка {appliedPromo?.code && `(${appliedPromo.code})`}
                        </span>
                        <span>-{formatPrice(totalDiscount)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Доставка</span>
                      {deliveryCost === 0 ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">Бесплатно</span>
                      ) : (
                        <span>{formatPrice(deliveryCost)}</span>
                      )}
                    </div>
                    
                    <Separator />
                    
                    <div className="flex justify-between font-bold text-lg">
                      <span>Итого</span>
                      <span className="text-primary">{formatPrice(total)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Comment summary on payment step */}
                {formData.customerComment && (
                  <Card className="bg-orange-50/50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-800/50">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-orange-700 dark:text-orange-400 mb-0.5">Комментарий к заказу</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{formData.customerComment}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Payment methods */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Способ оплаты
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {enabledPaymentMethods.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        <p>Способы оплаты не настроены</p>
                        <p className="text-xs mt-1">Обратитесь к администратору</p>
                      </div>
                    ) : (
                      <RadioGroup
                        value={selectedPaymentMethod || ''}
                        onValueChange={(value) => setSelectedPaymentMethod(value as PaymentMethodId)}
                      >
                        {enabledPaymentMethods.map((method) => (
                          <Label
                            key={method}
                            htmlFor={method}
                            className={cn(
                              'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                              selectedPaymentMethod === method
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'hover:bg-muted/50'
                            )}
                          >
                            <RadioGroupItem value={method} id={method} />
                            {methodIcons[method]}
                            <div className="flex-1">
                              <span className="font-medium">{paymentMethodsInfo[method].name}</span>
                              <p className="text-xs text-muted-foreground">
                                {paymentMethodsInfo[method].description}
                              </p>
                            </div>
                          </Label>
                        ))}
                      </RadioGroup>
                    )}
                  </CardContent>
                </Card>

                {/* Payment validation error */}
                {validationErrors.payment && (
                  <p className="text-sm text-destructive flex items-center gap-1.5 px-1">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {validationErrors.payment}
                  </p>
                )}

                {/* Delivery info summary */}
                {formData.deliveryMethod !== 'pickup' && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Доставка
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-muted">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {formData.city}, {formData.street}, {formData.house}
                            {formData.apartment && `, кв. ${formData.apartment}`}
                          </p>
                          {(formData.entrance || formData.floor) && (
                            <p className="text-sm text-muted-foreground">
                              {formData.entrance && `под. ${formData.entrance}`}
                              {formData.entrance && formData.floor && ', '}
                              {formData.floor && `эт. ${formData.floor}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
              </motion.div>
            )}
          </AnimatePresence>

            {/* Step 4: Payment processing */}
            {checkoutStep === 4 && (
              <div className="space-y-3">
                {/* Amount — compact, no duplicate "waiting" reminder */}
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground">К оплате</p>
                  <p className="text-2xl font-bold">{formatPrice(total)}</p>
                </div>

                {/* SBP Payment - show full dialog with bank selection (order not created yet) */}
                {selectedPaymentMethod === 'sbp' && !orderId && paymentSettings.sbp.phone && (
                  <div className="space-y-3">
                    {/* Phone number */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          Оплата через СБП
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Переведите сумму на номер телефона:
                        </p>
                        <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                          <span className="font-mono text-lg">{formatPhone(paymentSettings.sbp.phone)}</span>
                          <Button variant="ghost" size="sm" aria-label="Скопировать номер телефона" onClick={() => copyToClipboard(paymentSettings.sbp.phone || '')}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>

                        {paymentSettings.sbp.bankName && (
                          <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                            <span className="text-sm text-muted-foreground">Банк получатель</span>
                            <span className="font-medium">{paymentSettings.sbp.bankName}</span>
                          </div>
                        )}

                        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-xl">
                          <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            После перевода нажмите кнопку «Я оплатил». Заказ будет создан и отправлен на подтверждение.
                          </p>
                        </div>

                        <Button className="w-full" size="lg" onClick={handleConfirmPayment} disabled={loading || isSubmitting}>
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Создание заказа...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Я оплатил
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* SBP Payment - order created, waiting for confirmation */}
                {selectedPaymentMethod === 'sbp' && orderId && paymentSettings.sbp.phone && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        Оплата через СБП
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Переведите сумму на номер телефона:
                      </p>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                        <span className="font-mono text-lg">{formatPhone(paymentSettings.sbp.phone)}</span>
                        <Button variant="ghost" size="sm" aria-label="Скопировать номер телефона" onClick={() => copyToClipboard(paymentSettings.sbp.phone || '')}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      {paymentSettings.sbp.bankName && (
                        <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                          <span className="text-sm text-muted-foreground">Банк получатель</span>
                          <span className="font-medium">{paymentSettings.sbp.bankName}</span>
                        </div>
                      )}
                      <Button className="w-full" onClick={handleConfirmPayment} disabled={paymentStatus === 'processing' || isSubmitting}>
                        {paymentStatus === 'processing' ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Обработка...
                          </>
                        ) : (
                          'Я оплатил'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {selectedPaymentMethod === 'cardTransfer' && paymentSettings.cardTransfer.cardNumber && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Перевод на карту
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Переведите сумму на карту:
                      </p>
                      <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                        <span className="font-mono text-lg tracking-wider">{paymentSettings.cardTransfer.cardNumber}</span>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(paymentSettings.cardTransfer.cardNumber || '')}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      {paymentSettings.cardTransfer.holderName && (
                        <p className="text-sm">Получатель: {paymentSettings.cardTransfer.holderName}</p>
                      )}
                      {paymentSettings.cardTransfer.bankName && (
                        <p className="text-sm text-muted-foreground">Банк: {paymentSettings.cardTransfer.bankName}</p>
                      )}
                      <Button className="w-full" onClick={handleConfirmPayment} disabled={paymentStatus === 'processing' || isSubmitting}>
                        {paymentStatus === 'processing' ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Обработка...
                          </>
                        ) : (
                          'Я оплатил'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {selectedPaymentMethod === 'crypto' && paymentSettings.crypto.walletAddress && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        Оплата криптовалютой
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">Сумма в USDT ({paymentSettings.crypto.network || 'TRC-20'})</p>
                        <p className="text-2xl font-bold">
                          {(total / (paymentSettings.crypto.fixedRate || 95)).toFixed(2)} USDT
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">Кошелёк:</p>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                        <span className="font-mono text-xs break-all flex-1">{paymentSettings.crypto.walletAddress}</span>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(paymentSettings.crypto.walletAddress || '')}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button className="w-full" onClick={handleConfirmPayment} disabled={paymentStatus === 'processing' || isSubmitting}>
                        {paymentStatus === 'processing' ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Обработка...
                          </>
                        ) : (
                          'Я оплатил'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {selectedPaymentMethod === 'card' && (
                  <Card>
                    <CardContent className="p-3 space-y-3">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Shield className="h-5 w-5" />
                        <span className="text-sm">Безопасная оплата</span>
                      </div>
                      <Button className="w-full" onClick={handleConfirmPayment} disabled={paymentStatus === 'processing' || isSubmitting}>
                        {paymentStatus === 'processing' ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Обработка...
                          </>
                        ) : (
                          'Оплатить картой'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {selectedPaymentMethod === 'stars' && (
                  <Card>
                    <CardContent className="p-3 space-y-3">
                      <div className="text-center">
                        <Star className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-2">
                          Оплата Telegram Stars
                        </p>
                        <p className="text-2xl font-bold">
                          {Math.ceil(total / (paymentSettings.stars.rate || 1))} ⭐
                        </p>
                      </div>
                      <Button className="w-full" onClick={handleConfirmPayment} disabled={paymentStatus === 'processing' || isSubmitting}>
                        {paymentStatus === 'processing' ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Обработка...
                          </>
                        ) : (
                          'Оплатить звёздами'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Заказ создан, но оплата не зарегистрирована — повторить */}
                {orderId && paymentStatus === 'pending' && (
                  <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                    <CardContent className="p-3 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Заказ уже создан. Нажмите, чтобы снова отправить данные оплаты на сервер.
                      </p>
                      <Button
                        type="button"
                        className="w-full"
                        variant="secondary"
                        onClick={handleFinalizePaymentRetry}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Отправка...
                          </>
                        ) : (
                          'Завершить оплату'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
        </div>
      </div>

      {/* Bottom action */}
      {checkoutStep < 4 && (
        <div className="fixed bottom-[4.5rem] left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-4 safe-area-bottom z-10">
          {/* Promo code — inline row, only on step 3 (Оплата) */}
          {checkoutStep === 3 && (
          <div className="max-w-lg mx-auto mb-3">
            {appliedPromo ? (
              <div className="flex items-center justify-between p-2.5 bg-brand-light dark:bg-brand/10 rounded-lg border border-brand/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand" />
                  <div>
                    <span className="font-semibold text-brand text-xs">{appliedPromo.code}</span>
                    <p className="text-[11px] text-brand/70">{appliedPromo.message}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => useShopStore.getState().setAppliedPromo(null)}
                  className="text-brand/60 hover:text-brand hover:bg-brand/10 h-6 w-6 p-0 flex items-center justify-center rounded-md"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">Промокод</span>
                <Input
                  placeholder="Введите код"
                  value={promocode}
                  onChange={(e) => setPromocode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleApplyCheckoutPromo();
                  }}
                  className="uppercase h-8 rounded-lg border-border/60 text-xs flex-1"
                  maxLength={20}
                />
                <Button
                  size="sm"
                  className="bg-brand text-brand-foreground hover:bg-brand/90 h-8 rounded-lg px-3 text-xs font-semibold shrink-0"
                  onClick={handleApplyCheckoutPromo}
                  disabled={!promocode.trim() || validating}
                >
                  {validating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'OK'}
                </Button>
              </div>
            )}
          </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleNext}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Обработка...
              </>
            ) : checkoutStep === 3 ? (
              <>
                Оплатить {formatPrice(total)}
                <ChevronRight className="h-5 w-5 ml-2" />
              </>
            ) : (
              <>
                Продолжить
                <ChevronRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
