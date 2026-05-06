'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useShopStore, Product, Category, Banner, AddToCartResult } from '@/stores/shop-store';
import { ProductCard } from './product-card';
import { BannerCarousel } from './banner-carousel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn, pluralize } from '@/lib/utils';
import { ChevronRight, Package, ArrowUp, Search, X, Send, Loader2, Sparkles, Clock, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CartStepper } from './cart-stepper';

// Storage key for scroll position
const SCROLL_POSITION_KEY = 'suhpay_catalog_scroll';
const RECENT_SEARCHES_KEY = 'suhpay_recent_searches';
const MAX_RECENT_SEARCHES = 5;

// Loading stages
type LoadingStage = 'skeleton' | 'categories' | 'products' | 'ready';

// Category icon map for common categories
const CATEGORY_ICONS: Record<string, string> = {
  'drinks': '🥤',
  'snacks': '🍿',
  'sweets': '🍬',
  'bread': '🍞',
  'dairy': '🥛',
  'meat': '🥩',
  'fish': '🐟',
  'vegetables': '🥬',
  'fruits': '🍎',
  'frozen': '🧊',
  'alcohol': '🍷',
  'beer': '🍺',
  'coffee': '☕',
  'tea': '🍵',
  'sauce': '🫙',
  'cereal': '🥣',
  'pasta': '🍝',
  'pizza': '🍕',
  'sushi': '🍣',
  'desserts': '🍰',
  'ice-cream': '🍦',
  'pets': '🐾',
  'household': '🧹',
  'hygiene': '🧴',
  'baby': '🍼',
  'health': '💊',
};

function getCategoryIcon(category: Category): string {
  if (CATEGORY_ICONS[category.slug]) return CATEGORY_ICONS[category.slug];
  // Try to match by name keywords
  const name = category.name.toLowerCase();
  if (name.includes('напитк') || name.includes('вод')) return '🥤';
  if (name.includes('снек') || name.includes('чипс')) return '🍿';
  if (name.includes('слад') || name.includes('конфет') || name.includes('шоколад')) return '🍬';
  if (name.includes('хлеб') || name.includes('выпечк')) return '🍞';
  if (name.includes('молок') || name.includes('сыр') || name.includes('кисломол')) return '🥛';
  if (name.includes('мяс') || name.includes('колбас') || name.includes('сосис')) return '🥩';
  if (name.includes('рыб') || name.includes('морепродукт')) return '🐟';
  if (name.includes('овощ') || name.includes('зелень') || name.includes('салат')) return '🥬';
  if (name.includes('фрукт') || name.includes('ягод')) return '🍎';
  if (name.includes('заморож')) return '🧊';
  if (name.includes('алкогол') || name.includes('вино') || name.includes('шампан')) return '🍷';
  if (name.includes('пиво')) return '🍺';
  if (name.includes('кофе')) return '☕';
  if (name.includes('чай')) return '🍵';
  if (name.includes('соус') || name.includes('майонез') || name.includes('кетчуп')) return '🫙';
  if (name.includes('круп') || name.includes('каш')) return '🥣';
  if (name.includes('макарон') || name.includes('паст')) return '🍝';
  if (name.includes('пицц')) return '🍕';
  if (name.includes('суш')) return '🍣';
  if (name.includes('десерт') || name.includes('торт') || name.includes('пирож')) return '🍰';
  if (name.includes('морожен')) return '🍦';
  if (name.includes('зоо') || name.includes('корм') || name.includes('животн')) return '🐾';
  if (name.includes('быт') || name.includes('дом')) return '🧹';
  if (name.includes('гигиен') || name.includes('уход')) return '🧴';
  if (name.includes('детск') || name.includes('малыш')) return '🍼';
  if (name.includes('здоров') || name.includes('апте') || name.includes('витамин')) return '💊';
  if (name.includes('фастфуд') || name.includes('бургер') || name.includes('ролл')) return '🍔';
  if (name.includes('готов') || name.includes('еда')) return '🍽️';
  return '📦';
}

// ─── Recent search helpers ────────────────────────────────────────────────
function getRecentSearches(): string[] {
  try {
    const stored = sessionStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  try {
    const existing = getRecentSearches();
    const filtered = existing.filter(s => s !== query);
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    sessionStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {}
}

// ─── Mini Progress Ring for Back to Top ───────────────────────────────────
function MiniProgressRing({ progress, size = 20, strokeWidth = 2.5 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - progress * circumference;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="opacity-30"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="opacity-90"
      />
    </svg>
  );
}

// ─── Horizontal Scroll Product Row (Samokat style) ───────────────────────────
function HorizontalProductRow({
  id,
  title,
  icon,
  products,
  onProductClick,
  onAddToCart,
  onRemoveFromCart,
  onToggleFavorite,
  isFavorite,
  isInCart,
  getCartQuantity,
  sectionRef,
  onViewAll,
}: {
  id: string;
  title: string;
  icon?: string;
  products: Product[];
  onProductClick: (id: string) => void;
  onAddToCart: (product: Product) => AddToCartResult;
  onRemoveFromCart: (productId: string) => void;
  onToggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  isInCart: (id: string) => boolean;
  getCartQuantity: (id: string) => number;
  sectionRef?: (el: HTMLDivElement | null) => void;
  onViewAll?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

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

  if (products.length === 0) return null;

  return (
    <div
      ref={sectionRef}
      data-section={id}
    >
      {/* Enhanced section header */}
      <div className="mb-2">
        <div className="flex items-center justify-between relative">
          {/* Gradient background behind header */}
          <div className="absolute -left-2 -right-2 -top-1 -bottom-1 bg-gradient-to-r from-brand/5 via-brand/10 to-transparent rounded-lg pointer-events-none" />
          <h2 className="text-lg font-bold flex items-center gap-2 relative z-10">
            {icon && <span className="text-xl">{icon}</span>}
            {title}
          </h2>
          <button
            onClick={onViewAll}
            className="flex items-center gap-0.5 text-sm font-medium text-brand hover:text-brand/80 transition-colors relative z-10"
          >
            Все
            <ChevronRight className="h-4 w-4 opacity-60" />
          </button>
        </div>
        {/* Decorative line under header */}
        <div className="mt-1.5 h-0.5 bg-gradient-to-r from-brand/30 via-brand/10 to-transparent rounded-full" />
      </div>

      {/* Horizontal scroll row */}
      <div className="relative">
        {/* Left gradient overlay (when scrolled right) */}
        {canScrollLeft && (
          <div className="absolute top-0 left-0 bottom-2 w-10 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
        )}
        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.map((product) => (
            <div key={product.id} className="flex-shrink-0 w-[120px] snap-start">
              <ProductCard
                variant="compact"
                product={product}
                onClick={() => onProductClick(product.id)}
                onAddToCart={onAddToCart}
                onRemoveFromCart={onRemoveFromCart}
                onToggleFavorite={(pid) => onToggleFavorite(pid)}
                isFavorite={isFavorite(product.id)}
                isInCart={isInCart(product.id)}
                cartQuantity={getCartQuantity(product.id)}
              />
            </div>
          ))}
        </div>

        {/* Right fade hint */}
        {canScrollRight && (
          <div className="absolute top-0 right-0 bottom-2 w-10 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
        )}
      </div>
    </div>
  );
}

// ─── Lazy Section (vertical 2-col grid for categories) ────────────────────────
function LazySection({
  id,
  title,
  products,
  onProductClick,
  onAddToCart,
  onRemoveFromCart,
  onToggleFavorite,
  isFavorite,
  isInCart,
  getCartQuantity,
  emoji,
  sectionRef,
}: {
  id: string;
  title: string;
  products: Product[];
  onProductClick: (id: string) => void;
  onAddToCart: (product: Product) => AddToCartResult;
  onRemoveFromCart: (productId: string) => void;
  onToggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
  isInCart: (id: string) => boolean;
  getCartQuantity: (id: string) => number;
  emoji?: string;
  sectionRef?: (el: HTMLDivElement | null) => void;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          hasLoaded.current = true;
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (innerRef.current) {
      observer.observe(innerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const setRefs = useCallback((el: HTMLDivElement | null) => {
    innerRef.current = el;
    if (sectionRef) {
      sectionRef(el);
    }
  }, [sectionRef]);

  return (
    <div
      ref={setRefs}
      data-section={id}
      style={{ minHeight: isVisible ? 'auto' : '300px' }}
    >
      {isVisible ? (
        <>
          {/* Enhanced category section header */}
          <div className="mb-3 relative">
            {/* Gradient background behind header */}
            <div className="absolute -left-2 -right-2 -top-1 -bottom-1 bg-gradient-to-r from-brand/5 via-brand/8 to-transparent rounded-lg pointer-events-none" />
            <div className="flex items-center justify-between relative z-10">
              <h2 className="text-lg font-bold flex items-center gap-2">
                {emoji && <span className="text-xl">{emoji}</span>}
                {title}
              </h2>

            </div>
            {/* Decorative line under header */}
            <div className="mt-1.5 h-0.5 bg-gradient-to-r from-brand/30 via-brand/10 to-transparent rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                variant="compact"
                product={product}
                onClick={() => onProductClick(product.id)}
                onAddToCart={onAddToCart}
                onRemoveFromCart={onRemoveFromCart}
                onToggleFavorite={(pid) => onToggleFavorite(pid)}
                isFavorite={isFavorite(product.id)}
                isInCart={isInCart(product.id)}
                cartQuantity={getCartQuantity(product.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: Math.min(4, products.length) }).map((_, j) => (
              <div key={j} className="space-y-3">
                <Skeleton className="aspect-square rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Search Result Product Card (grid layout) ─────────────────────────────
function SearchResultCard({
  product,
  getProductImage,
  isInCart,
  getCartQuantity,
  onProductClick,
  addToCart,
  updateCartQuantity,
  toast,
}: {
  product: any;
  getProductImage: (p: any) => string;
  isInCart: (id: string) => boolean;
  getCartQuantity: (id: string) => number;
  onProductClick: (id: string) => void;
  addToCart: (product: Product) => AddToCartResult;
  updateCartQuantity: (id: string, qty: number) => void;
  toast: any;
}) {
  const inCart = isInCart(product.id);
  const qty = getCartQuantity(product.id);
  const price = product.discountPrice || product.price;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-background/50 rounded-xl overflow-hidden border border-border/30 hover:border-border/60 transition-colors cursor-pointer"
      onClick={() => onProductClick(product.id)}
    >
      <div className="aspect-square bg-muted/30 relative">
        <img
          src={getProductImage(product)}
          alt={product.name}
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.svg'; }}
        />
        {product.discountPrice && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-md">
            -{Math.round((1 - product.discountPrice / product.price) * 100)}%
          </span>
        )}
      </div>
      <div className="p-2">
        <p className="font-medium line-clamp-2 text-xs leading-tight min-h-[2rem]">{product.name}</p>
        <div className="flex items-center justify-between mt-1.5">
          <div>
            <span className="text-sm font-bold">{price.toLocaleString('ru-RU')} ₽</span>
            {product.discountPrice && (
              <span className="text-[10px] text-muted-foreground line-through ml-1">{product.price.toLocaleString('ru-RU')} ₽</span>
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <CartStepper
              product={product}
              isInCart={inCart}
              cartQuantity={qty}
              onAdd={() => { const r = addToCart(product); if (r.success) toast({ title: 'Добавлено', description: product.name, duration: 1500 }); }}
              onRemove={() => { const q = getCartQuantity(product.id); if (q <= 1) updateCartQuantity(product.id, 0); else updateCartQuantity(product.id, q - 1); }}
              size="sm"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Catalog View ───────────────────────────────────────────────────────
export function CatalogView() {
  const { addToCart, updateCartQuantity, toggleFavorite, isFavorite, isInCart, getCartQuantity, setSelectedProduct, setCurrentView } = useShopStore();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<(Category & { _count?: { products: number } })[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('skeleton');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showAllMode, setShowAllMode] = useState<string | null>(null); // 'featured', 'new', or null
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isScrollingProgrammatically = useRef(false);
  const scrollRestored = useRef(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchResults, setSearchResults] = useState<any>(null); // AI search result
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // ─── Fetch data (parallel) ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      setLoadingStage('categories');
      try {
        // Load categories and products in parallel for faster initial render
        const [categoriesRes, productsRes, bannersRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/products?limit=150'),
          fetch('/api/banners'),
        ]);

        const categoriesData = await categoriesRes.json();
        const productsData = await productsRes.json();
        const bannersData = await bannersRes.json();

        setCategories(categoriesData || []);
        setProducts(productsData.products || []);
        setBanners(bannersData || []);
        setFetchError(null);
      } catch (error) {
        console.error('Error fetching data:', error);
        setFetchError('Не удалось загрузить каталог');
      }

      setLoadingStage('ready');
    };

    fetchData();
  }, []);

  // ─── Check AI status ─────────────────────────────────────────────────────
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

  // ─── Auto-focus search input when expanded ──────────────────────────────
  useEffect(() => {
    if (searchExpanded) {
      setRecentSearches(getRecentSearches());
      const t = setTimeout(() => searchInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [searchExpanded]);

  // ─── Measure header height for scroll padding ──────────────────────────
  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const rect = headerRef.current.getBoundingClientRect();
        setHeaderHeight(rect.height);
      }
    };
    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    return () => window.removeEventListener('resize', updateHeaderHeight);
  }, [loadingStage, searchExpanded]);

  // ─── Collapse search on scroll (only when no results overlay) ─────────────────
  const lastScrollTop = useRef(0);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    // No longer needed — search results are now an overlay
  }, [searchExpanded]);

  // ─── Restore scroll position ─────────────────────────────────────────────
  useEffect(() => {
    if (loadingStage === 'ready' && scrollContainerRef.current && !scrollRestored.current) {
      scrollRestored.current = true;
      const savedScroll = sessionStorage.getItem(SCROLL_POSITION_KEY);
      if (savedScroll) {
        const scrollPosition = parseInt(savedScroll, 10);
        requestAnimationFrame(() => {
          scrollContainerRef.current?.scrollTo({
            top: scrollPosition,
            behavior: 'instant' as ScrollBehavior,
          });
        });
      }
    }
  }, [loadingStage]);

  // ─── Save scroll position & track scroll progress ────────────────────────
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let timeout: NodeJS.Timeout;
    const handleScrollTick = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight - container.clientHeight;
      const progress = scrollHeight > 0 ? Math.min(scrollTop / scrollHeight, 1) : 0;
      setScrollProgress(progress);
      setShowBackToTop(scrollTop > 400);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        sessionStorage.setItem(SCROLL_POSITION_KEY, scrollTop.toString());
      }, 100);
    };

    container.addEventListener('scroll', handleScrollTick);
    return () => {
      container.removeEventListener('scroll', handleScrollTick);
      clearTimeout(timeout);
    };
  }, []);

  // ─── Product click handler ───────────────────────────────────────────────
  const handleProductClick = useCallback((productId: string) => {
    if (scrollContainerRef.current) {
      sessionStorage.setItem(SCROLL_POSITION_KEY, scrollContainerRef.current.scrollTop.toString());
    }
    setSelectedProduct(productId);
  }, [setSelectedProduct]);

  // ─── Memoized data ───────────────────────────────────────────────────────
  const featuredProducts = products.filter(p => p.isFeatured);
  const newProducts = products.filter(p => p.isNew);
  const categoriesWithProducts = categories.filter(cat => products.some(p => p.categoryId === cat.id));

  const getProductsByCategory = useCallback((categoryId: string) => {
    return products.filter(p => p.categoryId === categoryId);
  }, [products]);

  // ─── Category scroll helpers ─────────────────────────────────────────────
  const scrollToCategoryItem = useCallback((categoryId: string) => {
    const element = document.getElementById(`cat-${categoryId}`);
    if (element && categoryScrollRef.current) {
      const container = categoryScrollRef.current;
      const containerWidth = container.clientWidth;
      const elementWidth = element.clientWidth;
      const elementLeft = element.offsetLeft;

      const scrollTo = elementLeft - (containerWidth / 2) + (elementWidth / 2);

      container.scrollTo({
        left: Math.max(0, scrollTo),
        behavior: 'smooth',
      });
    }
  }, []);

  const handleCategoryClick = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
    scrollToCategoryItem(categoryId);

    if (categoryId === 'all') {
      isScrollingProgrammatically.current = true;
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 500);
    } else {
      const section = sectionRefs.current[categoryId];
      if (section && scrollContainerRef.current) {
        const currentScroll = scrollContainerRef.current.scrollTop;
        const sectionTop = section.getBoundingClientRect().top;
        // Snap section exactly below the category capsule (headerHeight from viewport top)
        const targetScroll = currentScroll + sectionTop - headerHeight;

        isScrollingProgrammatically.current = true;
        scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
        setTimeout(() => {
          isScrollingProgrammatically.current = false;
        }, 500);
      }
    }
  }, [scrollToCategoryItem, headerHeight]);

  // ─── Scroll spy ──────────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    if (isScrollingProgrammatically.current) return;
    if (!scrollContainerRef.current) return;

    const scrollTop = scrollContainerRef.current.scrollTop;
    const containerTop = scrollContainerRef.current.getBoundingClientRect().top;
    // How far below the header a section is (negative = behind header)
    const headerBottom = headerHeight - containerTop;

    const allSections: { id: string; top: number }[] = [];

    if (sectionRefs.current['featured']) {
      const rect = sectionRefs.current['featured']!.getBoundingClientRect();
      allSections.push({ id: 'featured', top: rect.top - headerBottom });
    }
    if (sectionRefs.current['new']) {
      const rect = sectionRefs.current['new']!.getBoundingClientRect();
      allSections.push({ id: 'new', top: rect.top - headerBottom });
    }

    for (const cat of categoriesWithProducts) {
      if (sectionRefs.current[cat.id]) {
        const rect = sectionRefs.current[cat.id]!.getBoundingClientRect();
        allSections.push({ id: cat.id, top: rect.top - headerBottom });
      }
    }

    let currentSection = 'all';
    let minDistance = Infinity;
    // Section is "active" when it's at or just past the snap line (header bottom)
    const snapTolerance = 60;

    for (const section of allSections) {
      if (section.top <= snapTolerance && Math.abs(section.top) < minDistance) {
        minDistance = Math.abs(section.top);
        currentSection = section.id;
      }
    }

    if (scrollTop < 20) {
      currentSection = 'all';
    }

    if (activeCategory !== currentSection) {
      setActiveCategory(currentSection);
      scrollToCategoryItem(currentSection);
    }
  }, [activeCategory, scrollToCategoryItem, categoriesWithProducts, headerHeight]);

  // ─── Cart & favorites ────────────────────────────────────────────────────
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

  const handleToggleFavorite = (productId: string) => {
    toggleFavorite(productId);
  };

  // ─── Regular text search (when AI is disabled) ──────────────────────────
  const handleRegularSearch = async (query: string) => {
    if (!query.trim()) return;
    addRecentSearch(query.trim());
    setRecentSearches(getRecentSearches());
    setAiLoading(true);
    setSearchResults(null);

    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=20`);
      const data = await res.json();
      const found = data.products || [];

      if (found.length > 0) {
        setSearchResults({
          success: true,
          response: `Найдено ${found.length} ${pluralize(found.length, 'товар', 'товара', 'товаров')}`,
          products: found,
          productIds: found.map((p: any) => p.id),
          cartActions: [],
          intent: 'search',
        });
      } else {
        setSearchResults({
          success: true,
          response: `По запросу «${query}» ничего не найдено`,
          products: [],
          productIds: [],
          cartActions: [],
          intent: 'search',
        });
      }
    } catch {
      setSearchResults({ success: false, error: 'Ошибка поиска' });
    } finally {
      setAiLoading(false);
    }
  };

  // ─── AI Search handler ───────────────────────────────────────────────────
  const handleAISearch = async (query: string) => {
    if (!query.trim()) return;

    // When AI is disabled, use regular text search
    if (!aiEnabled) {
      handleRegularSearch(query);
      return;
    }

    addRecentSearch(query.trim());
    setRecentSearches(getRecentSearches());
    setAiLoading(true);
    setSearchResults(null);

    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();

      // If AI is disabled on server, fall back to regular search
      if (data.enabled === false || res.status === 503) {
        setAiEnabled(false);
        try { sessionStorage.setItem('suhpay_ai_enabled', 'false'); } catch {}
        handleRegularSearch(query);
        return;
      }

      if (data.success) {
        setSearchResults(data);
        // Execute cart actions if any
        if (data.cartActions && data.cartActions.length > 0) {
          for (const action of data.cartActions) {
            const product = action.product;
            if (product) {
              addToCart(product);
              toast({
                title: 'Добавлено в корзину',
                description: `${action.quantity > 1 ? action.quantity + ' x ' : ''}${product.name}`,
                duration: 1500,
              });
            }
          }
        }
      } else {
        setSearchResults({ success: false, error: data.error || 'Ошибка поиска' });
      }
    } catch {
      // Network error — fall back to regular search
      handleRegularSearch(query);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      handleAISearch(searchQuery);
      setSearchQuery('');
    }
    if (e.key === 'Escape') {
      closeSearch();
    }
  };

  const closeSearch = () => {
    setSearchExpanded(false);
    setSearchQuery('');
    setSearchResults(null);
    // Scroll catalog back to top when closing search
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const removeRecentSearch = (query: string) => {
    try {
      const existing = getRecentSearches();
      const updated = existing.filter(s => s !== query);
      sessionStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      setRecentSearches(updated);
    } catch {}
  };

  const clearRecentSearch = () => {
    try {
      sessionStorage.removeItem(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
    } catch {}
  };

  // ─── Product image helper ────────────────────────────────────────────────
  const getProductImage = (product: any): string => {
    try {
      const imgs = product.images ? JSON.parse(product.images) : [];
      return Array.isArray(imgs) && imgs[0] ? imgs[0] : '/placeholder-product.svg';
    } catch { return '/placeholder-product.svg'; }
  };

  // ─── Search result product card (inline list) ─────────────────────────────
  const renderSearchProduct = (product: any) => {
    const inCart = isInCart(product.id);
    const qty = getCartQuantity(product.id);
    return (
      <div
        key={product.id}
        className="flex items-center gap-3 p-2.5 hover:bg-muted/50 text-left transition-colors cursor-pointer"
        onClick={() => handleProductClick(product.id)}
      >
        <div className="w-12 h-12 bg-muted rounded-xl overflow-hidden flex-shrink-0">
          <img src={getProductImage(product)} alt={product.name} className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.svg'; }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium line-clamp-1 text-sm">{product.name}</p>
          <p className="text-sm text-muted-foreground">
            {(product.discountPrice || product.price).toLocaleString('ru-RU')} ₽
          </p>
        </div>
        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <CartStepper product={product} isInCart={inCart} cartQuantity={qty}
            onAdd={() => { const r = addToCart(product); if (r.success) toast({ title: 'Добавлено', description: product.name, duration: 1500 }); }}
            onRemove={() => { const q = getCartQuantity(product.id); if (q <= 1) updateCartQuantity(product.id, 0); else updateCartQuantity(product.id, q - 1); }}
            size="sm" />
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      {/* ═══ ABSOLUTE HEADER — morphing capsule (categories ↔ search) ═══ */}
      <div ref={headerRef} className="absolute top-0 left-0 right-0 z-50 px-2 pt-2">
        <motion.div
          className="relative mx-auto max-w-lg rounded-2xl"
          layout
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        >
          {/* Liquid Glass background */}
          <div className="absolute inset-0 bg-black/5 dark:bg-black/20 backdrop-blur-[2rem] saturate-[1.5] rounded-2xl -z-10 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-white/8 dark:from-white/10 dark:via-white/2 dark:to-white/5 rounded-2xl -z-10 pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent dark:via-white/15 pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-black/5 dark:bg-black/10 pointer-events-none" />
          <div className="absolute inset-0 shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.2),inset_0_-0.5px_0.5px_rgba(0,0,0,0.04)] dark:shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.1),inset_0_-0.5px_0.5px_rgba(0,0,0,0.1)] -z-10 rounded-2xl pointer-events-none" />

          {/* ─── Category scroll with 🔍 ─── */}
          <div className="flex items-center px-2 pb-1.5 pt-1.5">
            {/* Search toggle icon */}
            <button
              onClick={() => setSearchExpanded(true)}
              className={cn(
                'flex-shrink-0 flex items-center justify-center w-7 h-7 mr-1 rounded-full transition-all duration-200',
                'border',
                'bg-white/[0.08] dark:bg-white/[0.04] border-white/[0.12] dark:border-white/[0.06]',
                'text-muted-foreground hover:text-foreground hover:bg-white/[0.14] dark:hover:bg-white/[0.08] active:scale-95'
              )}
              aria-label="Открыть поиск"
            >
              <Search className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
                {/* Category Navigation */}
                <div
                  ref={categoryScrollRef}
                  className="flex gap-1 overflow-x-auto px-0 py-0.5 scroll-smooth flex-1"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {/* Featured / Popular */}
                  {featuredProducts.length > 0 && (
                    <button
                      id="cat-featured"
                      onClick={() => handleCategoryClick('featured')}
                      className={cn(
                        'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full transition-all duration-200 border',
                        activeCategory === 'featured'
                          ? 'bg-white/[0.14] dark:bg-white/[0.07] border-white/[0.22] dark:border-white/[0.09] text-foreground font-semibold shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.3),0_1px_3px_rgba(0,0,0,0.06)]'
                          : 'bg-white/[0.05] dark:bg-white/[0.02] border-white/[0.08] dark:border-white/[0.04] text-muted-foreground shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.1)] hover:bg-white/[0.08] dark:hover:bg-white/[0.04]'
                      )}
                    >
                      <span className="text-[10px]">🔥</span>
                      <span className="text-[10px] leading-tight font-medium whitespace-nowrap">Популярные</span>
                    </button>
                  )}
                  {/* New */}
                  {newProducts.length > 0 && (
                    <button
                      id="cat-new"
                      onClick={() => handleCategoryClick('new')}
                      className={cn(
                        'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full transition-all duration-200 border',
                        activeCategory === 'new'
                          ? 'bg-white/[0.14] dark:bg-white/[0.07] border-white/[0.22] dark:border-white/[0.09] text-foreground font-semibold shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.3),0_1px_3px_rgba(0,0,0,0.06)]'
                          : 'bg-white/[0.05] dark:bg-white/[0.02] border-white/[0.08] dark:border-white/[0.04] text-muted-foreground shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.1)] hover:bg-white/[0.08] dark:hover:bg-white/[0.04]'
                      )}
                    >
                      <span className="text-[10px]">✨</span>
                      <span className="text-[10px] leading-tight font-medium whitespace-nowrap">Новинки</span>
                    </button>
                  )}
                  {/* Categories */}
                  {categoriesWithProducts.map((category) => {
                    const icon = getCategoryIcon(category);
                    return (
                      <button
                        key={category.id}
                        id={`cat-${category.id}`}
                        onClick={() => handleCategoryClick(category.id)}
                        className={cn(
                          'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full transition-all duration-200 border',
                          activeCategory === category.id
                            ? 'bg-white/[0.14] dark:bg-white/[0.07] border-white/[0.22] dark:border-white/[0.09] text-foreground font-semibold shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.3),0_1px_3px_rgba(0,0,0,0.06)]'
                            : 'bg-white/[0.05] dark:bg-white/[0.02] border-white/[0.08] dark:border-white/[0.04] text-muted-foreground shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.1)] hover:bg-white/[0.08] dark:hover:bg-white/[0.04]'
                        )}
                      >
                        {category.imageUrl ? (
                          <img src={category.imageUrl} alt={category.name}
                            className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                        ) : null}
                        <span className={cn('text-[10px]', category.imageUrl && 'hidden')}>{icon}</span>
                        <span className="text-[10px] leading-tight font-medium whitespace-nowrap">{category.name}</span>
                      </button>
                    );
                  })}
                </div>
          </div>

        </motion.div>

        {/* ═══ SEARCH DROPDOWN — slides from capsule, 1/3 of viewport ═══ */}
        <AnimatePresence>
          {searchExpanded && (
            <motion.div
              initial={{ opacity: 0, y: -8, scaleY: 0.95 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -8, scaleY: 0.95 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute left-2 right-2 top-full mt-1.5 z-[60] mx-auto max-w-lg"
            style={{ transformOrigin: 'top center' }}
          >
            {/* Backdrop click catcher */}
            <div className="fixed inset-0 -z-10" onClick={closeSearch} />

            {/* Glass card */}
            <div className="rounded-2xl border border-border/40 shadow-xl shadow-black/10 dark:shadow-black/30 overflow-hidden"
              style={{ maxHeight: '33.33vh' }}
            >
              <div className="bg-background/[0.85] dark:bg-background/[0.85] backdrop-blur-xl">
                {/* Search input row */}
                <div className="shrink-0 px-3 py-2 flex items-center gap-2 border-b border-border/30">
                  <button
                    onClick={closeSearch}
                    className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all"
                    aria-label="Закрыть поиск"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="relative flex-1">
                    <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" strokeWidth={2} />
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Что ищем?"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      className="w-full bg-transparent text-sm outline-none placeholder:text-foreground/40 min-w-0 pl-4"
                    />
                  </div>
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="flex-shrink-0 text-muted-foreground hover:text-foreground active:scale-95 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {(aiEnabled ? searchQuery.length >= 1 : searchQuery.length >= 2) && (
                    <button
                      onClick={() => { handleAISearch(searchQuery); setSearchQuery(''); }}
                      disabled={aiLoading}
                      className={cn(
                        'flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200',
                        aiEnabled
                          ? 'bg-purple-500 hover:bg-purple-600 text-white'
                          : 'bg-foreground/10 hover:bg-foreground/20',
                        'active:scale-95',
                        aiLoading && 'opacity-60'
                      )}
                    >
                      {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : (aiEnabled ? <Send className="h-3 w-3" /> : <Search className="h-3 w-3" />)}
                    </button>
                  )}
                </div>

                {/* Scrollable results */}
                <div className="overflow-y-auto" style={{ maxHeight: 'calc(33.33vh - 3rem)' }}>
                  {/* Loading */}
                  {aiLoading && !searchResults && (
                    <div className="flex items-center gap-2 text-muted-foreground px-4 py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                      <span className="text-sm">Думаю...</span>
                    </div>
                  )}

                  {/* Results */}
                  {searchResults && searchResults.success && (
                    <div>
                      {searchResults.response && searchResults.products?.length > 0 && (
                        <p className="text-xs text-muted-foreground px-3 pt-2 pb-1">{searchResults.response}</p>
                      )}
                      {searchResults.response && !searchResults.products?.length && (
                        <div className="px-3 py-2">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{searchResults.response}</p>
                        </div>
                      )}
                      {searchResults.products?.length > 0 && (
                        <div className="divide-y divide-border/30">
                          {searchResults.products.map((p: any) => (
                            <div
                              key={p.id}
                              className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/40 active:bg-muted/60 transition-colors cursor-pointer"
                              onClick={() => { closeSearch(); handleProductClick(p.id); }}
                            >
                              <div className="w-9 h-9 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                                <img src={getProductImage(p)} alt={p.name} className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.svg'; }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-xs leading-tight line-clamp-1">{p.name}</p>
                                {p.category?.name && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.category.name}</p>
                                )}
                              </div>
                              <div className="flex-shrink-0 flex items-center gap-1.5">
                                <span className="text-xs font-bold">{(p.discountPrice || p.price).toLocaleString('ru-RU')} ₽</span>
                                <div onClick={(e) => e.stopPropagation()}>
                                  <CartStepper
                                    product={p}
                                    isInCart={isInCart(p.id)}
                                    cartQuantity={getCartQuantity(p.id)}
                                    onAdd={() => { const r = addToCart(p); if (r.success) toast({ title: 'Добавлено', description: p.name, duration: 1500 }); }}
                                    onRemove={() => { const q = getCartQuantity(p.id); if (q <= 1) updateCartQuantity(p.id, 0); else updateCartQuantity(p.id, q - 1); }}
                                    size="sm"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error */}
                  {searchResults && !searchResults.success && (
                    <div className="px-3 py-3">
                      <p className="text-xs text-destructive">{searchResults.error}</p>
                    </div>
                  )}

                  {/* Empty hints */}
                  {searchExpanded && !searchResults && !aiLoading && !searchQuery && (
                    <div className="px-3 py-2">
                      {recentSearches.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[11px] font-medium text-muted-foreground">Недавние</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {recentSearches.map((q) => (
                              <button
                                key={q}
                                className="px-2 py-1 text-[11px] rounded-full bg-foreground/5 dark:bg-foreground/10 text-foreground/70 hover:bg-foreground/10 dark:hover:bg-foreground/15 transition-colors"
                                onClick={() => { handleAISearch(q); setSearchQuery(''); }}
                              >
                                {q}
                              </button>
                            ))}
                            <button
                              className="px-2 py-1 text-[11px] rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                              onClick={() => { clearRecentSearch(); setRecentSearches([]); }}
                            >
                              Очистить
                            </button>
                          </div>
                        </div>
                      )}

                      {aiEnabled && (
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Sparkles className="h-3 w-3 text-purple-500" />
                            <span className="text-[11px] font-medium text-muted-foreground">Попробуйте спросить</span>
                          </div>
                          <div className="space-y-1">
                            {['Что-нибудь остренькое 🌶️', 'Собери набор для вечеринки 🎉', 'Подарок до 300₽ 🎁', 'Что нового? 🆕'].map((hint) => (
                              <button
                                key={hint}
                                className="w-full text-left px-2.5 py-1.5 text-[11px] rounded-lg bg-foreground/[0.03] dark:bg-foreground/[0.06] text-foreground/70 hover:bg-foreground/[0.06] dark:hover:bg-foreground/[0.1] transition-colors"
                                onClick={() => { handleAISearch(hint); setSearchQuery(''); }}
                              >
                                {hint}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {!aiEnabled && (
                        <div className="text-center py-4">
                          <Package className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                          <p className="text-xs text-muted-foreground">Введите название товара</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">Минимум 2 символа</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
      {/* ═══ END HEADER ═══ */}

      {/* ═══ SCROLLABLE CONTENT — behind header ═══ */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-auto pb-14"
        style={{ paddingTop: headerHeight || undefined }}
      >
          <div className="p-3 space-y-3">
          {/* Banners — Enhanced integration */}
          {banners.length > 0 && (
            <div className="rounded-2xl overflow-hidden shadow-lg shadow-black/5 dark:shadow-black/20 p-1 bg-gradient-to-br from-white/50 to-white/0 dark:from-white/5 dark:to-white/0">
              <BannerCarousel banners={banners} />
              {/* Banner navigation dots (separate from carousel dots, as a subtle footer) */}
              {banners.length > 1 && (
                <div className="flex justify-center gap-1 py-2">
                  {banners.map((banner, idx) => (
                    <div
                      key={banner.id}
                      className="h-1 rounded-full bg-foreground/10 transition-all duration-300"
                      style={{ width: idx === 0 ? 16 : 6 }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Loading States ─────────────────────────────────────────── */}
          {loadingStage !== 'ready' && (
            <div className="space-y-4">
              {/* Category cards skeleton */}
              {loadingStage === 'skeleton' && (
                <div className="flex gap-2 overflow-hidden">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 min-w-[64px]">
                      <Skeleton className="w-10 h-10 rounded-xl" />
                      <Skeleton className="h-3 w-12 rounded" />
                    </div>
                  ))}
                </div>
              )}

              {/* Horizontal row skeleton */}
              <div className="space-y-3">
                <Skeleton className="h-6 w-36" />
                <div className="flex gap-2 overflow-hidden">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex-shrink-0 w-[120px] space-y-3">
                      <Skeleton className="aspect-square rounded-xl" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid section skeleton */}
              <div className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <div key={j} className="space-y-3">
                      <Skeleton className="aspect-square rounded-xl" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── Ready Content ──────────────────────────────────────────── */}
          {loadingStage === 'ready' && (
            <>
              {/* ─── Show All Mode (Popular / New) ─────────────────────── */}
              {showAllMode && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowAllMode(null)}
                      className="text-sm text-brand font-medium"
                    >
                      ← Назад
                    </button>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <span>{showAllMode === 'featured' ? '🔥' : '✨'}</span>
                      {showAllMode === 'featured' ? 'Все популярные' : 'Все новинки'}
                    </h2>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(showAllMode === 'featured' ? featuredProducts : newProducts).map((product) => (
                      <ProductCard
                        key={product.id}
                        variant="compact"
                        product={product}
                        onClick={() => handleProductClick(product.id)}
                        onAddToCart={handleAddToCart}
                        onRemoveFromCart={handleDecrementCart}
                        onToggleFavorite={handleToggleFavorite}
                        isFavorite={isFavorite(product.id)}
                        isInCart={isInCart(product.id)}
                        cartQuantity={getCartQuantity(product.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ─── Normal catalog view ──────────────────────────────── */}
              {!showAllMode && (
              <>
              {/* Featured Products — Horizontal Scroll Row (Samokat style!) */}
              {featuredProducts.length > 0 && (
                <HorizontalProductRow
                  id="featured"
                  title="Популярные"
                  icon="🔥"
                  products={featuredProducts}
                  onProductClick={handleProductClick}
                  onAddToCart={handleAddToCart}
                  onRemoveFromCart={handleDecrementCart}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorite={isFavorite}
                  isInCart={isInCart}
                  getCartQuantity={getCartQuantity}
                  sectionRef={(el) => { if (el) sectionRefs.current['featured'] = el; }}
                  onViewAll={() => setShowAllMode('featured')}
                />
              )}

              {/* New Products — Horizontal Scroll Row (Samokat style!) */}
              {newProducts.length > 0 && (
                <HorizontalProductRow
                  id="new"
                  title="Новинки"
                  icon="✨"
                  products={newProducts}
                  onProductClick={handleProductClick}
                  onAddToCart={handleAddToCart}
                  onRemoveFromCart={handleDecrementCart}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorite={isFavorite}
                  isInCart={isInCart}
                  getCartQuantity={getCartQuantity}
                  sectionRef={(el) => { if (el) sectionRefs.current['new'] = el; }}
                  onViewAll={() => setShowAllMode('new')}
                />
              )}

              {/* Category Sections — Vertical 2-column grid */}
              {categoriesWithProducts.map((category) => {
                const categoryProducts = getProductsByCategory(category.id);
                if (categoryProducts.length === 0) return null;

                return (
                  <LazySection
                    key={category.id}
                    id={category.id}
                    title={category.name}
                    products={categoryProducts}
                    onProductClick={handleProductClick}
                    onAddToCart={handleAddToCart}
                    onRemoveFromCart={handleDecrementCart}
                    onToggleFavorite={handleToggleFavorite}
                    isFavorite={isFavorite}
                    isInCart={isInCart}
                    getCartQuantity={getCartQuantity}
                    emoji={getCategoryIcon(category)}
                    sectionRef={(el) => {
                      if (el) sectionRefs.current[category.id] = el;
                    }}
                  />
                );
              })}

              {/* Error State */}
              {fetchError && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <Package className="h-8 w-8 text-destructive" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-destructive">{fetchError}</p>
                    <p className="text-sm text-muted-foreground mt-1">Проверьте подключение к интернету</p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setFetchError(null);
                      setLoadingStage('skeleton');
                      // Re-trigger fetch by calling inline
                      (async () => {
                        try {
                          const [productsRes, bannersRes] = await Promise.all([
                            fetch('/api/products?limit=150'),
                            fetch('/api/banners'),
                          ]);
                          const productsData = await productsRes.json();
                          const bannersData = await bannersRes.json();
                          setProducts(productsData.products || []);
                          setBanners(bannersData || []);
                          setFetchError(null);
                        } catch (error) {
                          console.error('Error fetching products:', error);
                          setFetchError('Не удалось загрузить каталог');
                        }
                        setLoadingStage('ready');
                      })();
                    }}
                  >
                    Попробовать снова
                  </Button>
                </div>
              )}

              {/* Empty State */}
              {products.length === 0 && !fetchError && (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-lg mb-2">Товары не найдены</p>
                  <p className="text-sm text-muted-foreground">
                    Попробуйте изменить параметры поиска
                  </p>
                </div>
              )}
              </>
              )}
            </>
          )}
          </div>
      </div>

      {/* Enhanced Back to Top Button */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Наверх"
            className="fixed bottom-20 right-4 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full bg-gradient-to-r from-brand to-brand/80 text-brand-foreground shadow-lg shadow-brand/20 hover:shadow-brand/30 active:scale-95 transition-shadow"
          >
            <div className="relative flex items-center justify-center">
              <MiniProgressRing progress={scrollProgress} size={22} strokeWidth={2.5} />
              <ArrowUp className="h-3 w-3 absolute" />
            </div>
            <span className="text-xs font-medium">Наверх</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
