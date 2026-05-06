'use client';

import { useState, useEffect, useMemo } from 'react';
import { useShopStore, Product, AddToCartResult } from '@/stores/shop-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductCard } from './product-card';
import { EmptyState } from './empty-state';
import { PopularProducts } from './popular-products';
import { ArrowLeft, Trash2, ShoppingCart, PackageCheck, PackageX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

export function FavoritesView() {
  const { favorites, toggleFavorite, addToCart, updateCartQuantity, isInCart, getCartQuantity, setSelectedProduct, setCurrentView } = useShopStore();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingAll, setAddingAll] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      if (favorites.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`/api/products?ids=${favorites.join(',')}`);
        const data = await res.json();
        setProducts(data.products || []);
      } catch (error) {
        console.error('Error fetching favorites:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [favorites]);

  // Note: out-of-stock toast is handled centrally by CartStepper component
  const handleAddToCart = (product: Product): AddToCartResult => {
    const result = addToCart(product);
    
    if (result.success) {
      toast({
        title: 'Добавлено в корзину',
        description: product.name,
      });
    }
    
    return result;
  };

  const handleDecrementCart = (productId: string) => {
    const qty = getCartQuantity(productId);
    if (qty <= 1) {
      updateCartQuantity(productId, 0);
    } else {
      updateCartQuantity(productId, qty - 1);
    }
  };

  const handleRemoveFromFavorites = (productId: string, productName: string) => {
    toggleFavorite(productId);
    toast({
      title: 'Удалено из избранного',
      description: `${productName} удален из избранного`,
      duration: 2000,
    });
  };

  const clearAllFavorites = () => {
    favorites.forEach(id => toggleFavorite(id));
    toast({
      title: 'Избранное очищено',
      description: 'Все товары удалены из избранного',
      duration: 2000,
    });
  };

  // Add all in-stock favorites to cart
  const handleAddAllToCart = async () => {
    setAddingAll(true);
    let addedCount = 0;
    let outOfStockCount = 0;

    for (const product of products) {
      if (product.stock <= 0) {
        outOfStockCount++;
        continue;
      }
      const result = addToCart(product);
      if (result.success) {
        addedCount++;
      }
    }

    if (addedCount > 0) {
      toast({
        title: 'Добавлено в корзину',
        description: `${addedCount} ${addedCount === 1 ? 'товар' : addedCount >= 2 && addedCount <= 4 ? 'товара' : 'товаров'} добавлено`,
      });
    }
    if (outOfStockCount > 0) {
      toast({
        title: 'Нет в наличии',
        description: `${outOfStockCount} ${outOfStockCount === 1 ? 'товар' : outOfStockCount >= 2 && outOfStockCount <= 4 ? 'товара' : 'товаров'} пропущено`,
        variant: 'destructive',
        duration: 3000,
      });
    }

    setAddingAll(false);
  };

  // Stock status calculation
  const stockSummary = useMemo(() => {
    const inStock = products.filter(p => p.stock > 0).length;
    const outOfStock = products.filter(p => p.stock <= 0).length;
    return { inStock, outOfStock, total: products.length };
  }, [products]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Назад" onClick={() => setCurrentView('profile')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Избранное</h1>
              <p className="text-sm text-muted-foreground">
                {favorites.length} {favorites.length === 1 ? 'товар' : favorites.length >= 2 && favorites.length <= 4 ? 'товара' : 'товаров'}
              </p>
            </div>
          </div>
          {favorites.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFavorites} className="text-muted-foreground">
              <Trash2 className="h-4 w-4 mr-1" />
              Очистить
            </Button>
          )}
        </div>

        {/* Add all to cart + stock summary row */}
        {products.length > 0 && !loading && (
          <motion.div
            className="flex items-center justify-between mt-2.5 gap-2"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Stock summary badges */}
            <div className="flex items-center gap-1.5">
              {stockSummary.inStock > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1 py-0.5 px-1.5 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30">
                  <PackageCheck className="h-3 w-3" />
                  {stockSummary.inStock} в наличии
                </Badge>
              )}
              {stockSummary.outOfStock > 0 && (
                <Badge variant="outline" className="text-[10px] gap-1 py-0.5 px-1.5 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30">
                  <PackageX className="h-3 w-3" />
                  {stockSummary.outOfStock} нет
                </Badge>
              )}
            </div>

            {/* Add all to cart button */}
            {stockSummary.inStock > 0 && (
              <Button
                size="sm"
                className="h-8 text-xs font-semibold rounded-lg bg-gradient-to-r from-brand to-brand/80 hover:from-brand/90 hover:to-brand/70 text-brand-foreground shadow-sm shadow-brand/20"
                onClick={handleAddAllToCart}
                disabled={addingAll}
              >
                {addingAll ? (
                  <span className="flex items-center gap-1.5">
                    <motion.div
                      className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                    />
                    Добавляем...
                  </span>
                ) : (
                  <>
                    <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                    Добавить все в корзину
                  </>
                )}
              </Button>
            )}
          </motion.div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-14 liquid-glass-scroll">
        <div className="p-3">
          {loading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="aspect-[3/4] bg-muted animate-pulse rounded-2xl" />
                  <div className="space-y-1 px-0.5">
                    <div className="h-3 bg-muted animate-pulse rounded" />
                    <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                    <div className="h-3.5 bg-muted animate-pulse rounded w-16" />
                    <div className="h-6 bg-muted animate-pulse rounded-lg w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <>
              <EmptyState
                icon="favorites"
                title="Избранное пусто"
                description="Нажмите на сердечко на товаре, чтобы добавить его в избранное"
                secondaryText="Здесь будут товары, которые вам понравились"
                buttonText="Перейти в каталог"
                onButtonClick={() => setCurrentView('catalog')}
              />
              <PopularProducts />
            </>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-3 gap-2">
                {products.map((product) => {
                  const isOutOfStock = product.stock <= 0;
                  
                  return (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
                      className="relative"
                    >
                      <ProductCard
                        variant="compact"
                        product={product}
                        onClick={() => setSelectedProduct(product.id)}
                        onAddToCart={handleAddToCart}
                        onRemoveFromCart={handleDecrementCart}
                        onToggleFavorite={() => handleRemoveFromFavorites(product.id, product.name)}
                        isFavorite={true}
                        isInCart={isInCart(product.id)}
                        cartQuantity={getCartQuantity(product.id)}
                      />
                      {/* Stock status indicator below card */}
                      <div className="flex items-center gap-1 mt-1 px-0.5">
                        {isOutOfStock ? (
                          <span className="text-[9px] font-medium text-red-500 dark:text-red-400 flex items-center gap-0.5">
                            <PackageX className="h-2.5 w-2.5" />
                            Нет в наличии
                          </span>
                        ) : product.stock <= 5 ? (
                          <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                            <PackageCheck className="h-2.5 w-2.5" />
                            Осталось {product.stock} шт.
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium text-green-600 dark:text-green-400 flex items-center gap-0.5">
                            <PackageCheck className="h-2.5 w-2.5" />
                            В наличии
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
