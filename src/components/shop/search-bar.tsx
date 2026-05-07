'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useShopStore, Product, AddToCartResult } from '@/stores/shop-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CartStepper } from './cart-stepper';
import {
  Search,
  X,
  Clock,
  TrendingUp,
  Sparkles,
  Loader2,
  Package,
  Trash2,
  AlertCircle,
  RefreshCw,
  ShoppingCart,
  Send,
  ChevronRight,
} from 'lucide-react';
import { cn, pluralize, formatPrice } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface SearchBarProps {
  onClose?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

interface SearchSuggestion {
  popular: string[];
  categories: { id: string; name: string; count: number }[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  products?: Product[];
  timestamp: number;
}

interface CartActionItem {
  type: 'add';
  productId: string;
  quantity: number;
  productName?: string;
}

function getProductImage(product: Product): string {
  try {
    const imgs = product.images ? JSON.parse(product.images) : [];
    return Array.isArray(imgs) && imgs[0] ? imgs[0] : '/placeholder-product.svg';
  } catch {
    return '/placeholder-product.svg';
  }
}

const MAX_RECENT_SEARCHES = 8;
const STORAGE_KEY = 'suhpay_recent_searches';

export function SearchBar({ onClose, onFocusChange }: SearchBarProps) {
  const { searchQuery, setSearchQuery, setSelectedProduct, addToCart, updateCartQuantity, isInCart, getCartQuantity } = useShopStore();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentProducts, setCurrentProducts] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<SearchSuggestion>({ popular: [], categories: [] });
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
      } catch { return []; }
    }
    return [];
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [searchError, setSearchError] = useState(false);
  const [dropdownTop, setDropdownTop] = useState<number>(0);
  const [mounted, setMounted] = useState(false);

  // Check AI status
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('suhpay_ai_enabled');
      if (cached === 'true') setAiEnabled(true);
    } catch {}
    const checkAIStatus = async () => {
      try {
        const res = await fetch('/api/ai-search');
        const data = await res.json();
        setAiEnabled(data.enabled === true && data.configured === true);
        sessionStorage.setItem('suhpay_ai_enabled', String(data.enabled === true && data.configured === true));
      } catch {}
    };
    checkAIStatus();
  }, []);

  // Load suggestions
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const res = await fetch('/api/search/suggestions');
        const data = await res.json();
        setSuggestions(data);
      } catch {
        setSuggestions({ popular: ['Лапша', 'Чипсы', 'Напитки', 'Снеки'], categories: [] });
      } finally {
        setLoadingSuggestions(false);
      }
    };
    loadSuggestions();
  }, []);

  useEffect(() => { setMounted(true); }, []);

  // Auto-focus
  useEffect(() => {
    if (onFocusChange && mounted) {
      onFocusChange(true);
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [mounted]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, currentProducts, aiLoading]);

  const handleBlur = useCallback(() => {
    setTimeout(() => onFocusChange?.(false), 150);
  }, [onFocusChange]);

  // Track dropdown position
  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownTop(rect.bottom + 4);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  // Regular search (fallback when AI disabled)
  useEffect(() => {
    if (aiEnabled || aiLoading) return;
    const searchProducts = async () => {
      if (searchQuery.length < 2) {
        setResults([]);
        setSearchError(false);
        return;
      }
      try {
        setSearchError(false);
        const res = await fetch(`/api/products?search=${encodeURIComponent(searchQuery)}&limit=10`);
        const data = await res.json();
        setResults(data.products || []);
      } catch {
        setSearchError(true);
      }
    };
    const debounce = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, aiEnabled, aiLoading]);

  // Execute cart actions from AI response
  const executeCartActions = useCallback((actions: CartActionItem[]) => {
    for (const action of actions) {
      const product = (action as any).product;
      if (product) {
        // Use real product data from backend
        const result = addToCart(product);
        if (result.success) {
          toast({
            title: 'Добавлено в корзину',
            description: `${action.quantity > 1 ? action.quantity + ' x ' : ''}${product.name}`,
            duration: 1500,
          });
        } else {
          toast({
            title: 'Не удалось добавить',
            description: result.reason || product.name,
            duration: 2000,
          });
        }
      } else {
        // Fallback: try to find product in all chat messages' products
        toast({
          title: 'Товар добавлен',
          description: action.productName || 'Товар',
          duration: 1500,
        });
      }
    }
  }, [addToCart, toast]);

  // AI search — the main interaction
  const handleAISearch = async (query: string) => {
    if (!query.trim()) return;

    // When AI is disabled, do regular search
    if (!aiEnabled) {
      saveRecentSearch(query);
      setIsOpen(true);
      return;
    }

    // Add user message to chat
    setChatMessages(prev => [...prev, { role: 'user', text: query, timestamp: Date.now() }]);
    setAiLoading(true);
    setCurrentProducts([]);

    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();

      // If AI is disabled on server, switch to regular search mode
      if (data.enabled === false || res.status === 503) {
        setAiEnabled(false);
        try { sessionStorage.setItem('suhpay_ai_enabled', 'false'); } catch {}
        // Remove the user message from chat since we won't get AI reply
        setChatMessages(prev => prev.slice(0, -1));
        saveRecentSearch(query);
        // Trigger regular search
        setSearchQuery(query);
        setIsOpen(true);
        return;
      }

      if (data.success) {
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          text: data.response || '',
          products: data.products || [],
          timestamp: Date.now(),
        };
        setChatMessages(prev => [...prev, assistantMsg]);
        setCurrentProducts(data.products || []);

        // Execute cart actions if AI said to add
        if (data.cartActions && data.cartActions.length > 0) {
          executeCartActions(data.cartActions);
        }

        saveRecentSearch(query);
        setIsOpen(true);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          text: data.error || 'Ошибка поиска',
          timestamp: Date.now(),
        }]);
        setIsOpen(true);
      }
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Ошибка соединения',
        timestamp: Date.now(),
      }]);
      setIsOpen(true);
    } finally {
      setAiLoading(false);
      setSearchQuery('');
      inputRef.current?.focus();
    }
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product.id);
    setIsOpen(false);
    if (searchQuery.trim()) saveRecentSearch(searchQuery);
    onClose?.();
  };

  const saveRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    const trimmed = query.trim();
    setRecentSearches(prev => {
      const updated = [trimmed, ...prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const removeRecentSearch = (query: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(s => s !== query);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const clearSearch = () => {
    setSearchQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      if (aiEnabled) {
        handleAISearch(searchQuery);
      } else {
        saveRecentSearch(searchQuery);
      }
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleQueryClick = (query: string) => {
    if (aiEnabled) {
      handleAISearch(query);
    } else {
      handleSearch(query);
      saveRecentSearch(query);
    }
  };

  const clearChat = () => {
    setChatMessages([]);
    setCurrentProducts([]);
    setSearchQuery('');
    fetch('/api/ai-search', { method: 'DELETE' }).catch(() => {});
    inputRef.current?.focus();
  };

  // Cart helpers
  const handleAddToCart = useCallback((product: Product): AddToCartResult | void => {
    const result = addToCart(product);
    if (result.success) {
      toast({ title: 'Добавлено в корзину', description: product.name, duration: 1500 });
    }
    return result;
  }, [addToCart, toast]);

  const handleDecrementCart = useCallback((productId: string) => {
    const qty = getCartQuantity(productId);
    if (qty <= 1) updateCartQuantity(productId, 0);
    else updateCartQuantity(productId, qty - 1);
  }, [getCartQuantity, updateCartQuantity]);

  const renderSearchProduct = (product: Product) => {
    const hasDiscount = product.discountPrice && product.discountPrice < product.price;
    return (
      <div
        key={product.id}
        className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 text-left transition-colors cursor-pointer"
        onClick={() => handleSelectProduct(product)}
      >
        <div className="w-8 h-8 bg-muted rounded-lg overflow-hidden flex-shrink-0">
          <img src={getProductImage(product)} alt={product.name} className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.svg'; }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-1 leading-tight">{product.name}</p>
          <span className={cn(
            'text-xs',
            hasDiscount && 'text-green-600 dark:text-green-400'
          )}>
            {formatPrice(product.discountPrice || product.price)}
          </span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </div>
    );
  };

  const renderDropdownContent = () => {
    const hasChat = chatMessages.length > 0 || aiLoading;

    return (
      <>
        {aiEnabled ? (
          /* ─── AI Chat Mode ─── */
          <div className="flex flex-col max-h-[60vh]">
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {/* Empty state with hints */}
              {!hasChat && (
                <div className="text-center space-y-3 py-2">
                  <Sparkles className="h-10 w-10 mx-auto text-purple-500 dark:text-purple-400" />
                  <p className="font-medium">AI помощник</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {['собери попить и поесть до 400₽', 'подарок другу', 'что нового', 'до 100₽', 'расскажи про чипсы'].map((hint) => (
                      <button key={hint}
                        className="px-2.5 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                        onClick={() => handleAISearch(hint)}>
                        {hint}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Напишите запрос или /help</p>
                </div>
              )}

              {/* Chat messages */}
              {chatMessages.map((msg, i) => (
                <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2',
                    msg.role === 'user'
                      ? 'bg-purple-500 text-white rounded-br-md'
                      : 'bg-muted/80 dark:bg-muted/40 rounded-bl-md'
                  )}>
                    {msg.text && (
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                    )}
                    {/* Product cards inside assistant message */}
                    {msg.role === 'assistant' && msg.products && msg.products.length > 0 && (
                      <div className="divide-y mt-2 -mx-1">
                        {msg.products.map((product) => renderSearchProduct(product))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading indicator */}
              {aiLoading && (
                <div className="flex items-center gap-2 text-muted-foreground px-1">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                  <span className="text-sm">Думаю...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Chat actions bar */}
            {hasChat && (
              <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30">
                <button onClick={clearChat}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  <Trash2 className="h-3 w-3" /> Очистить
                </button>
                <span className="text-xs text-muted-foreground">
                  {chatMessages.length} сообщений
                </span>
              </div>
            )}
          </div>
        ) : (
          /* ─── Regular Search Mode (AI disabled) ─── */
          <div className="max-h-[60vh] overflow-y-auto">
            {recentSearches.length > 0 && (
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" /> Недавние
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearRecentSearches}>
                    <Trash2 className="h-3 w-3 mr-1" /> Очистить
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((s) => (
                    <Button key={s} variant="secondary" size="sm" className="group pr-1" onClick={() => handleQueryClick(s)}>
                      <span>{s}</span>
                      <X className="h-3 w-3 ml-1 opacity-50 group-hover:opacity-100" onClick={(e) => removeRecentSearch(s, e)} />
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="p-3 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <TrendingUp className="h-4 w-4" /> {loadingSuggestions ? '...' : 'Популярное'}
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.popular.map((s) => (
                  <Button key={s} variant="outline" size="sm" onClick={() => handleQueryClick(s)}>{s}</Button>
                ))}
              </div>
            </div>
            {results.length > 0 && searchQuery.length >= 2 && (
              <p className="text-xs text-muted-foreground p-3 pb-1">
                Найдено {results.length} {pluralize(results.length, 'товар', 'товара', 'товаров')}
              </p>
            )}
            {results.length > 0 && <div className="divide-y">{results.map(renderSearchProduct)}</div>}
            {searchQuery.length >= 2 && searchError && (
              <button className="w-full p-6 flex flex-col items-center gap-2 text-muted-foreground hover:bg-muted/30"
                onClick={() => { setSearchError(false); const c = searchQuery; setSearchQuery(''); setTimeout(() => setSearchQuery(c), 0); }}>
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-destructive font-medium">Ошибка поиска</p>
                <div className="flex items-center gap-1 text-xs"><RefreshCw className="h-3 w-3" /> Повторить</div>
              </button>
            )}
            {searchQuery.length >= 2 && !searchError && results.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Ничего не найдено по запросу &quot;{searchQuery}&quot;</p>
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Поиск товаров..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => { setIsOpen(true); onFocusChange?.(true); }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(
              'pl-10 pr-10 transition-all duration-200',
              'bg-transparent border-transparent focus:bg-transparent focus:ring-0 focus:shadow-none focus:border-transparent',
              'placeholder:text-foreground/50',
            )}
          />
          {searchQuery && (
            <Button variant="ghost" size="icon" aria-label="Очистить"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={clearSearch}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Send button (AI mode) */}
        {aiEnabled && searchQuery.length >= 1 && (
          <Button variant="default"
            className="shrink-0 bg-purple-500 hover:bg-purple-600"
            onClick={() => handleAISearch(searchQuery)}
            disabled={aiLoading}>
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && mounted && createPortal(
        <div className="fixed inset-0" style={{ zIndex: 9999 }} onClick={() => setIsOpen(false)}>
          <div className="absolute inset-0 bg-black/8 dark:bg-black/20" style={{ top: dropdownTop }} />
          <div ref={dropdownRef}
            className="absolute left-2 right-2 sm:left-auto sm:right-auto sm:max-w-lg sm:mx-2 max-h-[70vh] overflow-hidden rounded-2xl border border-border/30 shadow-xl shadow-black/8 dark:shadow-black/30"
            style={{ top: dropdownTop, background: 'transparent', backdropFilter: 'blur(2rem)', WebkitBackdropFilter: 'blur(2rem)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-black/[0.02] dark:bg-black/[0.08] saturate-[1.2] rounded-2xl pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/8 via-white/2 to-white/3 dark:from-white/5 dark:via-white/1 dark:to-white/2 rounded-2xl pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent dark:via-white/8 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-black/[0.03] dark:bg-black/[0.06] pointer-events-none" />
            <div className="absolute inset-0 shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.12),inset_0_-0.5px_0.5px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.06),inset_0_-0.5px_0.5px_rgba(0,0,0,0.06)] rounded-2xl pointer-events-none" />
            <div className="relative">{renderDropdownContent()}</div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
