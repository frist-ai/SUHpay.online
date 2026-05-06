'use client';

import { useShopStore, CartItem, Product } from '@/stores/shop-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Minus, 
  Plus, 
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Gift,
  Truck,
  Trash2,
  Package,
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { CartTimer } from './cart-timer';
import { PopularProducts } from './popular-products';
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { cn, formatPrice } from '@/lib/utils';
import { parseProductImages } from '@/lib/product-utils';
import { useToast } from '@/hooks/use-toast';
import { useDeliverySettings } from '@/hooks/use-delivery-settings';
import { EmptyState } from './empty-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Swipe-to-delete cart item wrapper
function SwipeableCartItem({ 
  item, 
  children,
  onRemove 
}: { 
  item: CartItem; 
  children: React.ReactNode;
  onRemove: () => void;
}) {
  const x = useMotionValue(0);
  const backgroundOpacity = useTransform(x, [-100, 0], [1, 0]);
  const deleteScale = useTransform(x, [-100, -50, 0], [1, 0.8, 0.5]);
  
  const [dragging, setDragging] = useState(false);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -80) {
      onRemove();
    }
    setDragging(false);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Red delete background */}
      <motion.div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive/90 rounded-xl px-6"
        style={{ opacity: backgroundOpacity }}
      >
        <motion.div style={{ scale: deleteScale }}>
          <Trash2 className="h-5 w-5 text-white" />
        </motion.div>
      </motion.div>
      
      {/* Draggable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        style={{ x }}
        onDragStart={() => setDragging(true)}
        onDragEnd={handleDragEnd}
        className={cn(
          'bg-card relative z-10',
          dragging && 'pointer-events-none'
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}



export function CartView() {
  const { 
    cart, 
    cartTotal, 
    cartCount, 
    updateCartQuantity, 
    removeFromCart, 
    setCurrentView,
    appliedPromo,
    setAppliedPromo,
    setSelectedProduct,
    cartDeliveryMethod,
    setCartDeliveryMethod,
  } = useShopStore();
  
  const { toast } = useToast();
  const { settings, getDeliveryCost, getRemainingForFreeDelivery, isFreeDeliveryAvailable } = useDeliverySettings();
  
  const [promocode, setPromocode] = useState('');
  const [validating, setValidating] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [promoExpanded, setPromoExpanded] = useState(false);
  const bottomSummaryRef = useRef<HTMLDivElement>(null);
  const [bottomSummaryHeight, setBottomSummaryHeight] = useState(0);

  // Measure the fixed bottom summary height dynamically using getBoundingClientRect
  useEffect(() => {
    const measure = () => {
      if (bottomSummaryRef.current) {
        const rect = bottomSummaryRef.current.getBoundingClientRect();
        const height = window.innerHeight - rect.top + 16;
        setBottomSummaryHeight(height);
      }
    };
    measure();

    // Re-measure after animations settle
    const timer = setTimeout(measure, 350);

    const observer = new ResizeObserver(measure);
    if (bottomSummaryRef.current) {
      observer.observe(bottomSummaryRef.current);
    }

    window.addEventListener('resize', measure);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [cartDeliveryMethod, appliedPromo]);

  // Out-of-stock toast for cart stepper
  const showOutOfStockToast = useCallback((productName: string) => {
    toast({
      title: 'Товар закончился',
      description: productName,
      variant: 'out-of-stock',
      duration: 2000,
    });
  }, [toast]);

  const handleClearCart = () => {
    cart.forEach(item => removeFromCart(item.productId));
    setAppliedPromo(null);
    setClearDialogOpen(false);
    toast({
      title: 'Корзина очищена',
      description: 'Все товары удалены',
    });
  };

  const handleApplyPromo = async () => {
    if (!promocode.trim()) return;

    setValidating(true);
    try {
      const res = await fetch('/api/promocodes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: promocode.trim(),
          subtotal: cartTotal,
        }),
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
        toast({
          title: 'Промокод применён!',
          description: data.message,
        });
      } else {
        toast({
          title: 'Ошибка',
          description: data.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error validating promocode:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось проверить промокод',
        variant: 'destructive',
      });
    } finally {
      setValidating(false);
    }
  };

  // Calculate savings from product discounts (original price vs discount price)
  const totalSavings = useMemo(() => {
    return cart.reduce((sum, item) => {
      if (item.product.discountPrice && item.product.discountPrice < item.product.price) {
        const savedPerItem = item.product.price - item.product.discountPrice;
        return sum + savedPerItem * item.quantity;
      }
      return sum;
    }, 0);
  }, [cart]);

  // Calculate totals
  const discountAmount = appliedPromo?.discountAmount || 0;
  const remainingForFreeDelivery = getRemainingForFreeDelivery(cartTotal);
  const deliveryCost = getDeliveryCost(cartTotal, cartDeliveryMethod);
  const finalTotal = cartTotal - discountAmount + deliveryCost;

  // Delivery estimate text
  const deliveryEstimate = useMemo(() => {
    if (cartDeliveryMethod === 'pickup') {
      return 'Сегодня, самовывоз';
    }
    if (settings.courier.minHours && settings.courier.maxHours) {
      return `${settings.courier.minHours}–${settings.courier.maxHours} ч`;
    }
    return '1–3 ч';
  }, [cartDeliveryMethod, settings]);

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center flex-1 min-h-0 overflow-y-auto p-4 pb-14">
        <div className="flex flex-col items-center">
          <EmptyState
            icon="cart"
            title="Корзина пуста"
            description="Добавьте товары из каталога"
            secondaryText="Начните покупки — мы поможем с выбором!"
            buttonText="Перейти в каталог"
            onButtonClick={() => setCurrentView('catalog')}
          />
        </div>
        <PopularProducts />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold flex items-center gap-2.5">
            Корзина
            <Badge className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90 px-2.5">
              {cartCount}
            </Badge>
            <CartTimer />
          </h1>
          {cart.length > 1 && (
            <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-sm h-8 px-2 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Очистить</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Очистить корзину?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Все товары ({cartCount} шт.) будут удалены из корзины. Это действие нельзя отменить.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleClearCart}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Очистить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto" style={{ paddingBottom: bottomSummaryHeight > 0 ? `${bottomSummaryHeight}px` : '14rem' }}>
        <div className="p-3 space-y-3">
          {/* Cart Summary Card — clear itemized breakdown */}
          <div className="px-3 py-2.5 rounded-xl bg-muted/40 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{cartCount} {cartCount === 1 ? 'товар' : cartCount < 5 ? 'товара' : 'товаров'}</span>
              <span className="font-bold text-sm tabular-nums">{formatPrice(finalTotal)}</span>
            </div>
            {(totalSavings > 0 || discountAmount > 0 || deliveryCost > 0) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                {totalSavings > 0 && (
                  <span className="text-green-600 dark:text-green-400">Скидка −{formatPrice(totalSavings)}</span>
                )}
                {discountAmount > 0 && (
                  <span className="text-brand">Промокод −{formatPrice(discountAmount)}</span>
                )}
                <span className={cn(
                  deliveryCost === 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                )}>
                  Доставка: {cartDeliveryMethod === 'pickup' ? 'бесплатно (самовывоз)' : deliveryCost === 0 ? 'бесплатно!' : formatPrice(deliveryCost)}
                </span>
              </div>
            )}
          </div>

          {/* Delivery Tumbler — hide delivery option if courier is disabled */}
          {settings.courier.enabled ? (
            <div className="flex h-8 rounded-xl bg-muted/50 border border-border/60 overflow-hidden">
              <button
                type="button"
                className={cn(
                  "flex-1 flex items-center justify-center text-sm font-medium rounded-xl transition-all duration-200",
                  cartDeliveryMethod === 'pickup'
                    ? 'bg-brand text-brand-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setCartDeliveryMethod('pickup')}
              >
                Самовывоз
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 flex items-center justify-center text-sm font-medium rounded-xl transition-all duration-200",
                  cartDeliveryMethod === 'courier'
                    ? 'bg-brand text-brand-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setCartDeliveryMethod('courier')}
              >
                <Truck className="h-3.5 w-3.5 mr-1" />
                Доставка
              </button>
            </div>
          ) : (
            <div className="flex h-8 rounded-xl bg-muted/50 border border-border/60 overflow-hidden">
              <div className="flex-1 flex items-center justify-center text-sm font-medium bg-brand text-brand-foreground rounded-xl">
                Самовывоз
              </div>
            </div>
          )}

          {/* Free delivery progress bar — shown regardless of delivery method toggle */}
          {cartDeliveryMethod === 'courier' && settings.freeDelivery.enabled && remainingForFreeDelivery > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.25 }}
              className="p-3.5 bg-brand-light dark:bg-brand/10 rounded-xl border border-brand/15"
            >
              <div className="flex items-start gap-2.5">
                <Truck className="h-4.5 w-4.5 text-brand mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-brand leading-snug">
                    До бесплатной доставки ещё{' '}
                    <span className="font-semibold">{formatPrice(remainingForFreeDelivery)}</span>
                  </p>
                  <div className="mt-2.5 h-2 bg-brand/15 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-brand to-brand/70 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (cartTotal / settings.freeDelivery.minOrderAmount) * 100)}%` }}
                      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                    />
                  </div>
                  <p className="text-xs text-brand/60 mt-1.5">
                    От {formatPrice(settings.freeDelivery.minOrderAmount)} — доставка бесплатно
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Free delivery achieved banner */}
          {cartDeliveryMethod === 'courier' && settings.freeDelivery.enabled && remainingForFreeDelivery <= 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.25 }}
              className="p-3.5 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800/50"
            >
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4.5 w-4.5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  Доставка бесплатная! 🎉
                </p>
              </div>
            </motion.div>
          )}

          {/* Cart items */}
          <AnimatePresence mode="popLayout">
            {cart.map((item: CartItem) => {
              const unitPrice = item.product.discountPrice || item.product.price;
              const lineTotal = unitPrice * item.quantity;
              const hasDiscount = item.product.discountPrice && item.product.discountPrice < item.product.price;
              const isAtMax = item.quantity >= item.product.stock;

              return (
                <motion.div
                  key={item.productId}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <SwipeableCartItem
                    item={item}
                    onRemove={() => {
                      removeFromCart(item.productId);
                      toast({
                        title: 'Удалено',
                        description: item.product.name,
                        duration: 1500,
                      });
                    }}
                  >
                    <div className="flex items-center gap-3 py-2 px-2">
                      {/* Product image with count badge */}
                      <div className="relative flex-shrink-0">
                        <div 
                          className="w-16 h-16 bg-muted rounded-xl overflow-hidden cursor-pointer"
                          onClick={() => setSelectedProduct(item.productId)}
                        >
                          <img
                            src={(() => {
                              const images = parseProductImages(item.product.images);
                              return images[0] || '/placeholder-product.svg';
                            })()}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-product.svg';
                            }}
                          />
                        </div>
                        {/* Item count badge */}
                        <Badge className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1.5 bg-brand text-brand-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                          {item.quantity}
                        </Badge>
                      </div>

                      {/* Product info */}
                      <div className="flex-1 min-w-0">
                        <h3 
                          className="text-sm font-medium truncate cursor-pointer hover:text-brand transition-colors"
                          onClick={() => setSelectedProduct(item.productId)}
                        >
                          {item.product.name}
                        </h3>
                        {hasDiscount && (
                          <p className="text-[11px] text-muted-foreground line-through leading-tight">
                            {formatPrice(item.product.price)}/шт
                          </p>
                        )}
                        <div className="flex items-baseline gap-1.5">
                          <span className={cn(
                            'text-xs leading-tight',
                            hasDiscount ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-muted-foreground'
                          )}>
                            {formatPrice(unitPrice)}/шт
                          </span>
                          <span className={cn(
                            'text-sm font-semibold leading-tight ml-auto',
                            hasDiscount && 'text-green-600 dark:text-green-400'
                          )}>
                            {formatPrice(lineTotal)}
                          </span>
                        </div>
                      </div>

                      {/* Quantity stepper — green accent, flash on press */}
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center h-9 rounded-xl border border-brand/20 bg-brand/5 dark:bg-brand/10">
                          <button
                            type="button"
                            aria-label="Уменьшить количество"
                            className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-brand/10 active:bg-brand/20 dark:hover:bg-brand/15 dark:active:bg-brand/25 rounded-l-xl transition-colors"
                            onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                          >
                            <Minus className="h-4 w-4" strokeWidth={2} />
                          </button>
                          <span className="min-w-[2rem] text-center text-xs font-semibold text-foreground select-none tabular-nums">
                            {item.quantity}шт
                          </span>
                          <button
                            type="button"
                            aria-label="Увеличить количество"
                            className={cn(
                              'w-9 h-9 flex items-center justify-center text-foreground rounded-r-xl transition-colors',
                              isAtMax
                                ? 'opacity-30 cursor-not-allowed'
                                : 'hover:bg-brand/10 active:bg-brand/20 dark:hover:bg-brand/15 dark:active:bg-brand/25'
                            )}
                            onClick={() => {
                              if (isAtMax) {
                                showOutOfStockToast(item.product.name);
                                return;
                              }
                              updateCartQuantity(item.productId, item.quantity + 1);
                            }}
                          >
                            <Plus className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>

                      </div>
                    </div>
                  </SwipeableCartItem>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Savings banner */}
          {totalSavings > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="flex items-center gap-2.5 p-3.5 bg-green-50 dark:bg-green-950/40 rounded-xl border border-green-200 dark:border-green-800/60"
            >
              <Gift className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                Вы экономите: {formatPrice(totalSavings)}
              </span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom sticky checkout button */}
      <div ref={bottomSummaryRef} className="fixed bottom-[4.5rem] left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t safe-area-bottom z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <Button
            className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-brand to-brand/85 hover:from-brand/90 hover:to-brand/75 text-brand-foreground shadow-lg shadow-brand/25 hover:shadow-brand/35 active:scale-[0.98] transition-all"
            size="lg"
            onClick={() => setCurrentView('checkout', true)}
          >
            Оформить заказ · {formatPrice(finalTotal)}
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
