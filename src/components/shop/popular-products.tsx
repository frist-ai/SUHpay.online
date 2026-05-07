'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useShopStore, Product, AddToCartResult } from '@/stores/shop-store';
import { cn } from '@/lib/utils';
import { Sparkles, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface PopularProductsProps {
  /** Extra class name for the wrapper */
  className?: string;
}

/**
 * Shared popular-products horizontal scroll strip.
 * Fetches ALL `isFeatured` products, falls back to any available.
 * Compact card size for empty-state views (cart, orders, favorites).
 */
export function PopularProducts({ className }: PopularProductsProps) {
  const {
    addToCart,
    setSelectedProduct,
    isInCart,
    getCartQuantity,
    updateCartQuantity,
  } = useShopStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'done' | 'error'>('loading');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // ── Fetch ALL popular (featured) products ─────────────────────────────
  useEffect(() => {
    async function fetchPopular() {
      try {
        // First try: featured products only (no limit → get all)
        let res = await fetch('/api/products?featured=true');
        let data = await res.json();
        let list = (data.products || []) as Product[];

        // Fallback: if no featured products, get any available
        if (list.length === 0) {
          res = await fetch('/api/products');
          data = await res.json();
          list = (data.products || []) as Product[];
        }

        setProducts(list);
        setLoadState('done');
      } catch {
        setLoadState('error');
      }
    }
    void fetchPopular();
  }, []);

  // ── Scroll state tracking ──────────────────────────────────────────────
  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      return () => el.removeEventListener('scroll', checkScroll);
    }
  }, [checkScroll, products]);

  const scrollBy = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    // Scroll by ~2 card widths
    const cardWidth = scrollRef.current.clientWidth / 4;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -cardWidth * 2 : cardWidth * 2,
      behavior: 'smooth',
    });
  };

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleProductClick = (productId: string) => setSelectedProduct(productId);

  const handleAddToCart = (product: Product): AddToCartResult => addToCart(product);

  const handleRemoveFromCart = (productId: string) => {
    const qty = getCartQuantity(productId);
    if (qty <= 1) updateCartQuantity(productId, 0);
    else updateCartQuantity(productId, qty - 1);
  };

  // ── Product image helper ───────────────────────────────────────────────
  const getProductImage = (product: Product): string => {
    try {
      const imgs = product.images ? JSON.parse(product.images) : [];
      return Array.isArray(imgs) && imgs[0] ? imgs[0] : '/placeholder-product.svg';
    } catch { return '/placeholder-product.svg'; }
  };

  // ── Render a single product card ───────────────────────────────────────
  const renderCard = (product: Product) => {
    const inCart = isInCart(product.id);
    const qty = getCartQuantity(product.id);
    const price = product.discountPrice || product.price;

    return (
      <div
        key={product.id}
        className="flex-shrink-0 w-[calc(25%-3px)] rounded-lg bg-muted/40 dark:bg-muted/20 border border-border/30 hover:border-border/60 transition-colors overflow-hidden"
      >
        {/* Thumbnail */}
        <button
          onClick={() => handleProductClick(product.id)}
          className="w-full aspect-square bg-muted/60 overflow-hidden"
        >
          <img
            src={getProductImage(product)}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.svg'; }}
          />
        </button>
        {/* Info row */}
        <div className="p-1 flex flex-col gap-px">
          <p className="text-[8px] font-medium leading-tight line-clamp-1 text-foreground/80">{product.name}</p>
          <div className="flex items-end justify-between gap-0.5">
            <span className="text-[9px] font-bold">{price.toLocaleString('ru-RU')} ₽</span>
            {/* Add button */}
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {inCart ? (
                <div className="flex items-center">
                  <button
                    onClick={() => handleRemoveFromCart(product.id)}
                    className="w-3.5 h-3.5 rounded-sm bg-muted/80 dark:bg-muted/40 flex items-center justify-center text-foreground/70 active:scale-95 transition-all text-[8px] font-bold leading-none"
                  >
                    −
                  </button>
                  <span className="text-[7px] font-semibold w-2 text-center leading-none">{qty}</span>
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="w-3.5 h-3.5 rounded-sm bg-muted/80 dark:bg-muted/40 flex items-center justify-center text-foreground/70 active:scale-95 transition-all text-[8px] font-bold leading-none"
                  >
                    +
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleAddToCart(product)}
                  className="w-3.5 h-3.5 rounded-sm bg-brand/15 text-brand hover:bg-brand/25 active:scale-95 transition-all flex items-center justify-center"
                >
                  <Plus className="h-2 w-2" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (loadState === 'loading') {
    return (
      <div className={cn('mt-3 w-full', className)}>
        <p className="text-[10px] font-medium text-muted-foreground mb-1.5 text-center flex items-center justify-center gap-1">
          <Sparkles className="h-2.5 w-2.5" />
          Популярные товары
        </p>
        <div className="flex gap-1 overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[calc(25%-3px)] rounded-lg bg-muted/50 animate-pulse overflow-hidden">
              <div className="aspect-square bg-muted" />
              <div className="p-1 space-y-0.5">
                <div className="h-1.5 bg-muted rounded w-3/4" />
                <div className="h-1.5 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadState === 'error' || products.length === 0) return null;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <motion.div
      className={cn('mt-3 w-full', className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      {/* Title */}
      <p className="text-[10px] font-medium text-muted-foreground mb-1.5 text-center flex items-center justify-center gap-1">
        <Sparkles className="h-2.5 w-2.5" />
        Популярные товары
      </p>

      {/* Scrollable strip */}
      <div className="relative">
        {/* Left fade + arrow */}
        {canScrollLeft && (
          <>
            <div className="absolute top-0 left-0 bottom-0 w-5 bg-gradient-to-r from-background to-transparent pointer-events-none z-10 rounded-l-lg" />
            <button
              onClick={() => scrollBy('left')}
              className="absolute top-1/2 -translate-y-1/2 left-0.5 z-20 w-5 h-5 rounded-full bg-background/90 dark:bg-gray-800/90 shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 transition-all"
              aria-label="Назад"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
          </>
        )}

        {/* Horizontal scroll strip */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto scroll-smooth gap-1 pb-0.5"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.map(renderCard)}
        </div>

        {/* Right fade + arrow */}
        {canScrollRight && (
          <>
            <div className="absolute top-0 right-0 bottom-0 w-5 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 rounded-r-lg" />
            <button
              onClick={() => scrollBy('right')}
              className="absolute top-1/2 -translate-y-1/2 right-0.5 z-20 w-5 h-5 rounded-full bg-background/90 dark:bg-gray-800/90 shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 transition-all"
              aria-label="Вперёд"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
