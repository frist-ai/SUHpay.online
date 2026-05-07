import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Storage version - increment this to force logout on all devices
const STORAGE_VERSION = '0.6.05.26';

// Types
export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  purchasePrice: number | null;
  discountPrice: number | null;
  currency: string;
  categoryId: string;
  stock: number;
  skuCount: number;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  attributes: string | null;
  images: string | null;
  createdAt: string;
  updatedAt: string;
  category?: Category;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  products?: Product[];
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId?: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  subtotal: number;
  discount: number;
  deliveryCost: number;
  total: number;
  deliveryMethod: string;
  deliveryService: string | null;
  trackingNumber: string | null;
  deliveryCity: string | null;
  deliveryStreet: string | null;
  deliveryHouse: string | null;
  deliveryApartment: string | null;
  deliveryPostalCode: string | null;
  deliveryComment: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail?: string | null;
  customerComment: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  quantity: number;
  price: number;
  total: number;
}

export interface User {
  id: string;
  telegramId: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  languageCode: string | null;
  role: 'user' | 'admin' | 'collector' | 'customer';
  authType?: 'telegram' | 'web';
  loyaltyPoints: number;
  totalSpent: number;
  ordersCount: number;
  referralCode: string | null;
  referredBy: string | null;
  birthday: string | null;
  lastVisitAt: string | null;
  createdAt: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  linkType: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface AppliedPromo {
  code: string;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  message: string;
}

// Add to cart result
export interface AddToCartResult {
  success: boolean;
  reason?: 'out_of_stock' | 'limit_reached';
  message?: string;
  addedQuantity?: number;
  remainingStock?: number;
}

// Shop Store
interface ShopState {
  // User - NOT persisted, always comes from server
  user: User | null;
  setUser: (user: User | null) => void;
  isAdmin: boolean;
  setIsAdmin: (isAdmin: boolean) => void;
  isCollector: boolean;
  setIsCollector: (isCollector: boolean) => void;
  authMethod: 'telegram' | 'web' | null;
  setAuthMethod: (method: 'telegram' | 'web' | null) => void;
  logout: () => void;

  // Telegram initData for API calls - NOT persisted
  initData: string | null;
  setInitData: (initData: string | null) => void;

  // Cart
  cart: CartItem[];
  cartTotal: number;
  cartCount: number;
  cartTimerStartedAt: number | null;
  setCartTimerStartedAt: (time: number | null) => void;
  addToCart: (product: Product, quantity?: number) => AddToCartResult;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;

  // Favorites
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;

  // Cart helpers
  isInCart: (productId: string) => boolean;
  getCartQuantity: (productId: string) => number;

  // Navigation
  currentView: 'catalog' | 'product' | 'cart' | 'checkout' | 'profile' | 'orders' | 'admin' | 'products-manager' | 'categories-manager' | 'orders-manager' | 'settings' | 'favorites' | 'addresses' | 'stock-manager' | 'banners-manager' | 'broadcasts-manager' | 'polls-manager' | 'product-requests-manager' | 'promos-manager' | 'delivery-manager' | 'customers-manager' | 'ai-combo-manager' | 'payment-manager' | 'support' | 'chat-manager' | 'analytics-manager' | 'notifications';
  selectedProductId: string | null;
  // Navigation history for back button
  viewHistory: ShopState['currentView'][];
  checkoutStep: number;
  setCheckoutStep: (step: number) => void;
  canGoBack: () => boolean;
  goBack: () => void;
  setCurrentView: (view: ShopState['currentView'], addToHistory?: boolean) => void;
  setSelectedProduct: (productId: string | null) => void;
  // Promocode
  appliedPromo: AppliedPromo | null;
  setAppliedPromo: (promo: AppliedPromo | null) => void;
  discount: number;
  finalTotal: number;

  // Delivery method from cart (used to pre-select in checkout)
  cartDeliveryMethod: 'courier' | 'pickup';
  setCartDeliveryMethod: (method: 'courier' | 'pickup') => void;

  // Recent Searches
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;

  // UI State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useShopStore = create<ShopState>()(
  persist(
    (set, get) => ({
      // User - NOT persisted, always fresh from server
      user: null,
      setUser: (user) => {
        // Always derive isAdmin from user.role
        const isAdmin = user?.role === 'admin';
        set({ user, isAdmin });
      },
      isAdmin: false,
      setIsAdmin: (isAdmin) => set({ isAdmin }),
      isCollector: false,
      setIsCollector: (isCollector) => set({ isCollector }),
      authMethod: null,
      setAuthMethod: (authMethod) => set({ authMethod }),
      logout: () => {
        // Clear all user data
        set({ 
          user: null, 
          isAdmin: false, 
          isCollector: false,
          authMethod: null,
          initData: null,
          currentView: 'catalog',
        });
        // Clear localStorage completely
        if (typeof window !== 'undefined') {
          localStorage.removeItem('telegram-shop-storage');
        }
      },

      // Telegram initData - NOT persisted
      initData: null,
      setInitData: (initData) => set({ initData }),

      // Cart
      cart: [],
      cartTotal: 0,
      cartCount: 0,
      cartTimerStartedAt: null,
      setCartTimerStartedAt: (time) => set({ cartTimerStartedAt: time }),

      addToCart: (product, quantity = 1) => {
        const cart = get().cart;
        const existingItem = cart.find(item => item.productId === product.id);
        
        // Check stock limit
        const currentQuantity = existingItem ? existingItem.quantity : 0;
        const availableStock = product.stock || 0;
        const maxCanAdd = Math.max(0, availableStock - currentQuantity);
        
        if (maxCanAdd === 0) {
          return { success: false, reason: 'out_of_stock', message: 'Товар закончился' };
        }
        
        // Limit quantity to available stock
        const actualQuantity = Math.min(quantity, maxCanAdd);

        let newCart: typeof cart;
        if (existingItem) {
          newCart = cart.map(item =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + actualQuantity }
              : item
          );
        } else {
          newCart = [...cart, { id: Date.now().toString(), productId: product.id, quantity: actualQuantity, product }];
        }
        const count = newCart.length;
        const total = newCart.reduce((sum, item) => sum + (item.product.discountPrice || item.product.price) * item.quantity, 0);

        // Start cart timer on first item added
        const state = get();
        if (!state.cartTimerStartedAt && newCart.length > 0) {
          set({ cart: newCart, cartCount: count, cartTotal: total, cartTimerStartedAt: Date.now() });
        } else {
          set({ cart: newCart, cartCount: count, cartTotal: total });
        }
        
        return { success: true, addedQuantity: actualQuantity, remainingStock: availableStock - currentQuantity - actualQuantity };
      },

      removeFromCart: (productId) => {
        const cart = get().cart.filter(item => item.productId !== productId);
        const count = cart.length;
        const total = cart.reduce((sum, item) => sum + (item.product.discountPrice || item.product.price) * item.quantity, 0);
        if (cart.length === 0) {
          set({ cart, cartCount: count, cartTotal: total, cartTimerStartedAt: null });
        } else {
          set({ cart, cartCount: count, cartTotal: total });
        }
      },

      updateCartQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(productId);
          return;
        }
        
        // Check stock limit
        const cart = get().cart;
        const item = cart.find(i => i.productId === productId);
        if (item) {
          const availableStock = item.product.stock || 0;
          const actualQuantity = Math.min(quantity, availableStock);
          
          const updatedCart = cart.map(i =>
            i.productId === productId ? { ...i, quantity: actualQuantity } : i
          );
          const emptyCart = updatedCart.filter(i => i.quantity > 0);
          if (emptyCart.length === 0) {
            set({ cart: emptyCart, cartCount: 0, cartTotal: 0, cartTimerStartedAt: null, appliedPromo: null, discount: 0, finalTotal: 0 });
            return;
          }
          const count = emptyCart.length;
          const total = emptyCart.reduce((sum, item) => sum + (item.product.discountPrice || item.product.price) * item.quantity, 0);
          const appliedPromo = get().appliedPromo;
          const discount = appliedPromo ? appliedPromo.discountAmount : 0;
          set({ cart: emptyCart, cartCount: count, cartTotal: total, discount, finalTotal: total - discount });
        }
      },

      clearCart: () => set({ cart: [], cartCount: 0, cartTotal: 0, appliedPromo: null, discount: 0, finalTotal: 0, cartTimerStartedAt: null }),

      // Favorites
      favorites: [],
      toggleFavorite: (productId) => {
        const favorites = get().favorites;
        if (favorites.includes(productId)) {
          set({ favorites: favorites.filter(id => id !== productId) });
        } else {
          set({ favorites: [...favorites, productId] });
        }
      },
      isFavorite: (productId) => get().favorites.includes(productId),

      // Cart helpers
      isInCart: (productId) => get().cart.some(item => item.productId === productId),
      getCartQuantity: (productId) => {
        const item = get().cart.find(item => item.productId === productId);
        return item ? item.quantity : 0;
      },

      // Promocode
      appliedPromo: null,
      setAppliedPromo: (promo) => {
        const cartTotal = get().cartTotal;
        const discount = promo ? promo.discountAmount : 0;
        set({ 
          appliedPromo: promo, 
          discount,
          finalTotal: cartTotal - discount
        });
      },
      discount: 0,
      finalTotal: 0,

      // Delivery method from cart
      cartDeliveryMethod: 'courier',
      setCartDeliveryMethod: (method) => set({ cartDeliveryMethod: method }),

      // Recent Searches
      recentSearches: [],
      addRecentSearch: (query: string) => {
        const trimmed = query.trim();
        if (!trimmed) return;
        const current = get().recentSearches;
        // Remove duplicates and add to front, max 10 items
        const filtered = current.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
        const updated = [trimmed, ...filtered].slice(0, 10);
        set({ recentSearches: updated });
      },
      clearRecentSearches: () => set({ recentSearches: [] }),

      // Navigation
      currentView: 'catalog',
      selectedProductId: null,
      viewHistory: [],
      checkoutStep: 1,
      setCheckoutStep: (step) => set({ checkoutStep: step }),
      canGoBack: () => {
        const state = get();
        // Can go back if in checkout with step > 1
        if (state.currentView === 'checkout' && state.checkoutStep > 1) {
          return true;
        }
        // Can go back if there's history
        return state.viewHistory.length > 0;
      },
      goBack: () => {
        const state = get();
        // If in checkout, handle step navigation first
        if (state.currentView === 'checkout' && state.checkoutStep > 1) {
          set({ checkoutStep: state.checkoutStep - 1 });
          return;
        }
        // Otherwise, use history
        const history = state.viewHistory;
        if (history.length > 0) {
          const previousView = history[history.length - 1];
          set({ 
            currentView: previousView, 
            viewHistory: history.slice(0, -1),
            checkoutStep: 1, // Reset checkout step when leaving checkout
          });
        }
      },
      setCurrentView: (view, addToHistory = true) => {
        const state = get();
        // Don't add to history if same view
        if (state.currentView === view) return;
        
        // Reset checkout step when entering checkout
        if (view === 'checkout') {
          set({ 
            currentView: view, 
            checkoutStep: 1,
            viewHistory: addToHistory ? [...state.viewHistory, state.currentView] : state.viewHistory,
          });
        } else {
          set({ 
            currentView: view,
            viewHistory: addToHistory ? [...state.viewHistory, state.currentView] : state.viewHistory,
          });
        }
      },
      setSelectedProduct: (productId) => {
        const state = get();
        if (productId) {
          set({ 
            selectedProductId: productId, 
            currentView: 'product',
            viewHistory: [...state.viewHistory, state.currentView],
          });
        } else {
          set({ selectedProductId: null, currentView: 'catalog' });
        }
      },
      // UI State
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),
    }),
    {
      name: 'telegram-shop-storage',
      storage: createJSONStorage(() => localStorage),
      version: parseInt(STORAGE_VERSION.replace(/\./g, '')), // 0.6.05.26 -> 60526
      // ONLY persist cart, favorites, and recentSearches - NOT user or isAdmin or navigation
      partialize: (state) => ({
        cart: state.cart,
        cartTotal: state.cartTotal,
        cartCount: state.cartCount,
        cartTimerStartedAt: state.cartTimerStartedAt,
        favorites: state.favorites,
        appliedPromo: state.appliedPromo,
        recentSearches: state.recentSearches,
        // user, isAdmin, viewHistory, checkoutStep are NOT persisted
      }),
    }
  )
);

// Note: Zustand's persist middleware handles version migration automatically
// through the 'version' config option above. No need for manual version check.

// Optimized selectors - use these in components to avoid unnecessary re-renders
// These selectors only subscribe to specific parts of the state

// Cart item selector - returns cart item data for a specific product
export const useCartItem = (productId: string) => useShopStore(state => {
  const item = state.cart.find(item => item.productId === productId);
  return item ? { quantity: item.quantity, inCart: true } : { quantity: 0, inCart: false };
});

// Favorite selector - returns whether a product is favorited
export const useIsFavorite = (productId: string) => useShopStore(
  state => state.favorites.includes(productId)
);

// Cart totals selector - only subscribes to cart totals, not the whole cart
export const useCartTotals = () => useShopStore(state => ({
  count: state.cartCount,
  total: state.cartTotal,
  finalTotal: state.finalTotal,
  discount: state.discount,
}));

// User selector - only subscribes to user data
export const useUser = () => useShopStore(state => ({
  user: state.user,
  isAdmin: state.isAdmin,
  isCollector: state.isCollector,
}));
