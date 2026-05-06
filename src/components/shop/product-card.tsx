'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Product, AddToCartResult } from '@/stores/shop-store';
import { Heart, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartStepper } from './cart-stepper';

interface ProductCardProps {
  product: Product;
  variant?: 'horizontal' | 'compact';
  onAddToCart?: (product: Product) => AddToCartResult | void;
  onRemoveFromCart?: (productId: string) => void;
  onToggleFavorite?: (productId: string) => void;
  isFavorite?: boolean;
  isInCart?: boolean;
  cartQuantity?: number;
  onClick?: () => void;
}

export function ProductCard({
  product,
  variant = 'horizontal',
  onAddToCart,
  onRemoveFromCart,
  onToggleFavorite,
  isFavorite,
  isInCart,
  cartQuantity = 0,
  onClick,
}: ProductCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Lazy load visibility detection
  useEffect(() => {
    const currentRef = cardRef.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px', threshold: 0.01 }
    );

    observer.observe(currentRef);
    return () => observer.disconnect();
  }, []);

  // Memoize parsed images to avoid JSON.parse on every render
  const images = useMemo(() => {
    if (!isVisible) return [];
    try {
      const parsed = product.images ? JSON.parse(product.images) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [product.images, isVisible]);

  const mainImage = images[0] || '/placeholder-product.svg';
  const currentImage = images[currentImageIndex] || mainImage;
  const hasMultipleImages = images.length > 1;

  // Touch swipe handler for image gallery
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const minSwipe = 30;
    if (Math.abs(diff) < minSwipe) return;
    if (diff > 0 && currentImageIndex < images.length - 1) {
      setCurrentImageIndex((i) => i + 1);
    } else if (diff < 0 && currentImageIndex > 0) {
      setCurrentImageIndex((i) => i - 1);
    }
  }, [currentImageIndex, images.length]);

  // Memoize price calculations
  const hasDiscount = useMemo(
    () => product.discountPrice && product.discountPrice < (product.price || 0),
    [product.discountPrice, product.price]
  );

  const discountPercent = useMemo(
    () =>
      hasDiscount
        ? Math.round((1 - (product.discountPrice || 0) / (product.price || 1)) * 100)
        : 0,
    [hasDiscount, product.discountPrice, product.price]
  );

  const displayPrice = product.discountPrice || product.price || 0;

  // Stock logic
  const stock = product.stock || 0;
  const outOfStock = stock === 0;
  const remainingStock = Math.max(0, stock - cartQuantity);
  const lowStock = stock > 0 && stock <= 5;

  // Cart callbacks — thin wrappers for CartStepper
  const handleCartAdd = useCallback((): AddToCartResult | void => {
    return onAddToCart?.(product);
  }, [onAddToCart, product]);

  const handleCartRemove = useCallback(() => {
    onRemoveFromCart?.(product.id);
  }, [onRemoveFromCart, product.id]);

  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onToggleFavorite?.(product.id);
    },
    [onToggleFavorite, product.id]
  );

  const handleCardClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  // Badge rendering
  const hasAnyBadge = product.isFeatured || product.isNew || hasDiscount;

  // ─── Compact variant (vertical, for horizontal scroll rows) ─────────
  if (variant === 'compact') {
    return (
      <div
          ref={cardRef}
          className={cn(
            'group relative bg-card rounded-2xl border border-border/60 overflow-hidden',
            'transition-shadow duration-300 hover:shadow-lg',
            'cursor-pointer',
            outOfStock && 'opacity-70'
          )}
          onClick={handleCardClick}
        >
          {/* Image */}
          <div
            className="relative aspect-square bg-muted overflow-hidden"
            onTouchStart={hasMultipleImages ? handleTouchStart : undefined}
            onTouchMove={hasMultipleImages ? handleTouchMove : undefined}
            onTouchEnd={hasMultipleImages ? handleTouchEnd : undefined}
          >
            {!isVisible && <div className="h-full w-full bg-muted animate-pulse" />}
            {isVisible && (images.length > 0 && !imageError ? (
              <>
                {!imageLoaded && <div className="absolute inset-0 bg-muted animate-pulse" />}
                <img
                  src={currentImage}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  className={cn('h-full w-full object-cover transition-all duration-300 group-hover:scale-[1.03]', !imageLoaded && 'opacity-0')}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  draggable={false}
                />
              </>
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-muted">
                <Package className="h-10 w-10 text-muted-foreground/30" />
              </div>
            ))}

            {/* Favorite */}
            <button
              type="button"
              aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
              className={cn(
                'absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-white/90 dark:bg-gray-800/90 shadow-sm transition-all hover:scale-110 active:scale-95',
                isFavorite && 'animate-[heart-pop_0.3s_ease]'
              )}
              onClick={handleToggleFavorite}
            >
              <Heart className={cn('h-3.5 w-3.5 transition-colors', isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400 dark:text-gray-500 hover:text-red-400')} />
            </button>

            {/* Badges */}
            {hasAnyBadge && (
              <div className="absolute top-1 left-1 z-10 flex flex-col gap-0.5 items-start">
                {product.isFeatured && (
                  <span className="rounded-md bg-amber-500 text-white text-[7px] font-semibold px-1 py-px leading-none">Хит</span>
                )}
                {product.isNew && (
                  <span className="rounded-md bg-brand text-brand-foreground text-[7px] font-semibold px-1 py-px leading-none">Новинка</span>
                )}
                {hasDiscount && (
                  <span className="rounded-md bg-red-500 text-white text-[7px] font-semibold px-1 py-px leading-none">-{discountPercent}%</span>
                )}
              </div>
            )}

            {outOfStock && (
              <div className="absolute inset-0 bg-black/40 z-[5] flex items-center justify-center">
                <span className="px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg text-white text-xs font-semibold shadow-lg">
                  Нет в наличии
                </span>
              </div>
            )}

            {/* Image dot indicators for multi-image products */}
            {hasMultipleImages && (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-10 flex gap-0.5">
                {images.map((_, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      'w-1 h-1 rounded-full transition-all',
                      idx === currentImageIndex
                        ? 'bg-white/90 dark:bg-gray-400/90 w-2'
                        : 'bg-white/50 dark:bg-gray-500/50'
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="p-1.5 flex flex-col gap-0.5">
            <h3 className="text-[11px] leading-tight line-clamp-2 min-h-[1.75rem] text-foreground/90 font-medium">{product.name}</h3>
            {/* Price row — current price + strikethrough old price on one line */}
            <div className="flex items-baseline gap-1 min-w-0">
              <span className="text-[13px] font-bold tabular-nums">{displayPrice.toLocaleString('ru-RU')} ₽</span>
              {hasDiscount && (
                <span className="text-[10px] text-muted-foreground line-through tabular-nums shrink-0">{(product.price || 0).toLocaleString('ru-RU')} ₽</span>
              )}
            </div>
            {/* Stepper row — full width below price */}
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              <CartStepper
                product={product}
                isInCart={!!isInCart}
                cartQuantity={cartQuantity}
                onAdd={handleCartAdd}
                onRemove={handleCartRemove}
                size="sm"
                fullWidth
              />
            </div>
          </div>
        </div>
    );
  }

  // ─── Horizontal variant (Samokat-style) ─────────────────────────────
  return (
    <div
        ref={cardRef}
        className={cn(
          'group relative bg-card rounded-xl border border-border/50 overflow-hidden',
          'transition-shadow duration-300 hover:shadow-md',
          'cursor-pointer',
          outOfStock && 'opacity-70'
        )}
        onClick={handleCardClick}
      >
        <div className="flex">
          {/* ── Image (left side) ── */}
          <div className="relative w-[100px] flex-shrink-0 bg-muted">
            {!isVisible && <div className="h-full w-full bg-muted animate-pulse" />}
            {isVisible && (images.length > 0 && !imageError ? (
              <>
                {!imageLoaded && <div className="absolute inset-0 bg-muted animate-pulse" />}
                <img
                  src={currentImage}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  className={cn('w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]', !imageLoaded && 'opacity-0')}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <Package className="h-10 w-10 text-muted-foreground/30" />
              </div>
            ))}

            {/* Discount badge — top-right of image */}
            {hasDiscount && (
              <span className="absolute top-1.5 right-1.5 z-10 rounded-md bg-gray-900/80 dark:bg-white/80 text-white dark:text-gray-900 text-[9px] font-semibold px-1.5 py-0.5 leading-none">
                -{discountPercent}%
              </span>
            )}

            {/* Category badges — top-left of image */}
            {(product.isNew || product.isFeatured) && (
              <div className="absolute top-1.5 left-1.5 z-10 flex flex-col gap-0.5">
                {product.isFeatured && (
                  <span className="rounded-md bg-amber-500 text-white text-[8px] font-semibold px-1 py-px leading-none">Хит</span>
                )}
                {product.isNew && (
                  <span className="rounded-md bg-brand text-brand-foreground text-[8px] font-semibold px-1 py-px leading-none">Новинка</span>
                )}
              </div>
            )}

            {/* Favorite */}
            <button
              type="button"
              aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
              className={cn(
                'absolute bottom-1.5 left-1.5 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-white/90 dark:bg-gray-800/90 shadow-sm transition-all hover:scale-110 active:scale-95',
                isFavorite && 'animate-[heart-pop_0.3s_ease]'
              )}
              onClick={handleToggleFavorite}
            >
              <Heart className={cn('h-3.5 w-3.5 transition-colors', isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400 dark:text-gray-500 hover:text-red-400')} />
            </button>

            {outOfStock && (
              <div className="absolute inset-0 bg-black/40 z-[5] flex items-center justify-center">
                <span className="px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-lg text-white text-[10px] font-semibold shadow-lg">
                  Нет в наличии
                </span>
              </div>
            )}
          </div>

          {/* ── Content (right side) ── */}
          <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-between gap-2">
            {/* Top: Name */}
            <div className="min-w-0">
              <h3 className="text-sm font-medium leading-snug line-clamp-2 text-foreground">
                {product.name}
              </h3>
              {/* Weight / category */}
              {product.category && (
                <p className="text-xs text-muted-foreground mt-0.5">{product.category.name}</p>
              )}
            </div>

            {/* Bottom: Price + CartStepper */}
            <div className="flex items-end justify-between gap-2 mt-auto">
              {/* Price */}
              <div className="min-w-0">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold tabular-nums">{displayPrice.toLocaleString('ru-RU')} ₽</span>
                </div>
                {hasDiscount && (
                  <span className="text-[10px] text-muted-foreground line-through tabular-nums">
                    {(product.price || 0).toLocaleString('ru-RU')} ₽
                  </span>
                )}
              </div>

              {/* CartStepper (md) — green pill/bar */}
              <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <CartStepper
                  product={product}
                  isInCart={!!isInCart}
                  cartQuantity={cartQuantity}
                  onAdd={handleCartAdd}
                  onRemove={handleCartRemove}
                  size="md"
                />
              </div>
            </div>

            {/* Low stock hint */}
            {!outOfStock && lowStock && isInCart && remainingStock <= 2 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                Осталось {remainingStock} шт.
              </p>
            )}
          </div>
        </div>
      </div>
  );
}
