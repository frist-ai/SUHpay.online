'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { CatalogView } from '@/components/shop/catalog-view';
import { ProductDetailView } from '@/components/shop/product-detail-view';
import { CartView } from '@/components/shop/cart-view';
import { CheckoutView } from '@/components/shop/checkout-view';
import { OrdersView } from '@/components/shop/orders-view';
import { ProfileView } from '@/components/shop/profile-view';
import { FavoritesView } from '@/components/shop/favorites-view';
import { AddressesView } from '@/components/shop/addresses-view';
import { BottomNav } from '@/components/shop/bottom-nav';
import { CatalogSkeleton } from '@/components/shop/catalog-skeleton';
import { SupportChatView } from '@/components/shop/support-chat-view';
import { NotificationsView } from '@/components/shop/notifications-view';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { ProductsManager } from '@/components/admin/products-manager';
import { CategoriesManager } from '@/components/admin/categories-manager';
import { OrdersManager } from '@/components/admin/orders-manager';
import { StockManager } from '@/components/admin/stock-manager';
import { BannersManager } from '@/components/admin/banners-manager';
import { BroadcastsManager } from '@/components/admin/broadcasts-manager';
import { PollsManager } from '@/components/admin/polls-manager';
import { ProductRequestsManager } from '@/components/admin/product-requests-manager';
import { PromosManager } from '@/components/admin/promos-manager';
import { BotManager } from '@/components/admin/bot-manager';
import { DeliveryManager } from '@/components/admin/delivery-manager';
import { CustomersManager } from '@/components/admin/customers-manager';
import { AIComboManager } from '@/components/admin/ai-combo-manager';
import { PaymentManager } from '@/components/admin/payment-manager';
import { ChatManager } from '@/components/admin/chat-manager';
import { AnalyticsManager } from '@/components/admin/analytics-manager';
import { SettingsView } from '@/components/admin/settings-view';
import { initTelegramWebApp, getTelegramUser, getStartParam } from '@/lib/telegram';
import '@/lib/fetch-auth'; // Global fetch interceptor — adds X-Telegram-Init-Data header to all API requests
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  ChevronLeft,
  Shield,
  Send,
  CheckCircle2,
  AlertTriangle,
  Database,
  Bot,
  User,
  MessageCircle,
  RefreshCw,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Helper function for API requests with retry and timeout
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  maxRetries = 3,
  timeout = 15000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return response;
      }
      
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Don't retry on abort (timeout)
      if ((error as Error)?.name === 'AbortError') {
        throw new Error('Превышено время ожидания. Проверьте подключение к интернету.');
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Не удалось выполнить запрос');
}

// Memoized Error Screen
function ErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  const [spinning, setSpinning] = useState(false);

  const handleRetryClick = () => {
    setSpinning(true);
    onRetry();
    setTimeout(() => setSpinning(false), 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">Произошла ошибка</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
        <Button onClick={handleRetryClick} className="w-full">
          <RefreshCw className={cn("h-4 w-4 mr-2", spinning && "animate-spin")} />
          Попробовать снова
        </Button>
      </div>
    </div>
  );
}

// Telegram Required Screen
function TelegramRequiredScreen() {
  const handleOpenTelegram = useCallback(() => {
    window.open('https://t.me/Suhpaybot?startapp=open', '_blank');
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="text-center space-y-8 max-w-sm">
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto shadow-2xl shadow-primary/30">
            <MessageCircle className="h-12 w-12 text-primary-foreground" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
            <Send className="h-4 w-4 text-white" />
          </div>
        </div>
        
        <div>
          <h1 className="text-3xl font-bold mb-2">СУХ[pay]</h1>
          <p className="text-muted-foreground">Магазин продуктов с доставкой</p>
        </div>
        
        <div className="bg-muted/50 rounded-2xl p-6 space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <svg className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Откройте Telegram</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Это приложение работает только внутри Telegram. Откройте его через бота @Suhpaybot
            </p>
          </div>
        </div>

        <div className="text-left space-y-3">
          <p className="text-sm font-medium text-center text-muted-foreground">Как открыть магазин:</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">1</div>
              <p className="text-sm">Откройте Telegram</p>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">2</div>
              <p className="text-sm">Найдите <b>@Suhpaybot</b></p>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">3</div>
              <p className="text-sm">Нажмите <b>«Открыть магазин»</b></p>
            </div>
          </div>
        </div>

        <Button 
          size="lg" 
          className="w-full text-base h-12 rounded-xl"
          onClick={handleOpenTelegram}
        >
          <Send className="h-5 w-5 mr-2" />
          Открыть в Telegram
        </Button>
      </div>
    </div>
  );
}

// Non-blocking Telegram SDK wait with Promise
function waitForTelegramSDK(timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Telegram?.WebApp) {
      resolve(true);
      return;
    }
    
    const startTime = Date.now();
    const checkInterval = 100;
    
    const check = () => {
      if (window.Telegram?.WebApp) {
        resolve(true);
        return;
      }
      
      if (Date.now() - startTime >= timeout) {
        resolve(false);
        return;
      }
      
      setTimeout(check, checkInterval);
    };
    
    check();
  });
}

export default function Home() {
  const { 
    currentView, 
    selectedProductId, 
    setSelectedProduct, 
    isAdmin,
    setIsAdmin,
    setIsCollector,
    setAuthMethod,
    setCurrentView,
    setUser,
    user,
  } = useShopStore();

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);
  
  // ─── Init user (Telegram only) ──────────────────────────────────────────
  const initUser = useCallback(async () => {
    setError(null);
    setUser(null);
    setIsAdmin(false);
    setAuthMethod(null);
    
    // Check for demo mode for preview/testing
    const urlParams = new URLSearchParams(window.location.search);
    const demoParam = urlParams.get('demo');
    const testTgId = urlParams.get('test_tg_id');
    
    if (demoParam !== null || testTgId) {
      setUser({
        id: 'demo-user-id',
        telegramId: testTgId || '123456789',
        firstName: 'Пользователь',
        lastName: null,
        username: 'demo_user',
        phone: null,
        email: null,
        photoUrl: null,
        languageCode: 'ru',
        role: 'admin',
        loyaltyPoints: 0,
        totalSpent: 0,
        ordersCount: 0,
        referralCode: 'DEMO2024',
        referredBy: null,
        birthday: null,
        lastVisitAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      setIsAdmin(true);
      setAuthMethod('telegram');
      setLoading(false);
      setMounted(true);
      return;
    }
    
    // ─── Check for Telegram SDK ───
    if (window.Telegram?.WebApp) {
      initTelegramWebApp();
    } else {
      const sdkLoaded = await waitForTelegramSDK(5000);
      
      if (!sdkLoaded) {
        // No Telegram SDK → show TelegramRequiredScreen
        setLoading(false);
        setMounted(true);
        return;
      }
      
      initTelegramWebApp();
    }
    
    const tgUser = getTelegramUser();
    
    if (!tgUser) {
      // No Telegram user → show TelegramRequiredScreen
      setLoading(false);
      setMounted(true);
      return;
    }
    
    // ─── Telegram user found ───
    setAuthMethod('telegram');
    const telegramId = tgUser.id.toString();
    const firstName = tgUser.first_name || null;
    const lastName = tgUser.last_name || null;
    const username = tgUser.username || null;
    const languageCode = tgUser.language_code || null;
    const photoUrl = tgUser.photo_url || null;
    
    try {
      const userResponse = await fetchWithRetry('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId,
          firstName,
          lastName,
          username,
          photoUrl,
          languageCode,
        }),
      }, 3, 20000);
      
      const dbUser = await userResponse.json();
      const finalPhotoUrl = photoUrl || dbUser.photoUrl || `https://t.me/i/userpic/${telegramId}`;
      
      setUser({
        id: dbUser.id,
        telegramId: dbUser.telegramId,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        username: dbUser.username,
        phone: dbUser.phone,
        email: dbUser.email,
        photoUrl: finalPhotoUrl,
        languageCode: dbUser.languageCode,
        role: dbUser.role,
        loyaltyPoints: dbUser.loyaltyPoints || 0,
        totalSpent: dbUser.totalSpent || 0,
        ordersCount: dbUser.ordersCount || 0,
        referralCode: dbUser.referralCode,
        referredBy: dbUser.referredBy,
        birthday: dbUser.birthday?.toISOString() || null,
        lastVisitAt: dbUser.lastVisitAt,
        createdAt: dbUser.createdAt,
      });
      setIsAdmin(dbUser.role === 'admin');
      
      if (finalPhotoUrl && finalPhotoUrl !== dbUser.photoUrl) {
        fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramId, photoUrl: finalPhotoUrl }),
        }).catch(() => {});
      }
      
      fetch(`/api/staff?telegramId=${encodeURIComponent(telegramId)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.role === 'collector' && data.isActive !== false) {
            setIsCollector(true);
          }
        })
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка подключения к серверу');
    }
    
    setLoading(false);
    setMounted(true);
  }, [setUser, setIsAdmin, setIsCollector, setAuthMethod]);

  // Initialize user on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void initUser();
  }, [initUser]);

  // Handle deep links (start_param) - e.g., product sharing
  useEffect(() => {
    if (!user || loading) return;
    
    const startParam = getStartParam();
    if (!startParam) return;
    
    // Handle product deep link: product_<productId>
    if (startParam.startsWith('product_')) {
      const productId = startParam.replace('product_', '');
      setSelectedProduct(productId);
    }
  }, [user, loading, setSelectedProduct]);

  // Memoized handlers
  const handleProductBack = useCallback(() => setSelectedProduct(null), [setSelectedProduct]);
  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    initUser();
  }, [initUser]);
  const handleGoToCatalog = useCallback(() => setCurrentView('catalog'), [setCurrentView]);

  // Memoized view check
  const isAdminView = useMemo(() => 
    currentView === 'admin' || 
    currentView === 'products-manager' || 
    currentView === 'categories-manager' || 
    currentView === 'orders-manager' || 
    currentView === 'settings' || 
    currentView === 'stock-manager' || 
    currentView === 'banners-manager' || 
    currentView === 'broadcasts-manager' || 
    currentView === 'polls-manager' || 
    currentView === 'product-requests-manager' || 
    currentView === 'promos-manager' ||
    currentView === 'delivery-manager' ||
    currentView === 'customers-manager' ||
    currentView === 'ai-combo-manager' ||
    currentView === 'payment-manager' ||
    currentView === 'chat-manager' ||
    currentView === 'analytics-manager',
    [currentView]
  );

  // Memoized content renderer
  const content = useMemo(() => {
    if (currentView === 'admin' && isAdmin) return <AdminDashboard />;
    if (currentView === 'products-manager' && isAdmin) return <ProductsManager />;
    if (currentView === 'categories-manager' && isAdmin) return <CategoriesManager />;
    if (currentView === 'orders-manager' && isAdmin) return <OrdersManager />;
    if (currentView === 'stock-manager' && isAdmin) return <StockManager />;
    if (currentView === 'banners-manager' && isAdmin) return <BannersManager />;
    if (currentView === 'broadcasts-manager' && isAdmin) return <BroadcastsManager />;
    if (currentView === 'polls-manager' && isAdmin) return <PollsManager />;
    if (currentView === 'product-requests-manager' && isAdmin) return <ProductRequestsManager />;
    if (currentView === 'promos-manager' && isAdmin) return <PromosManager />;
    if (currentView === 'delivery-manager' && isAdmin) return <DeliveryManager />;
    if (currentView === 'customers-manager' && isAdmin) return <CustomersManager />;
    if (currentView === 'ai-combo-manager' && isAdmin) return <AIComboManager />;
    if (currentView === 'payment-manager' && isAdmin) return <PaymentManager />;
    if (currentView === 'chat-manager' && isAdmin) return <ChatManager />;
    if (currentView === 'analytics-manager' && isAdmin) return <AnalyticsManager />;
    if (currentView === 'settings' && isAdmin) return <SettingsView />;
    if (currentView === 'product' && selectedProductId) return <ProductDetailView productId={selectedProductId} onBack={handleProductBack} />;
    if (currentView === 'cart') return <CartView />;
    if (currentView === 'checkout') return <CheckoutView />;
    if (currentView === 'orders') return <OrdersView />;
    if (currentView === 'profile') return <ProfileView />;
    if (currentView === 'favorites') return <FavoritesView />;
    if (currentView === 'addresses') return <AddressesView />;
    if (currentView === 'support') return <SupportChatView />;
    if (currentView === 'notifications') return <NotificationsView />;
    return <CatalogView />;
  }, [currentView, isAdmin, selectedProductId, handleProductBack]);

  // Loading state - show catalog skeleton immediately for better UX
  if (!mounted || loading) {
    return (
      <main className="min-h-screen bg-muted/30 flex flex-col lg:items-center lg:justify-center lg:p-6">
        <div className="w-full max-w-lg mx-auto lg:bg-background lg:rounded-3xl lg:shadow-2xl lg:border lg:border-border/50 lg:overflow-hidden lg:min-h-[800px] lg:max-h-[900px] flex flex-col h-screen lg:h-auto">
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <CatalogSkeleton />
          </div>
        </div>
      </main>
    );
  }

  // Show error screen if something went wrong
  if (error) {
    return <ErrorScreen error={error} onRetry={handleRetry} />;
  }

  // Not authenticated → show TelegramRequiredScreen
  if (!user) {
    return <TelegramRequiredScreen />;
  }

  // Admin views - strict check
  if (isAdminView && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4">
          <Shield className="h-16 w-16 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Доступ запрещён</h1>
          <p className="text-muted-foreground">У вас нет прав администратора</p>
          {user?.telegramId && (
            <p className="text-sm text-muted-foreground">
              Ваш Telegram ID: <b>{user.telegramId}</b>
            </p>
          )}
          {user?.phone && !user?.telegramId && (
            <p className="text-sm text-muted-foreground">
              Аккаунт: <b>{user.phone}</b>
            </p>
          )}
          <Button onClick={handleGoToCatalog}>На главную</Button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 flex flex-col lg:items-center lg:justify-start lg:p-6">
      {/* Desktop: centered phone frame */}
      <div className="w-full max-w-lg mx-auto lg:bg-background lg:rounded-3xl lg:shadow-2xl lg:border lg:border-border/50 lg:overflow-hidden lg:min-h-[800px] lg:max-h-[900px] lg:my-auto flex flex-col lg:relative h-screen lg:h-auto">
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden lg:relative">
          {content}
        </div>
        <BottomNav />
        <Toaster />
      </div>
    </main>
  );
}
