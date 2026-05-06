'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useShopStore, Product, AddToCartResult } from '@/stores/shop-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Heart,
  Star,
  Check,
  AlertCircle,
  Truck,
  ChevronLeft,
  ChevronRight,
  Package,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ProductCard } from './product-card';
import { CartStepper } from './cart-stepper';
import { useToast } from '@/hooks/use-toast';

interface ProductDetailViewProps {
  productId: string;
  onBack: () => void;
}

export function ProductDetailView({ productId, onBack }: ProductDetailViewProps) {
  const { addToCart, updateCartQuantity, toggleFavorite, isFavorite, isInCart, getCartQuantity, setSelectedProduct } = useShopStore();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [activeTab, setActiveTab] = useState('description');
  const [loading, setLoading] = useState(true);
  const [imageDirection, setImageDirection] = useState<'left' | 'right'>('right');
  const [isImageTransitioning, setIsImageTransitioning] = useState(false);
  const [priceAnimated, setPriceAnimated] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const imagesCountRef = useRef(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  // Smooth scroll to top when entering the view
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Reset states on product change
    setSelectedImage(0);
    setPriceAnimated(false);
  }, [productId]);

  // Animate price on load
  useEffect(() => {
    if (!loading && product) {
      const timer = setTimeout(() => setPriceAnimated(true), 100);
      return () => clearTimeout(timer);
    }
  }, [loading, product]);

  // Touch swipe for main image carousel
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };
  const handleTouchMove = () => {
    // no-op, just tracking
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || imagesCountRef.current <= 1) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    if (Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        setImageDirection('right');
        goToImage(selectedImage + 1);
      } else {
        setImageDirection('left');
        goToImage(selectedImage - 1);
      }
    }
    touchStartXRef.current = null;
  };

  const goToImage = useCallback((index: number) => {
    if (index < 0 || index >= imagesCountRef.current) return;
    setIsImageTransitioning(true);
    setSelectedImage(index);
    setTimeout(() => setIsImageTransitioning(false), 350);
  }, []);

  const handlePrevImage = () => {
    setImageDirection('left');
    goToImage(selectedImage - 1);
  };

  const handleNextImage = () => {
    setImageDirection('right');
    goToImage(selectedImage + 1);
  };

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/products/${productId}`);
        const data = await res.json();
        setProduct(data);
        // We'll fetch related products separately from the API
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  // Fetch related products from the same category
  useEffect(() => {
    if (!product?.categoryId) return;
    
    const fetchRelated = async () => {
      setRelatedLoading(true);
      try {
        const res = await fetch(`/api/products?categoryId=${product.categoryId}&limit=6&excludeId=${product.id}`);
        const data = await res.json();
        setRelatedProducts(data.products || []);
      } catch (error) {
        console.error('Error fetching related products:', error);
        // Fallback to the embedded relatedProducts from the product detail endpoint
        setRelatedProducts([]);
      } finally {
        setRelatedLoading(false);
      }
    };

    fetchRelated();
  }, [product?.categoryId, product?.id]);

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header skeleton */}
        <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center justify-between p-2">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pb-4">
          <div className="pb-4">
            {/* Main image skeleton */}
            <Skeleton className="aspect-square w-full" />

            {/* Thumbnail row skeleton */}
            <div className="flex gap-2 p-3">
              <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
              <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
              <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
              <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
            </div>

            <div className="px-3 space-y-3">
              {/* Title skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-6 w-4/5 rounded" />
                <Skeleton className="h-5 w-2/5 rounded" />
              </div>

              {/* Price + badges skeleton */}
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-28 rounded" />
                <Skeleton className="h-6 w-20 rounded" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>

              {/* Rating skeleton */}
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-4 rounded" />
                </div>
                <Skeleton className="h-4 w-24 rounded" />
              </div>

              {/* Stock status skeleton */}
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>

              <Skeleton className="h-px w-full" />

              {/* Tabs skeleton */}
              <div className="space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" />
                <div className="space-y-2 pt-1">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-11/12 rounded" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                </div>
              </div>

              {/* Related products skeleton */}
              <Skeleton className="h-px w-full" />
              <div className="space-y-3">
                <Skeleton className="h-6 w-40 rounded" />
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-3 p-3 rounded-xl border bg-card">
                      <Skeleton className="aspect-square rounded-lg" />
                      <Skeleton className="h-4 w-3/4 rounded" />
                      <Skeleton className="h-5 w-1/2 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom action bar skeleton */}
        <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-4 pb-[4.5rem]">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Package className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Товар не найден</p>
        <Button onClick={onBack}>Вернуться в каталог</Button>
      </div>
    );
  }

  let imagesRaw: string[] = [];
  try {
    imagesRaw = product.images ? JSON.parse(product.images) : [];
    if (!Array.isArray(imagesRaw)) imagesRaw = [];
  } catch {
    imagesRaw = [];
  }
  const images = imagesRaw.length > 0 ? imagesRaw : ['/placeholder-product.svg'];
  const hasMultipleImages = images.length > 1;
  // Update ref for touch handlers
  imagesCountRef.current = images.length;
  const hasDiscount = product.discountPrice && product.discountPrice < (product.price || 0);
  const discountPercent = hasDiscount
    ? Math.round((1 - (product.discountPrice || 0) / (product.price || 1)) * 100)
    : 0;
  const currentPrice = product.discountPrice || product.price || 0;

  // Stock logic with color coding
  const stock = product.stock || 0;
  const outOfStock = stock === 0;
  const cartQuantity = getCartQuantity(product.id);
  const remainingStock = Math.max(0, stock - cartQuantity);
  const currentIsInCart = isInCart(product.id);
  
  // Stock color coding: green >10, amber 5-10, red 1-5
  const stockLevel = outOfStock ? 'none' : stock > 10 ? 'high' : stock >= 5 ? 'medium' : 'low';
  const stockColorMap = {
    none: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-500', text: 'text-red-600 dark:text-red-400', icon: 'text-red-600 dark:text-red-400' },
    low: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-500', text: 'text-red-600 dark:text-red-400', icon: 'text-red-600 dark:text-red-400' },
    medium: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-500', text: 'text-amber-600 dark:text-amber-400', icon: 'text-amber-600 dark:text-amber-400' },
    high: { bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-500', text: 'text-green-600 dark:text-green-400', icon: 'text-green-600 dark:text-green-400' },
  };
  const stockColors = stockColorMap[stockLevel];

  // Cart callbacks for the main product's CartStepper
  const handleCartAdd = (): AddToCartResult => {
    const result = addToCart(product);

    if (result.success) {
      toast({ title: 'Добавлено в корзину', description: product.name });
    }

    return result;
  };

  const handleCartRemove = () => {
    if (cartQuantity <= 1) {
      updateCartQuantity(product.id, 0);
    } else {
      updateCartQuantity(product.id, cartQuantity - 1);
    }
  };

  const handleToggleFavorite = () => {
    toggleFavorite(product.id);
  };


  const handleRelatedAddToCart = (p: Product): AddToCartResult => {
    const result = addToCart(p);

    if (result.success) {
      toast({
        title: 'Добавлено в корзину',
        description: p.name,
      });
    }

    return result;
  };

  const handleRelatedDecrementCart = (pid: string) => {
    const qty = getCartQuantity(pid);
    if (qty <= 1) {
      updateCartQuantity(pid, 0);
    } else {
      updateCartQuantity(pid, qty - 1);
    }
  };

  const handleRelatedToggleFavorite = (pid: string, _productName: string) => {
    toggleFavorite(pid);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between p-2">
          <Button variant="ghost" size="icon" aria-label="Назад" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={isFavorite(product.id) ? 'Удалить из избранного' : 'Добавить в избранное'}
              onClick={handleToggleFavorite}
            >
              <Heart
                className={cn(
                  'h-5 w-5 transition-all duration-200',
                  isFavorite(product.id) && 'fill-red-500 text-red-500 scale-110'
                )}
              />
            </Button>

          </div>
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto pb-14 scroll-smooth">
        <div className="pb-3">
          {/* Enhanced Image gallery with smooth transitions */}
          <div
            ref={galleryRef}
            className="relative aspect-square bg-muted overflow-hidden"
            onTouchStart={hasMultipleImages ? handleTouchStart : undefined}
            onTouchMove={hasMultipleImages ? handleTouchMove : undefined}
            onTouchEnd={hasMultipleImages ? handleTouchEnd : undefined}
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {/* Image with slide transition */}
            <div className="relative w-full h-full overflow-hidden">
              {images.map((img: string, idx: number) => (
                <img
                  key={idx}
                  src={img}
                  alt={`${product.name} ${idx + 1}`}
                  className={cn(
                    'absolute inset-0 w-full h-full object-cover transition-all duration-300 ease-out',
                    idx === selectedImage
                      ? 'opacity-100 scale-100 translate-x-0'
                      : idx < selectedImage
                        ? 'opacity-0 scale-95 -translate-x-8'
                        : 'opacity-0 scale-95 translate-x-8'
                  )}
                  draggable={false}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-product.svg';
                  }}
                />
              ))}
            </div>

            {/* Navigation arrows for desktop / larger screens */}
            {hasMultipleImages && (
              <>
                {selectedImage > 0 && (
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 dark:bg-gray-800/80 shadow-md backdrop-blur-sm transition-all hover:bg-white dark:hover:bg-gray-800 active:scale-95"
                    onClick={handlePrevImage}
                    aria-label="Предыдущее фото"
                  >
                    <ChevronLeft className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                  </button>
                )}
                {selectedImage < images.length - 1 && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 dark:bg-gray-800/80 shadow-md backdrop-blur-sm transition-all hover:bg-white dark:hover:bg-gray-800 active:scale-95"
                    onClick={handleNextImage}
                    aria-label="Следующее фото"
                  >
                    <ChevronRight className="h-4 w-4 text-gray-700 dark:text-gray-300" />
                  </button>
                )}
              </>
            )}

            {/* Badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
              {product.isNew && (
                <Badge className="bg-green-500 dark:bg-green-600 text-white shadow-sm">Новинка</Badge>
              )}
              {hasDiscount && (
                <Badge variant="destructive" className="shadow-sm animate-pulse">-{discountPercent}%</Badge>
              )}
              {outOfStock && (
                <Badge variant="secondary" className="bg-gray-500 dark:bg-gray-600 text-white dark:text-gray-200 shadow-sm">
                  Нет в наличии
                </Badge>
              )}
            </div>

            {/* Image counter for multiple images */}
            {hasMultipleImages && (
              <div className="absolute top-4 right-4 z-10">
                <span className="text-xs font-medium bg-black/50 backdrop-blur-sm text-white rounded-full px-2.5 py-1">
                  {selectedImage + 1}/{images.length}
                </span>
              </div>
            )}

            {/* Dot indicators with progress bar style */}
            {hasMultipleImages && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                {images.map((_: string, idx: number) => (
                  <button
                    key={idx}
                    type="button"
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      idx === selectedImage
                        ? 'w-6 bg-white/90 dark:bg-gray-400/90'
                        : 'w-1.5 bg-white/40 dark:bg-gray-500/40 hover:bg-white/60'
                    )}
                    onClick={() => {
                      setImageDirection(idx > selectedImage ? 'right' : 'left');
                      goToImage(idx);
                    }}
                    aria-label={`Фото ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Image thumbnails with active indicator */}
          {images.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto">
              {images.map((img: string, index: number) => (
                <button
                  key={index}
                  className={cn(
                    'w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all duration-200',
                    selectedImage === index
                      ? 'border-primary ring-2 ring-primary/20 scale-105'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  )}
                  onClick={() => {
                    setImageDirection(index > selectedImage ? 'right' : 'left');
                    goToImage(index);
                  }}
                >
                  <img
                    src={img}
                    alt={`${product.name} ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-product.svg';
                    }}
                  />
                </button>
              ))}
            </div>
          )}

          <div className="px-3 space-y-3">
            {/* Title and price */}
            <div>
              <h1 className="text-xl font-bold mb-2">{product.name}</h1>
              {product.category && (
                <p className="text-sm text-muted-foreground mb-2">
                  {product.category.name}
                </p>
              )}
              
              {/* Animated price display */}
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={cn(
                  'text-2xl font-bold transition-all duration-500',
                  hasDiscount && priceAnimated ? 'text-red-600 dark:text-red-400' : '',
                  !priceAnimated ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
                )}>
                  {currentPrice.toLocaleString('ru-RU')} ₽
                </span>
                {hasDiscount && (
                  <span className={cn(
                    'text-lg text-muted-foreground line-through transition-all duration-500 delay-150',
                    !priceAnimated ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
                  )}>
                    {product.price.toLocaleString('ru-RU')} ₽
                  </span>
                )}
                {hasDiscount && (
                  <Badge 
                    variant="destructive" 
                    className={cn(
                      'transition-all duration-500 delay-300',
                      !priceAnimated ? 'opacity-0 scale-75' : 'opacity-100 scale-100'
                    )}
                  >
                    -{discountPercent}%
                  </Badge>
                )}
              </div>

              {/* Savings callout for discounted items */}
              {hasDiscount && priceAnimated && (
                <p className={cn(
                  'text-sm font-medium text-green-600 dark:text-green-400 mt-1 transition-all duration-500 delay-500',
                  !priceAnimated ? 'opacity-0' : 'opacity-100'
                )}>
                  Вы экономите {((product.price || 0) - currentPrice).toLocaleString('ru-RU')} ₽
                </p>
              )}

              {/* Rating */}
              {product.rating > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn(
                          'h-4 w-4 transition-colors',
                          star <= Math.round(product.rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300 dark:text-gray-600'
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {product.rating.toFixed(1)} ({product.reviewCount} отзывов)
                  </span>
                </div>
              )}
            </div>

            {/* Delivery estimate — only when in stock */}
            {stock > 0 && (
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Доставка сегодня · Бесплатно от 1000₽</span>
              </div>
            )}

            {/* Enhanced stock status with color coding */}
            <div className={cn(
              'flex items-center gap-2 rounded-lg p-2.5 transition-colors',
              stockColors.bg,
              stockColors.border
            )} style={{ borderLeftWidth: '3px' }}>
              {outOfStock ? (
                <>
                  <AlertCircle className={cn('h-4 w-4', stockColors.icon)} />
                  <span className={cn('text-sm font-medium', stockColors.text)}>
                    Нет в наличии
                  </span>
                </>
              ) : stockLevel === 'low' ? (
                <>
                  <AlertCircle className={cn('h-4 w-4', stockColors.icon)} />
                  <span className={cn('text-sm font-medium', stockColors.text)}>
                    Осталось мало ({stock} шт.)
                    {cartQuantity > 0 && (
                      <span className="text-muted-foreground font-normal"> · в корзине: {cartQuantity} шт.</span>
                    )}
                  </span>
                </>
              ) : stockLevel === 'medium' ? (
                <>
                  <Check className={cn('h-4 w-4', stockColors.icon)} />
                  <span className={cn('text-sm font-medium', stockColors.text)}>
                    В наличии ({stock} шт.)
                    {cartQuantity > 0 && (
                      <span className="text-muted-foreground font-normal"> · в корзине: {cartQuantity} шт.</span>
                    )}
                  </span>
                </>
              ) : (
                <>
                  <Check className={cn('h-4 w-4', stockColors.icon)} />
                  <span className={cn('text-sm font-medium', stockColors.text)}>
                    В наличии ({stock} шт.)
                    {cartQuantity > 0 && (
                      <span className="text-muted-foreground font-normal"> · в корзине: {cartQuantity} шт.</span>
                    )}
                  </span>
                </>
              )}
            </div>

            <Separator />

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="description" className="flex-1">Описание</TabsTrigger>
                <TabsTrigger value="specs" className="flex-1">Характеристики</TabsTrigger>
              </TabsList>
              <TabsContent value="description" className="mt-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {product.description || 'Описание отсутствует'}
                </p>
              </TabsContent>
              <TabsContent value="specs" className="mt-4">
                <SpecsList attributes={product.attributes} />
              </TabsContent>
            </Tabs>

            {/* Related products */}
            {(relatedProducts.length > 0 || relatedLoading) && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 text-lg">Похожие товары</h3>
                  {relatedLoading ? (
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="space-y-3 p-3 rounded-xl border bg-card">
                          <Skeleton className="aspect-square rounded-lg" />
                          <Skeleton className="h-4 w-3/4 rounded" />
                          <Skeleton className="h-5 w-1/2 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {relatedProducts.map((p) => (
                        <ProductCard
                          key={p.id}
                          variant="compact"
                          product={p}
                          onClick={() => setSelectedProduct(p.id)}
                          onAddToCart={handleRelatedAddToCart}
                          onRemoveFromCart={handleRelatedDecrementCart}
                          onToggleFavorite={(id) => handleRelatedToggleFavorite(id, p.name)}
                          isFavorite={isFavorite(p.id)}
                          isInCart={isInCart(p.id)}
                          cartQuantity={getCartQuantity(p.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* ── Bottom action bar — unified CartStepper (lg) ── */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-4 pb-[4.5rem] z-10">
        <CartStepper
          product={product}
          isInCart={currentIsInCart}
          cartQuantity={cartQuantity}
          onAdd={handleCartAdd}
          onRemove={handleCartRemove}
          size="lg"
          showTotal
        />
        {/* Stock hint — shown only when not in cart and stock is low */}
        {!currentIsInCart && !outOfStock && remainingStock > 0 && remainingStock < 10 && (
          <p className={cn(
            'text-xs text-center mt-2',
            remainingStock <= 5 ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'
          )}>
            Доступно: {remainingStock} шт.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Specs list with collapsible long values ── */

function getAttrIcon(key: string) {
  const k = key.toLowerCase();
  if (k.includes('состав')) return '🧪';
  if (k.includes('пищевая') || k.includes('пищев')) return '📋';
  if (k.includes('энергет')) return '⚡';
  if (k.includes('вес') || k.includes('масса')) return '⚖️';
  if (k.includes('объём') || k.includes('объем') || k.includes('мл') || k.includes('литр') || k.includes('л')) return '🧴';
  if (k.includes('колич') || k.includes('шт') || k.includes('упак')) return '📦';
  if (k.includes('белк') || k.includes('протеин')) return '💪';
  if (k.includes('жиры') || k.includes('жир')) return '🥑';
  if (k.includes('углев') || k.includes('углевод')) return '🍞';
  if (k.includes('калори') || k.includes('ккал')) return '🔥';
  if (k.includes('сахар')) return '🍬';
  if (k.includes('кофеин')) return '☕';
  if (k.includes('клетчат')) return '🥬';
  if (k.includes('готовк') || k.includes('варк')) return '⏱️';
  if (k.includes('срок') || k.includes('хран')) return '📅';
  if (k.includes('производ') || k.includes('бренд') || k.includes('стран')) return '🏭';
  return '•';
}

function parseAttributes(attributes: string | null): Array<{ key: string; value: string }> {
  if (!attributes) return [];
  try {
    const parsed = JSON.parse(attributes);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((a) => a.name || a.value)
        .map((a) => ({ key: a.name || '', value: a.value || '' }));
    }
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.entries(parsed)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => ({ key: k, value: String(v) }));
    }
  } catch { /* ignore */ }
  return [];
}

function SpecRow({ attr }: { attr: { key: string; value: string } }) {
  const [expanded, setExpanded] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if (el) {
        setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
      }
    });
  }, [attr.value]);

  const clampedStyle: React.CSSProperties = !expanded
    ? {
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }
    : {};

  return (
    <div className="flex gap-3 px-3 py-2.5 rounded-lg bg-muted/40 dark:bg-muted/20">
      <span className="text-base leading-none shrink-0 w-6 text-center pt-[2px]">
        {getAttrIcon(attr.key)}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] text-muted-foreground leading-snug block">
          {attr.key}
        </span>
        <div className="mt-0.5">
          <span
            ref={textRef}
            className="text-[13px] font-semibold text-foreground leading-snug block"
            style={clampedStyle}
          >
            {attr.value}
          </span>
          {isOverflowing && (
            <button
              type="button"
              className="mt-1 text-[11px] text-brand font-medium cursor-pointer"
              onClick={() => setExpanded(prev => !prev)}
              aria-label={expanded ? 'Свернуть' : 'Развернуть'}
            >
              {expanded ? 'Свернуть' : 'Ещё'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SpecsList({ attributes }: { attributes: string | null }) {
  const attrs = parseAttributes(attributes);

  if (attrs.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">Характеристики не указаны</p>;
  }

  return (
    <div className="space-y-2">
      {attrs.map((attr, index) => (
        <SpecRow key={index} attr={attr} />
      ))}
    </div>
  );
}
