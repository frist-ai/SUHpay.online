'use client';

import { useShopStore, CartItem } from '@/stores/shop-store';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingCart, Plus, Minus, Trash2, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { pluralize, formatPrice } from '@/lib/utils';
import { parseProductImages } from '@/lib/product-utils';
import { useToast } from '@/hooks/use-toast';
import { useCallback } from 'react';

export function CartSheet() {
  const { cart, cartTotal, cartCount, updateCartQuantity, removeFromCart, setCurrentView } = useShopStore();
  const { toast } = useToast();

  const showOutOfStockToast = useCallback((productName: string) => {
    toast({
      title: 'Товар закончился',
      description: productName,
      variant: 'out-of-stock',
      duration: 2000,
    });
  }, [toast]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Корзина" className="relative">
          <ShoppingCart className="h-5 w-5" />
          {cartCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {cartCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Корзина
            {cartCount > 0 && (
              <Badge variant="secondary">{cartCount} {pluralize(cartCount, 'товар', 'товара', 'товаров')}</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <Package className="h-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Корзина пуста</p>
            <Button onClick={() => setCurrentView('catalog')}>
              Перейти в каталог
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-4 py-4">
                {cart.map((item: CartItem) => (
                  <div key={item.productId} className="flex gap-3">
                    {/* Product image */}
                    <div className="w-16 h-16 bg-muted rounded-xl overflow-hidden flex-shrink-0">
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

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium line-clamp-2">
                        {item.product.name}
                      </h4>
                      {item.product.discountPrice && item.product.discountPrice < item.product.price ? (
                        <p className="text-xs text-muted-foreground">
                          <span className="line-through mr-1">{formatPrice(item.product.price)}/шт</span>
                          <span className="text-green-600 dark:text-green-400">{formatPrice(item.product.discountPrice)}/шт</span>
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(item.product.discountPrice || item.product.price)}/шт
                        </p>
                      )}

                      {/* Quantity controls — brand green accent */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center h-7 rounded-lg border border-brand/20 bg-brand/5 dark:bg-brand/10">
                          <button
                            type="button"
                            aria-label="Уменьшить количество"
                            className="w-7 h-7 flex items-center justify-center text-foreground hover:bg-brand/10 active:bg-brand/20 dark:hover:bg-brand/15 dark:active:bg-brand/25 rounded-l-lg transition-colors"
                            onClick={() => updateCartQuantity(item.productId, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" strokeWidth={2.5} />
                          </button>
                          <span className="min-w-[1.5rem] text-center text-[11px] font-bold text-foreground select-none tabular-nums">
                            {item.quantity}шт
                          </span>
                          <button
                            type="button"
                            aria-label="Увеличить количество"
                            className="w-7 h-7 flex items-center justify-center text-foreground hover:bg-brand/10 active:bg-brand/20 dark:hover:bg-brand/15 dark:active:bg-brand/25 rounded-r-lg transition-colors"
                            onClick={() => {
                              const maxStock = item.product.stock || 0;
                              if (item.quantity >= maxStock) {
                                showOutOfStockToast(item.product.name);
                                return;
                              }
                              updateCartQuantity(item.productId, item.quantity + 1);
                            }}
                          >
                            <Plus className="h-3 w-3" strokeWidth={2.5} />
                          </button>
                        </div>
                        <button
                          type="button"
                          aria-label="Удалить из корзины"
                          className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-all"
                          onClick={() => removeFromCart(item.productId)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Total price */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium">
                        {formatPrice((item.product.discountPrice || item.product.price) * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="border-t pt-4 space-y-4">
              <div className="flex justify-between text-lg font-semibold">
                <span>Итого:</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={() => setCurrentView('checkout')}
              >
                Оформить заказ
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
