'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { Product, AddToCartResult } from '@/stores/shop-store';
import { Minus, Plus, ShoppingCart, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

/**
 * Unified CartStepper component — Samokat-style add/remove from cart.
 *
 * States:
 *  - out of stock  → gray disabled pill
 *  - not in cart   → green pill with price + "+"
 *  - success flash → green pill with checkmark (brief)
 *  - in cart       → green connected strip  "− qty +"
 *
 * Sizes: sm (compact cards), md (horizontal cards), lg (product detail bar)
 */

export interface CartStepperProps {
  product: Product;
  isInCart: boolean;
  cartQuantity: number;
  onAdd: () => AddToCartResult | void;
  onRemove: () => void;
  /** 'sm' = compact card, 'md' = horizontal card, 'lg' = product detail */
  size?: 'sm' | 'md' | 'lg';
  /** Extra class on the outer wrapper */
  className?: string;
  /** Show price label alongside quantity when in cart (lg only) */
  showTotal?: boolean;
  /** Stretch stepper to fill parent width (compact card use) */
  fullWidth?: boolean;
}

export function CartStepper({
  product,
  isInCart,
  cartQuantity,
  onAdd,
  onRemove,
  size = 'md',
  className,
  showTotal = false,
  fullWidth = false,
}: CartStepperProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const successTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { toast } = useToast();

  // Computed
  const stock = product.stock || 0;
  const outOfStock = stock === 0;
  const remainingStock = Math.max(0, stock - cartQuantity);
  const canAddMore = remainingStock > 0;

  const hasDiscount = product.discountPrice && product.discountPrice < (product.price || 0);
  const displayPrice = product.discountPrice || product.price || 0;
  const totalPrice = displayPrice * cartQuantity;

  // Show out-of-stock toast (centralized — covers all callers: catalog, favorites, product detail, related)
  const showOutOfStockToast = useCallback(() => {
    toast({
      title: 'Товар закончился',
      description: product.name,
      variant: 'out-of-stock',
      duration: 2000,
    });
  }, [toast, product.name]);

  // Handlers
  const handleAdd = useCallback(
    (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      if (outOfStock || !canAddMore) {
        showOutOfStockToast();
        return;
      }
      const result = onAdd();
      if (result && !result?.success) {
        showOutOfStockToast();
        return;
      }
      // Success animation is handled by the useEffect above (isInCart transition)
      // But also trigger for external callers that don't change isInCart
      if (!result || result?.success) {
        setShowSuccess(true);
        clearTimeout(successTimer.current);
        successTimer.current = setTimeout(() => setShowSuccess(false), 600);
      }
    },
    [outOfStock, canAddMore, onAdd, showOutOfStockToast]
  );

  const handleRemove = useCallback(
    (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      onRemove();
    },
    [onRemove]
  );

  // ── Size-specific dimensions ──
  const dims = useMemo(() => {
    switch (size) {
      case 'sm':
        return { height: 'h-8', icon: 'h-3.5 w-3.5', iconStroke: 2.5, text: 'text-[11px]', qtyText: 'text-[11px]', radius: 'rounded-full', px: 'px-2', gap: 'gap-0.5' };
      case 'lg':
        return { height: 'h-12', icon: 'h-5 w-5', iconStroke: 2, text: 'text-base', qtyText: 'text-lg', radius: 'rounded-xl', px: 'px-4', gap: 'gap-2' };
      default:
        return { height: 'h-8', icon: 'h-4 w-4', iconStroke: 2.5, text: 'text-sm', qtyText: 'text-sm', radius: 'rounded-lg', px: 'px-3', gap: 'gap-1' };
    }
  }, [size]);

  // ══════════════════════════════════════════════════════════════════════
  // OUT OF STOCK — clickable, shows red toast on tap
  // ══════════════════════════════════════════════════════════════════════
  if (outOfStock) {
    return (
      <button
        type="button"
        aria-label="Товар закончился"
        className={cn(
          'flex items-center justify-center',
          dims.height,
          dims.radius,
          size === 'sm' ? (fullWidth ? 'w-full rounded-lg' : 'w-8') : size === 'lg' ? 'w-full' : 'w-auto px-3',
          'bg-gray-200 dark:bg-gray-700 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all duration-150',
          className
        )}
        onClick={(e) => {
          e?.preventDefault();
          e?.stopPropagation();
          showOutOfStockToast();
        }}
      >
        <Plus className={cn(dims.icon, 'text-gray-400 dark:text-gray-500')} />
      </button>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // SUCCESS FLASH (not in cart but just added — brief)
  // ══════════════════════════════════════════════════════════════════════
  if (showSuccess && !isInCart) {
    return (
      <div className={cn('relative', className)}>
        {/* Pulse ring for md+ sizes */}
        {size !== 'sm' && (
          <div className={cn('absolute inset-0', dims.radius, 'bg-brand animate-[cart-pulse-ring_0.5s_ease-out] opacity-0')} />
        )}
        <div
          className={cn(
            'relative flex items-center justify-center',
            dims.height,
            size === 'sm' ? (fullWidth ? 'w-full' : 'w-7') : size === 'lg' ? 'w-full' : '',
            size === 'sm' && fullWidth ? 'rounded-lg' : dims.radius,
            dims.px,
            'bg-brand text-brand-foreground shadow-sm animate-[cart-pop_0.4s_ease-out]'
          )}
        >
          <Check className={cn(dims.icon, 'stroke-[2.5]')} />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // NOT IN CART — price + "+" button
  // ══════════════════════════════════════════════════════════════════════
  if (!isInCart) {
    // sm: green pill — full width with just + (no price), or circle with +
    if (size === 'sm') {
      if (fullWidth) {
        return (
          <button
            type="button"
            className={cn(
              'w-full flex items-center justify-center',
              'h-7 rounded-lg',
              'bg-brand hover:bg-brand/90 active:bg-brand/80',
              'text-brand-foreground font-semibold text-[11px]',
              'shadow-sm transition-all duration-150',
              'hover:shadow-md active:scale-[0.98]',
              !canAddMore && 'opacity-50 cursor-not-allowed',
              className
            )}
            onClick={handleAdd}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        );
      }
      return (
        <button
          type="button"
          className={cn(
            'flex items-center justify-center',
            'w-8 h-8 rounded-full',
            'bg-brand hover:bg-brand/90 active:bg-brand/80',
            'text-brand-foreground shadow-sm',
            'transition-all duration-150',
            'hover:shadow-md active:scale-95',
            !canAddMore && 'opacity-50 cursor-not-allowed',
            className
          )}
          onClick={handleAdd}
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} />
        </button>
      );
    }

    // md & lg: price + "+" pill
    if (size === 'lg') {
      return (
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-center',
            'h-12 rounded-xl',
            'bg-brand hover:bg-brand/90 active:bg-brand/80',
            'text-brand-foreground font-semibold text-base',
            'shadow-sm transition-all duration-150',
            'hover:shadow-md active:scale-[0.98]',
            !canAddMore && 'opacity-50 cursor-not-allowed',
            className
          )}
          onClick={handleAdd}
        >
          <ShoppingCart className="h-5 w-5 mr-2" strokeWidth={2} />
          <span className="tabular-nums">{displayPrice.toLocaleString('ru-RU')} ₽</span>
        </button>
      );
    }

    // md: compact + button (no price — price shown on the card)
    return (
      <button
        type="button"
        className={cn(
          'flex items-center justify-center',
          'h-8 w-8 rounded-lg',
          'bg-brand hover:bg-brand/90 active:bg-brand/80',
          'text-brand-foreground shadow-sm',
          'transition-all duration-150',
          'hover:shadow-md active:scale-95',
          !canAddMore && 'opacity-50 cursor-not-allowed',
          className
        )}
        onClick={handleAdd}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
      </button>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // IN CART — green accent stepper "− qtyшт +"
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div
      className={cn(
        'flex items-center',
        dims.height,
        dims.radius,
        'border border-brand/20 bg-brand/5 dark:bg-brand/10 transition-all duration-200',
        (size === 'lg' || fullWidth) ? 'w-full' : '',
        size === 'sm' && fullWidth ? 'rounded-lg' : '',
        showSuccess && 'animate-[cart-pop_0.3s_ease-out]',
        className
      )}
    >
      {/* Minus button */}
      <button
        type="button"
        aria-label="Уменьшить количество"
        className={cn(
          'flex items-center justify-center text-foreground',
          'hover:bg-brand/10 active:bg-brand/20 dark:hover:bg-brand/15 dark:active:bg-brand/25',
          'transition-colors duration-100',
          size === 'sm' ? (fullWidth ? 'flex-1 rounded-l-lg' : 'w-8 rounded-full') : size === 'lg' ? 'w-14 rounded-l-xl' : 'w-8 rounded-l-lg'
        )}
        onClick={handleRemove}
      >
        <Minus className={dims.icon} strokeWidth={dims.iconStroke} />
      </button>

      {/* Quantity + шт */}
      <span
        className={cn(
          'text-center font-bold text-foreground select-none tabular-nums',
          size === 'sm' ? (fullWidth ? 'flex-1 text-[11px]' : 'text-[10px] min-w-[1.25rem]') : size === 'lg' ? 'text-sm min-w-[2rem] px-1' : 'text-xs min-w-[1.5rem]'
        )}
      >
        {cartQuantity}шт
      </span>

      {/* Plus button */}
      <button
        type="button"
        aria-label="Увеличить количество"
        className={cn(
          'flex items-center justify-center text-foreground',
          'hover:bg-brand/10 active:bg-brand/20 dark:hover:bg-brand/15 dark:active:bg-brand/25',
          'transition-colors duration-100',
          !canAddMore && 'opacity-30 cursor-not-allowed hover:bg-transparent',
          size === 'sm' ? (fullWidth ? 'flex-1 rounded-r-lg' : 'w-8 rounded-full') : size === 'lg' ? 'w-14 rounded-r-xl' : 'w-8 rounded-r-lg'
        )}
        onClick={canAddMore ? handleAdd : showOutOfStockToast}
      >
        <Plus className={dims.icon} strokeWidth={dims.iconStroke} />
      </button>

      {/* Total price (lg only) */}
      {showTotal && size === 'lg' && (
        <div className="ml-auto pr-3 flex items-center gap-1">
          <span className="text-foreground/50 text-sm">·</span>
          <span className="text-foreground font-semibold text-sm tabular-nums">
            {totalPrice.toLocaleString('ru-RU')} ₽
          </span>
        </div>
      )}

      {/* Stock hint (lg only) */}
      {size === 'lg' && remainingStock > 0 && remainingStock <= 5 && (
        <span className="text-foreground/60 text-xs mr-2 whitespace-nowrap">
          {remainingStock} шт.
        </span>
      )}
    </div>
  );
}

