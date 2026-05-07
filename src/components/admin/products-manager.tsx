'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useShopStore, Product, Category } from '@/stores/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ChevronLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  Image as ImageIcon,
  Save,
  X,
  MoreVertical,
  Star,
  Sparkles,
  Eye,
  EyeOff,
  XCircle,
  Upload,
  Loader2,
  Settings2,
  RefreshCw,
  Copy,
  ArrowUpDown,
  AlertTriangle,
  Warehouse,
  Coins,
  Download,
  FileJson,
  FileSpreadsheet,
  LayoutGrid,
  LayoutList,
  Clock,
  TrendingUp,
  Percent,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Filter,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { cn, pluralize } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

// Sort type
type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'stock-asc' | 'stock-desc' | 'date-desc' | 'date-asc' | 'rating-desc' | 'rating-asc';

// Stock filter type
type StockFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock';

// View mode type
type ViewMode = 'list' | 'grid';

// Inline stock editing state
interface InlineEditState {
  productId: string;
  value: string;
}

// Batch price update mode
type BatchPriceMode = 'percentage' | 'fixed';
// Attribute templates for quick add
const ATTRIBUTE_TEMPLATES = [
  { name: 'Вес', value: '' },
  { name: 'Состав', value: '' },
  { name: 'Пищевая ценность', value: '' },
  { name: 'Энергетическая ценность', value: '' },
  { name: 'Срок годности', value: '' },
  { name: 'Условия хранения', value: '' },
  { name: 'Страна производства', value: '' },
  { name: 'Объём', value: '' },
  { name: 'Количество в упаковке', value: '' },
] as const;

// Helper: get product images from JSON
function getProductImages(product: Product): string[] {
  try {
    const imagesRaw = product.images ? JSON.parse(product.images) : [];
    return Array.isArray(imagesRaw) ? imagesRaw.filter((u: unknown) => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

// Helper: get relative time for recently modified indicator
function getRelativeTime(dateStr: string): string | null {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  return null; // more than an hour - don't show indicator
}

// Helper: compute financial insights for a product
function getFinancialInsights(product: Product): { markup: number; margin: number; profit: number } | null {
  if (product.purchasePrice == null || product.purchasePrice <= 0 || product.price <= 0) return null;
  const pp = product.purchasePrice;
  const pr = product.price;
  return {
    markup: ((pr - pp) / pp) * 100,
    margin: ((pr - pp) / pr) * 100,
    profit: pr - pp,
  };
}

// Spring config as const for framer-motion
const springConfig = { type: 'spring' as const, stiffness: 300, damping: 30 };
const staggerConfig = { staggerChildren: 0.04 };

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { ...staggerConfig },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: springConfig,
  },
};

export function ProductsManager() {
  const { setCurrentView } = useShopStore();
  const { toast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingStage, setLoadingStage] = useState<'loading' | 'ready'>('loading');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> & { imageUrls?: string[]; attributesList?: { name: string; value: string }[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<number | null>(null);
  const uploadIndexRef = useRef<number>(0);

  // Bulk selection state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkActionDialog, setBulkActionDialog] = useState<'hide' | 'show' | 'delete' | 'price' | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'hidden'>('active');

  // Sort, stock filter, refresh, inline stock editing
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);
  const inlineEditRef = useRef<HTMLInputElement>(null);

  // NEW: View mode toggle
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // NEW: Price range filter
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');

  // NEW: Quick view sheet
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // NEW: Batch price update state
  const [batchPriceMode, setBatchPriceMode] = useState<BatchPriceMode>('percentage');
  const [batchPriceValue, setBatchPriceValue] = useState<string>('');
  const [batchPriceDirection, setBatchPriceDirection] = useState<'up' | 'down'>('up');

  // NEW: Export dialog
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Fetch data function (reusable for refresh)
  const fetchData = useCallback(async () => {
    try {
      const [categoriesRes, productsRes] = await Promise.all([
        fetch('/api/categories?includeInactive=true'),
        fetch('/api/products?limit=150&all=true'),
      ]);

      const categoriesData = await categoriesRes.json();
      const productsData = await productsRes.json();

      setCategories(categoriesData || []);
      setProducts(productsData.products || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, []);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast({ title: 'Данные обновлены' });
  }, [fetchData, toast]);

  useEffect(() => {
    const load = async () => {
      await fetchData();
      setLoadingStage('ready');
    };
    load();
  }, [fetchData]);

  // Focus inline edit input when it appears
  useEffect(() => {
    if (inlineEdit && inlineEditRef.current) {
      inlineEditRef.current.focus();
      inlineEditRef.current.select();
    }
  }, [inlineEdit]);

  // Split products into active and hidden
  const activeProducts = products.filter(p => p.isActive);
  const hiddenProducts = products.filter(p => !p.isActive);



  // Memoize filtered and sorted products (with price range filter)
  const filteredProducts = useMemo(() => {
    const sourceList = activeTab === 'active' ? activeProducts : hiddenProducts;
    const minPrice = priceMin ? parseFloat(priceMin) : 0;
    const maxPrice = priceMax ? parseFloat(priceMax) : Infinity;

    const filtered = sourceList.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const matchesStock = stockFilter === 'all' ||
        (stockFilter === 'in-stock' && p.stock > 0) ||
        (stockFilter === 'low-stock' && p.stock > 0 && p.stock <= 5) ||
        (stockFilter === 'out-of-stock' && p.stock === 0);
      const matchesPrice = p.price >= minPrice && p.price <= maxPrice;
      return matchesSearch && matchesCategory && matchesStock && matchesPrice;
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'name-asc': return a.name.localeCompare(b.name, 'ru');
        case 'name-desc': return b.name.localeCompare(a.name, 'ru');
        case 'price-asc': return a.price - b.price;
        case 'price-desc': return b.price - a.price;
        case 'stock-asc': return a.stock - b.stock;
        case 'stock-desc': return b.stock - a.stock;
        case 'date-desc': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'date-asc': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'rating-desc': return (b.rating || 0) - (a.rating || 0);
        case 'rating-asc': return (a.rating || 0) - (b.rating || 0);
        default: return 0;
      }
    });

    return sorted;
  }, [activeProducts, hiddenProducts, activeTab, searchQuery, selectedCategory, stockFilter, sortOption, priceMin, priceMax]);

  // Price range for filtered view
  const priceRange = useMemo(() => {
    if (filteredProducts.length === 0) return null;
    const prices = filteredProducts.map(p => p.price);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [filteredProducts]);

  // Selection handlers
  const toggleProductSelection = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  // ============ EXPORT PRODUCTS ============
  const handleExport = useCallback((format: 'csv' | 'json') => {
    const dataToExport = filteredProducts.map(p => {
      const images = getProductImages(p);
      const category = categories.find(c => c.id === p.categoryId);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: p.price,
        purchasePrice: p.purchasePrice ?? '',
        discountPrice: p.discountPrice ?? '',
        stock: p.stock,
        category: category?.name || '',
        isActive: p.isActive,
        isFeatured: p.isFeatured,
        isNew: p.isNew,
        rating: p.rating,
        reviewCount: p.reviewCount,
        images: images.join('; '),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === 'json') {
      content = JSON.stringify(dataToExport, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    } else {
      const headers = Object.keys(dataToExport[0] || {});
      const csvRows = [
        headers.join(','),
        ...dataToExport.map(row =>
          headers.map(h => {
            const val = String((row as Record<string, unknown>)[h] ?? '');
            return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
          }).join(',')
        ),
      ];
      content = csvRows.join('\n');
      mimeType = 'text/csv';
      extension = 'csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-${new Date().toISOString().slice(0, 10)}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
    setExportDialogOpen(false);
    toast({
      title: `Экспорт завершен`,
      description: `${dataToExport.length} товаров экспортировано в ${extension.toUpperCase()}`,
    });
  }, [filteredProducts, categories, toast]);

  // Bulk actions
  const handleBulkAction = async () => {
    if (selectedProducts.size === 0 || !bulkActionDialog) return;

    const productIds = Array.from(selectedProducts);

    try {
      if (bulkActionDialog === 'delete') {
        for (const id of productIds) {
          await fetch(`/api/products/${id}`, { method: 'DELETE' });
        }
        setProducts(products.filter(p => !selectedProducts.has(p.id)));
        toast({ title: `Удалено ${selectedProducts.size} ${pluralize(selectedProducts.size, 'товар', 'товара', 'товаров')}` });
      } else if (bulkActionDialog === 'price') {
        // Batch price update
        const val = parseFloat(batchPriceValue);
        if (isNaN(val) || val <= 0) {
          toast({ title: 'Укажите корректное значение', variant: 'destructive' });
          return;
        }
        const selectedProds = products.filter(p => selectedProducts.has(p.id));
        for (const product of selectedProds) {
          let newPrice = product.price;
          if (batchPriceMode === 'percentage') {
            const change = product.price * (val / 100);
            newPrice = batchPriceDirection === 'up'
              ? Math.round((product.price + change) * 100) / 100
              : Math.round(Math.max(0, product.price - change) * 100) / 100;
          } else {
            newPrice = batchPriceDirection === 'up'
              ? Math.round((product.price + val) * 100) / 100
              : Math.round(Math.max(0, product.price - val) * 100) / 100;
          }
          await fetch(`/api/products/${product.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ price: newPrice }),
          });
        }
        setProducts(prev => prev.map(p => {
          if (!selectedProducts.has(p.id)) return p;
          let newPrice = p.price;
          if (batchPriceMode === 'percentage') {
            const change = p.price * (val / 100);
            newPrice = batchPriceDirection === 'up'
              ? Math.round((p.price + change) * 100) / 100
              : Math.round(Math.max(0, p.price - change) * 100) / 100;
          } else {
            newPrice = batchPriceDirection === 'up'
              ? Math.round((p.price + val) * 100) / 100
              : Math.round(Math.max(0, p.price - val) * 100) / 100;
          }
          return { ...p, price: newPrice };
        }));
        toast({
          title: `Цены обновлены`,
          description: `${selectedProducts.size} ${pluralize(selectedProducts.size, 'товар', 'товара', 'товаров')}: ${batchPriceDirection === 'up' ? '+' : '-'}${batchPriceMode === 'percentage' ? val + '%' : val + ' ₽'}`,
        });
        setBatchPriceValue('');
      } else {
        const isActive = bulkActionDialog === 'show';
        for (const id of productIds) {
          await fetch(`/api/products/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive }),
          });
        }
        setProducts(products.map(p =>
          selectedProducts.has(p.id) ? { ...p, isActive } : p
        ));
        toast({
          title: isActive ? `Показано ${selectedProducts.size} ${pluralize(selectedProducts.size, 'товар', 'товара', 'товаров')}` : `Скрыто ${selectedProducts.size} ${pluralize(selectedProducts.size, 'товар', 'товара', 'товаров')}`
        });
      }
      setSelectedProducts(new Set());
    } catch (error) {
      console.error('Error performing bulk action:', error);
      toast({ title: 'Ошибка выполнения действия', variant: 'destructive' });
    }

    setBulkActionDialog(null);
  };

  // Quick toggle isNew / isFeatured
  const handleQuickToggle = async (product: Product, field: 'isNew' | 'isFeatured') => {
    const newValue = !product[field];
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue }),
      });
      if (res.ok) {
        setProducts(products.map(p => p.id === product.id ? { ...p, [field]: newValue } : p));
        toast({
          title: newValue
            ? (field === 'isNew' ? 'Отмечено как новинка' : 'Отмечено как популярное')
            : (field === 'isNew' ? 'Новинка снята' : 'Популярное снято'),
        });
      }
    } catch {
      toast({ title: 'Ошибка обновления', variant: 'destructive' });
    }
  };

  // Duplicate product
  const handleDuplicateProduct = async (product: Product) => {
    try {
      const images = getProductImages(product);

      let attributesList: { name: string; value: string }[] = [];
      if (product.attributes) {
        try {
          const parsed = JSON.parse(product.attributes);
          if (Array.isArray(parsed)) attributesList = parsed;
        } catch { /* ignore */ }
      }

      const autoSku = `SKU-${Date.now().toString(36).toUpperCase()}`;
      const body: Record<string, unknown> = {
        name: `${product.name} (копия)`,
        sku: autoSku,
        slug: `${product.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-copy`,
        description: product.description,
        price: product.price,
        purchasePrice: product.purchasePrice,
        discountPrice: product.discountPrice,
        categoryId: product.categoryId,
        stock: 0,
        skuCount: 0,
        isActive: false,
        isFeatured: false,
        isNew: false,
        images: images.length > 0 ? JSON.stringify(images) : null,
        attributes: attributesList.length > 0 ? JSON.stringify(attributesList) : null,
      };

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const raw = await res.json();
        const toNum = (v: unknown, fallback = 0) => {
          const n = typeof v === 'number' ? v : parseFloat(String(v));
          return Number.isFinite(n) ? n : fallback;
        };
        const toInt = (v: unknown, fallback = 0) => {
          const n = typeof v === 'number' ? v : parseInt(String(v), 10);
          return Number.isFinite(n) ? n : fallback;
        };
        const savedProduct: Product = {
          ...raw,
          price: toNum(raw.price, 0),
          purchasePrice: raw.purchasePrice != null ? toNum(raw.purchasePrice, 0) : null,
          discountPrice: raw.discountPrice != null ? toNum(raw.discountPrice, 0) : null,
          stock: toInt(raw.stock, 0),
          skuCount: toInt(raw.skuCount, 0),
          rating: toNum(raw.rating, 0),
          reviewCount: toInt(raw.reviewCount, 0),
        };
        setProducts(prev => [savedProduct, ...prev]);
        toast({
          title: 'Товар дублирован',
          description: `${product.name} (копия) — скрыт, остаток: 0`,
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        toast({
          title: 'Ошибка',
          description: errData.error || 'Не удалось дублировать товар',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Ошибка дублирования', variant: 'destructive' });
    }
  };

  // Inline stock editing
  const handleStockClick = (product: Product) => {
    setInlineEdit({ productId: product.id, value: String(product.stock) });
  };

  const handleStockSave = async () => {
    if (!inlineEdit) return;
    const newStock = parseInt(inlineEdit.value, 10);
    if (isNaN(newStock) || newStock < 0) {
      setInlineEdit(null);
      return;
    }

    const product = products.find(p => p.id === inlineEdit.productId);
    if (!product || product.stock === newStock) {
      setInlineEdit(null);
      return;
    }

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock }),
      });
      if (res.ok) {
        const raw = await res.json();
        const toNum = (v: unknown, fallback = 0) => {
          const n = typeof v === 'number' ? v : parseFloat(String(v));
          return Number.isFinite(n) ? n : fallback;
        };
        const toInt = (v: unknown, fallback = 0) => {
          const n = typeof v === 'number' ? v : parseInt(String(v), 10);
          return Number.isFinite(n) ? n : fallback;
        };
        const savedProduct: Product = {
          ...raw,
          price: toNum(raw.price, 0),
          purchasePrice: raw.purchasePrice != null ? toNum(raw.purchasePrice, 0) : null,
          discountPrice: raw.discountPrice != null ? toNum(raw.discountPrice, 0) : null,
          stock: toInt(raw.stock, 0),
          skuCount: toInt(raw.skuCount, 0),
          rating: toNum(raw.rating, 0),
          reviewCount: toInt(raw.reviewCount, 0),
        };
        setProducts(prev => prev.map(p => p.id === product.id ? savedProduct : p));
        toast({
          title: 'Остаток обновлен',
          description: `${product.name}: ${product.stock} → ${newStock}`,
        });
      } else {
        toast({ title: 'Ошибка обновления остатка', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка обновления остатка', variant: 'destructive' });
    }
    setInlineEdit(null);
  };

  const handleStockKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStockSave();
    } else if (e.key === 'Escape') {
      setInlineEdit(null);
    }
  };

  const handleEditProduct = (product: Product) => {
    const images = getProductImages(product);

    let attributesList: { name: string; value: string }[] = [];
    if (product.attributes) {
      try {
        const parsed = JSON.parse(product.attributes);
        if (Array.isArray(parsed)) {
          attributesList = parsed;
        }
      } catch {
        // Ignore parse errors
      }
    }

    const toNum = (v: unknown, fallback = 0) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : fallback;
    };
    const toInt = (v: unknown, fallback = 0) => {
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      return Number.isFinite(n) ? n : fallback;
    };

    setEditingProduct({
      ...product,
      price: toNum(product.price, 0),
      purchasePrice: product.purchasePrice != null ? toNum(product.purchasePrice, 0) : null,
      discountPrice: product.discountPrice != null ? toNum(product.discountPrice, 0) : null,
      stock: toInt(product.stock, 0),
      skuCount: toInt(product.skuCount, 0),
      imageUrls: images.length > 0 ? images : [''],
      attributesList,
    });
    setEditDialogOpen(true);
  };

  const handleCreateProduct = () => {
    const autoSku = `SKU-${Date.now().toString(36).toUpperCase()}`;
    setEditingProduct({
      name: '',
      sku: autoSku,
      price: 0,
      purchasePrice: null,
      stock: 0,
      categoryId: categories[0]?.id || '',
      description: '',
      isActive: true,
      isFeatured: false,
      isNew: false,
      imageUrls: [''],
      attributesList: [],
    });
    setEditDialogOpen(true);
  };

  const handleAddImage = () => {
    if (editingProduct && editingProduct.imageUrls && editingProduct.imageUrls.length < 3) {
      setEditingProduct({
        ...editingProduct,
        imageUrls: [...editingProduct.imageUrls, '']
      });
    }
  };

  const handleRemoveImage = (index: number) => {
    if (editingProduct && editingProduct.imageUrls) {
      const newImages = editingProduct.imageUrls.filter((_, i) => i !== index);
      setEditingProduct({
        ...editingProduct,
        imageUrls: newImages.length > 0 ? newImages : ['']
      });
    }
  };

  const handleImageUrlChange = (index: number, url: string) => {
    if (editingProduct && editingProduct.imageUrls) {
      const newImages = [...editingProduct.imageUrls];
      newImages[index] = url;
      setEditingProduct({
        ...editingProduct,
        imageUrls: newImages
      });
    }
  };

  // Image reorder: move image from one index to another
  const handleMoveImage = (fromIndex: number, toIndex: number) => {
    if (!editingProduct?.imageUrls) return;
    if (toIndex < 0 || toIndex >= editingProduct.imageUrls.length) return;
    const newImages = [...editingProduct.imageUrls];
    const [moved] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, moved);
    setEditingProduct({ ...editingProduct, imageUrls: newImages });
  };

  const handleAddAttribute = () => {
    if (editingProduct) {
      const currentAttrs = editingProduct.attributesList || [];
      setEditingProduct({
        ...editingProduct,
        attributesList: [...currentAttrs, { name: '', value: '' }]
      });
    }
  };
  const handleAddAttributeTemplate = (templateName: string) => {
    if (editingProduct) {
      const currentAttrs = editingProduct.attributesList || [];
      setEditingProduct({
        ...editingProduct,
        attributesList: [...currentAttrs, { name: templateName, value: '' }]
      });
    }
  };

  const handleRemoveAttribute = (index: number) => {
    if (editingProduct && editingProduct.attributesList) {
      const newAttrs = editingProduct.attributesList.filter((_, i) => i !== index);
      setEditingProduct({
        ...editingProduct,
        attributesList: newAttrs
      });
    }
  };

  const handleAttributeChange = (index: number, field: 'name' | 'value', value: string) => {
    if (editingProduct && editingProduct.attributesList) {
      const newAttrs = [...editingProduct.attributesList];
      newAttrs[index] = { ...newAttrs[index], [field]: value };
      setEditingProduct({
        ...editingProduct,
        attributesList: newAttrs
      });
    }
  };

  const handleFileUpload = async (index: number, file: File) => {
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Неверный формат файла',
        description: `Получен: ${file.type || 'неизвестно'}. Разрешены: PNG, JPEG, WebP, GIF, SVG`,
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Ошибка',
        description: 'Файл слишком большой. Максимум: 5MB',
        variant: 'destructive',
      });
      return;
    }

    setUploadingImage(index);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'products');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success && data.url) {
        handleImageUrlChange(index, data.url);
        toast({
          title: 'Изображение загружено',
          description: file.name,
        });
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить изображение',
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(null);
    }
  };

  const triggerFileUpload = (index: number) => {
    uploadIndexRef.current = index;
    const input = document.getElementById('product-file-input') as HTMLInputElement;
    if (input) {
      input.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(uploadIndexRef.current, file);
    }
    e.target.value = '';
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;

    if (!editingProduct.categoryId) {
      toast({
        title: 'Выберите категорию',
        description: 'Без категории товар нельзя сохранить',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const isCreating = !editingProduct.id;
      const url = isCreating
        ? '/api/products'
        : `/api/products/${editingProduct.id}`;

      const filteredImages = (editingProduct.imageUrls || []).filter(u => u.trim() !== '');

      const filteredAttributes = (editingProduct.attributesList || []).filter(
        attr => attr.name.trim() !== '' && attr.value.trim() !== ''
      );

      const body: Record<string, unknown> = {
        name: editingProduct.name || '',
        sku: editingProduct.sku,
        slug: editingProduct.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description: editingProduct.description || null,
        price: parseFloat(String(editingProduct.price)) || 0,
        purchasePrice: editingProduct.purchasePrice != null ? parseFloat(String(editingProduct.purchasePrice)) : null,
        discountPrice: editingProduct.discountPrice != null ? parseFloat(String(editingProduct.discountPrice)) : null,
        categoryId: editingProduct.categoryId,
        stock: parseInt(String(editingProduct.stock)) || 0,
        skuCount: parseInt(String(editingProduct.skuCount)) || 0,
        isActive: editingProduct.isActive ?? true,
        isFeatured: editingProduct.isFeatured ?? false,
        isNew: editingProduct.isNew ?? false,
        images: filteredImages.length > 0 ? JSON.stringify(filteredImages) : null,
        attributes: filteredAttributes.length > 0 ? JSON.stringify(filteredAttributes) : null,
      };

      const res = await fetch(url, {
        method: isCreating ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const raw = await res.json();
        const toNum = (v: unknown, fallback = 0) => {
          const n = typeof v === 'number' ? v : parseFloat(String(v));
          return Number.isFinite(n) ? n : fallback;
        };
        const toInt = (v: unknown, fallback = 0) => {
          const n = typeof v === 'number' ? v : parseInt(String(v), 10);
          return Number.isFinite(n) ? n : fallback;
        };
        const savedProduct: Product = {
          ...raw,
          price: toNum(raw.price, 0),
          purchasePrice: raw.purchasePrice != null ? toNum(raw.purchasePrice, 0) : null,
          discountPrice: raw.discountPrice != null ? toNum(raw.discountPrice, 0) : null,
          stock: toInt(raw.stock, 0),
          skuCount: toInt(raw.skuCount, 0),
          rating: toNum(raw.rating, 0),
          reviewCount: toInt(raw.reviewCount, 0),
        };

        const wasAutoHidden = !isCreating && savedProduct.stock === 0 && !savedProduct.isActive;
        toast({
          title: isCreating ? 'Товар создан' : 'Товар обновлен',
          description: wasAutoHidden
            ? `${editingProduct.name} — скрыт (остаток: 0)`
            : editingProduct.name,
        });

        if (isCreating) {
          setProducts(prev => [savedProduct, ...prev]);
        } else {
          setProducts(prev => prev.map(p => (p.id === savedProduct.id ? savedProduct : p)));
        }

        setEditDialogOpen(false);
        setEditingProduct(null);
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: 'Ошибка',
          description: data.details || data.error || 'Не удалось сохранить товар',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить товар',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const isProductArchived = (product: Product) => product.sku?.startsWith('ARCHIVED-');

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;

    try {
      const isArchived = isProductArchived(productToDelete);
      const deleteUrl = isArchived
        ? `/api/products/${productToDelete.id}?force=true`
        : `/api/products/${productToDelete.id}`;

      const res = await fetch(deleteUrl, {
        method: 'DELETE',
      });

      if (res.ok) {
        const result = await res.json();
        toast({
          title: result.softDelete ? 'Товар заархивирован' : 'Товар удалён',
          description: result.message || (result.softDelete ? 'Товар скрыт (есть в заказах)' : 'Товар полностью удалён из базы'),
        });
        if (!result.softDelete) {
          setProducts(products.filter(p => p.id !== productToDelete.id));
        }
      } else {
        const errData = await res.json();
        toast({
          title: 'Ошибка',
          description: errData.error || 'Не удалось удалить товар',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    } finally {
      setDeleteConfirmOpen(false);
      setProductToDelete(null);
    }
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('ru-RU') + ' ₽';
  };



  // Stock filter config
  const stockFilterOptions: { value: StockFilter; label: string; count: number }[] = useMemo(() => {
    const sourceList = activeTab === 'active' ? activeProducts : hiddenProducts;
    return [
      { value: 'all', label: 'Все', count: sourceList.length },
      { value: 'in-stock', label: 'В наличии', count: sourceList.filter(p => p.stock > 0).length },
      { value: 'low-stock', label: 'Мало', count: sourceList.filter(p => p.stock > 0 && p.stock <= 5).length },
      { value: 'out-of-stock', label: 'Нет в наличии', count: sourceList.filter(p => p.stock === 0).length },
    ];
  }, [activeTab, activeProducts, hiddenProducts]);

  // Category product counts
  const categoryProductCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const sourceList = activeTab === 'active' ? activeProducts : hiddenProducts;
    for (const p of sourceList) {
      counts[p.categoryId] = (counts[p.categoryId] || 0) + 1;
    }
    return counts;
  }, [activeTab, activeProducts, hiddenProducts]);

  // Sort label
  const sortLabels: Record<SortOption, string> = {
    'name-asc': 'Название А-Я',
    'name-desc': 'Название Я-А',
    'price-asc': 'Цена ↑',
    'price-desc': 'Цена ↓',
    'stock-asc': 'Остаток ↑',
    'stock-desc': 'Остаток ↓',
    'date-desc': 'Новые',
    'date-asc': 'Старые',
    'rating-desc': 'Рейтинг ↓',
    'rating-asc': 'Рейтинг ↑',
  };

  // Has active price filter
  const hasPriceFilter = priceMin !== '' || priceMax !== '';

  // ============ ENHANCED SKELETON LOADING ============
  if (loadingStage === 'loading') {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header skeleton */}
        <div className="shrink-0 bg-background/95 backdrop-blur border-b p-3">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex-1">
              <Skeleton className="h-5 w-40 mb-1" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-[130px]" />
            <Skeleton className="h-10 w-[120px]" />
          </div>
          <div className="flex gap-2 mt-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-24 rounded-full" />
            ))}
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="shrink-0 border-b px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-28" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        {/* Content skeleton matching list layout */}
        <div className="flex-1 p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3">
                <div className="flex gap-3">
                  <Skeleton className="h-5 w-5 rounded mt-8" />
                  <Skeleton className="w-20 h-20 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between">
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-4 w-3/5" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                      <Skeleton className="h-8 w-8" />
                    </div>
                    <Skeleton className="h-5 w-1/5" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Financial calculations for edit dialog
  const showFinancialCalc = editingProduct != null && editingProduct.purchasePrice != null && (editingProduct.price ?? 0) > 0 && editingProduct.purchasePrice > 0;
  const financialCalc = showFinancialCalc ? (() => {
    const pp = editingProduct!.purchasePrice!;
    const pr = editingProduct!.price ?? 0;
    return {
      markup: ((pr - pp) / pp) * 100,
      margin: ((pr - pp) / pr) * 100,
      profit: pr - pp,
    };
  })() : null;

  // ============ PRODUCT CARD - LIST VIEW ============
  const renderListProduct = (product: Product) => {
    const images = getProductImages(product);
    const isSelected = selectedProducts.has(product.id);
    const isEditingStock = inlineEdit?.productId === product.id;
    const insights = getFinancialInsights(product);
    const recentChange = getRelativeTime(product.updatedAt);

    return (
      <motion.div key={product.id} variants={itemVariants} layout>
        <Card
          className={cn(
            "overflow-hidden transition-colors cursor-pointer",
            isSelected && "border-primary bg-primary/5",
            product.stock === 0 && !isSelected && "border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20",
            product.stock > 0 && product.stock <= 3 && !isSelected && "border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/10"
          )}
          onClick={() => handleEditProduct(product)}
        >
          <CardContent className="p-3">
            <div className="flex gap-3">
              {/* Checkbox */}
              <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleProductSelection(product.id)}
                />
              </div>

              {/* Images */}
              <div className="flex gap-1 flex-shrink-0">
                {images.length > 0 ? (
                  images.slice(0, 3).map((img: string, idx: number) => (
                    <div
                      key={idx}
                      className={cn(
                        "bg-muted rounded-xl overflow-hidden flex items-center justify-center",
                        images.length === 1 ? "w-20 h-20" : "w-14 h-20"
                      )}
                    >
                      <img
                        src={img}
                        alt={`${product.name} ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))
                ) : (
                  <div className="w-20 h-20 bg-muted rounded-xl flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium line-clamp-1">{product.name}</h3>
                      {recentChange && (
                        <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 h-5 border-sky-200 text-sky-600 dark:border-sky-800 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20">
                          <Clock className="h-2.5 w-2.5 mr-0.5" />
                          {recentChange}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{product.category?.name || 'Без категории'}</p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateProduct(product)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Дублировать
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(product)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className="font-semibold">{formatPrice(product.price)}</span>
                  {product.discountPrice && (
                    <span className="text-sm text-muted-foreground line-through">
                      {formatPrice(product.discountPrice)}
                    </span>
                  )}
                  {/* Financial insights inline */}
                  {insights && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                      <TrendingUp className="h-3 w-3" />
                      +{insights.profit.toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {product.isActive ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Eye className="h-3 w-3 mr-1" />
                      Активен
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      <EyeOff className="h-3 w-3 mr-1" />
                      Скрыт
                    </Badge>
                  )}
                  {/* Inline stock editing */}
                  {isEditingStock ? (
                    <Input
                      ref={inlineEditRef}
                      type="number"
                      value={inlineEdit.value}
                      onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                      onBlur={handleStockSave}
                      onKeyDown={handleStockKeyDown}
                      className="h-6 w-20 text-xs px-2 py-0"
                      min={0}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <Badge
                      variant="outline"
                      className={cn(
                        'cursor-pointer hover:opacity-80 transition-opacity',
                        product.stock === 0 && 'border-red-300 text-red-600 dark:border-red-800 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
                        product.stock > 0 && product.stock <= 3 && 'border-amber-300 text-amber-600 dark:border-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
                        product.stock > 3 && 'border-green-300 text-green-600 dark:border-green-800 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                      )}
                      onClick={(e) => { e.stopPropagation(); handleStockClick(product); }}
                      title="Нажмите для быстрого редактирования остатка"
                    >
                      Остаток: {product.stock}
                    </Badge>
                  )}
                  {/* Quick toggle buttons */}
                  <button
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full border transition-colors',
                      product.isNew
                        ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800'
                        : 'text-muted-foreground border-transparent hover:border-purple-200 hover:text-purple-600'
                    )}
                    onClick={(e) => { e.stopPropagation(); handleQuickToggle(product, 'isNew'); }}
                  >
                    <Sparkles className="h-3 w-3 mr-0.5 inline" />
                    Новинка
                  </button>
                  <button
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full border transition-colors',
                      product.isFeatured
                        ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800'
                        : 'text-muted-foreground border-transparent hover:border-yellow-200 hover:text-yellow-600'
                    )}
                    onClick={(e) => { e.stopPropagation(); handleQuickToggle(product, 'isFeatured'); }}
                  >
                    <Star className="h-3 w-3 mr-0.5 inline" />
                    Популярное
                  </button>
                </div>

                {/* Financial insights row */}
                {insights && (
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Маржа: <span className="text-emerald-600 dark:text-emerald-400 font-medium">{insights.margin.toFixed(1)}%</span></span>
                    <span>Наценка: <span className="text-sky-600 dark:text-sky-400 font-medium">{insights.markup.toFixed(1)}%</span></span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  // ============ PRODUCT CARD - GRID VIEW ============
  const renderGridProduct = (product: Product) => {
    const images = getProductImages(product);
    const isSelected = selectedProducts.has(product.id);
    const insights = getFinancialInsights(product);
    const recentChange = getRelativeTime(product.updatedAt);

    return (
      <motion.div key={product.id} variants={itemVariants} layout>
        <Card
          className={cn(
            "overflow-hidden transition-colors cursor-pointer",
            isSelected && "border-primary bg-primary/5",
            product.stock === 0 && !isSelected && "border-red-200 dark:border-red-900/50",
            product.stock > 0 && product.stock <= 3 && !isSelected && "border-amber-200 dark:border-amber-900/50"
          )}
          onClick={() => handleEditProduct(product)}
        >
          {/* Grid image area */}
          <div className="relative aspect-square bg-muted overflow-hidden">
            {images.length > 0 ? (
              <img
                src={images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
              </div>
            )}
            {/* Overlay badges */}
            <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
              {recentChange && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-5 border-sky-200 text-sky-600 bg-white/90 dark:bg-black/70 dark:border-sky-800 dark:text-sky-400 backdrop-blur-sm">
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                  {recentChange}
                </Badge>
              )}
              {product.isNew && (
                <Badge className="text-[9px] px-1.5 py-0 h-5 bg-purple-500 text-white">
                  <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                  Новинка
                </Badge>
              )}
              {product.isFeatured && (
                <Badge className="text-[9px] px-1.5 py-0 h-5 bg-yellow-500 text-white">
                  <Star className="h-2.5 w-2.5 mr-0.5" />
                  Хит
                </Badge>
              )}
            </div>
            {/* Checkbox overlay */}
            <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleProductSelection(product.id)}
                className="bg-white/80 dark:bg-black/60 backdrop-blur-sm"
              />
            </div>
            {/* Stock indicator */}
            {product.stock === 0 && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Badge variant="secondary" className="bg-red-500 text-white text-xs">Нет в наличии</Badge>
              </div>
            )}
          </div>
          <CardContent className="p-3">
            <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{product.category?.name || 'Без категории'}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="font-semibold text-sm">{formatPrice(product.price)}</span>
              {product.discountPrice && (
                <span className="text-xs text-muted-foreground line-through">
                  {formatPrice(product.discountPrice)}
                </span>
              )}
            </div>
            {/* Financial insights in grid */}
            {insights && (
              <div className="mt-1.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 flex items-center justify-between text-[10px]">
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  +{insights.profit.toLocaleString('ru-RU')} ₽/шт
                </span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  М:{insights.margin.toFixed(0)}%
                </span>
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] px-1.5 py-0 h-5',
                  product.stock === 0 && 'border-red-300 text-red-600 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-900/20',
                  product.stock > 0 && product.stock <= 3 && 'border-amber-300 text-amber-600 bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-900/20',
                  product.stock > 3 && 'border-green-300 text-green-600 bg-green-50 dark:border-green-800 dark:text-green-400 dark:bg-green-900/20'
                )}
              >
                Ост: {product.stock}
              </Badge>
              <div onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Редактировать
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicateProduct(product)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Дублировать
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDeleteClick(product)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  // ============ EMPTY STATE COMPONENT ============
  const renderEmptyState = (type: 'no-hidden' | 'search' | 'stock-filter' | 'no-products' | 'category-filter' | 'price-filter' | 'generic') => {
    const emptyStates: Record<string, { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode; bgClass: string; iconClass: string }> = {
      'no-hidden': {
        icon: <EyeOff className="h-12 w-12" />,
        title: 'Нет скрытых товаров',
        description: 'Скрытые товары будут отображаться здесь. Вы сможете восстановить их в один клик.',
        bgClass: 'from-muted to-muted/50',
        iconClass: 'text-muted-foreground/60',
      },
      'search': {
        icon: <Search className="h-12 w-12" />,
        title: 'Ничего не найдено',
        description: `По запросу «${searchQuery}» ничего не найдено. Попробуйте другой запрос.`,
        action: (
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setSearchQuery('')}>
            <X className="h-4 w-4 mr-1" />
            Сбросить поиск
          </Button>
        ),
        bgClass: 'from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10',
        iconClass: 'text-amber-500/60 dark:text-amber-400/60',
      },
      'stock-filter': {
        icon: <Warehouse className="h-12 w-12" />,
        title: 'Нет товаров с выбранным фильтром остатков',
        description: 'Попробуйте выбрать другой фильтр остатков',
        action: (
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setStockFilter('all')}>
            Показать все
          </Button>
        ),
        bgClass: 'from-red-50 to-red-100/50 dark:from-red-900/20 dark:to-red-800/10',
        iconClass: 'text-red-400/60 dark:text-red-400/60',
      },
      'no-products': {
        icon: <Package className="h-14 w-14" />,
        title: 'Нет товаров',
        description: 'Добавьте первый товар, чтобы начать продажи',
        action: (
          <Button size="sm" className="mt-4" onClick={handleCreateProduct}>
            <Plus className="h-4 w-4 mr-1" />
            Добавить товар
          </Button>
        ),
        bgClass: 'from-muted to-muted/40',
        iconClass: 'text-muted-foreground/50',
      },
      'category-filter': {
        icon: <Filter className="h-12 w-12" />,
        title: 'Нет товаров в этой категории',
        description: 'Выберите другую категорию или сбросьте фильтр',
        action: (
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setSelectedCategory('all')}>
            Все категории
          </Button>
        ),
        bgClass: 'from-violet-50 to-violet-100/50 dark:from-violet-900/20 dark:to-violet-800/10',
        iconClass: 'text-violet-400/60 dark:text-violet-400/60',
      },
      'price-filter': {
        icon: <Coins className="h-12 w-12" />,
        title: 'Нет товаров в этом ценовом диапазоне',
        description: 'Измените фильтр цены или сбросьте его',
        action: (
          <Button variant="outline" size="sm" className="mt-4" onClick={() => { setPriceMin(''); setPriceMax(''); }}>
            Сбросить цену
          </Button>
        ),
        bgClass: 'from-emerald-50 to-emerald-100/50 dark:from-emerald-900/20 dark:to-emerald-800/10',
        iconClass: 'text-emerald-400/60 dark:text-emerald-400/60',
      },
      'generic': {
        icon: <Package className="h-12 w-12" />,
        title: 'Товары не найдены',
        description: 'Измените параметры поиска или фильтра',
        bgClass: 'from-muted to-muted/50',
        iconClass: 'text-muted-foreground/50',
      },
    };

    const state = emptyStates[type];

    return (
      <div className="text-center py-16">
        <div className={cn("mx-auto w-24 h-24 rounded-full bg-gradient-to-b flex items-center justify-center mb-5 shadow-inner relative", state.bgClass)}>
          <div className={state.iconClass}>{state.icon}</div>
          {type === 'no-products' && (
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border-2 border-background">
              <Plus className="h-4 w-4 text-primary" />
            </div>
          )}
        </div>
        <p className="font-medium text-lg mb-1">{state.title}</p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-1">{state.description}</p>
        {type === 'no-products' && (
          <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
            Укажите название, цену, категорию и изображение
          </p>
        )}
        {state.action}
      </div>
    );
  };

  // Determine empty state type
  const getEmptyStateType = (): 'no-hidden' | 'search' | 'stock-filter' | 'no-products' | 'category-filter' | 'price-filter' | 'generic' => {
    if (activeTab === 'hidden' && hiddenProducts.length === 0) return 'no-hidden';
    if (searchQuery && filteredProducts.length === 0) return 'search';
    if (hasPriceFilter && filteredProducts.length === 0 && !searchQuery && stockFilter === 'all') return 'price-filter';
    if (selectedCategory !== 'all' && filteredProducts.length === 0 && !searchQuery && stockFilter === 'all') return 'category-filter';
    if (!searchQuery && filteredProducts.length === 0 && stockFilter !== 'all') return 'stock-filter';
    if (activeTab === 'active' && filteredProducts.length === 0 && products.length === 0) return 'no-products';
    return 'generic';
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-3">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView('admin')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Управление товарами</h1>
            <p className="text-xs text-muted-foreground">
              {activeProducts.length} активных • {hiddenProducts.length} скрытых
              {selectedProducts.size > 0 && ` • выбрано: ${selectedProducts.size}`}
              {priceRange && filteredProducts.length > 1 && (
                <> • {formatPrice(priceRange.min)} – {formatPrice(priceRange.max)}</>
              )}
            </p>
          </div>
          {/* Export button */}
          <DropdownMenu open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" title="Экспорт">
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Экспорт CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                <FileJson className="h-4 w-4 mr-2" />
                Экспорт JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 w-9"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
          {selectedProducts.size > 0 ? (
            <Button size="sm" variant="outline" onClick={clearSelection}>
              <XCircle className="h-4 w-4 mr-1" />
              Отменить
            </Button>
          ) : (
            <Button size="sm" onClick={handleCreateProduct}>
              <Plus className="h-4 w-4 mr-1" />
              Добавить
            </Button>
          )}
        </div>

        {/* Search, Category, and Sort */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Категория" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории ({products.length})</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name} ({categoryProductCounts[cat.id] || 0})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
            <SelectTrigger className="w-[140px]">
              <ArrowUpDown className="h-4 w-4 mr-1 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(sortLabels) as [SortOption, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stock Filter Chips + Price Range */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 items-center">
          {stockFilterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStockFilter(opt.value)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
                stockFilter === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted'
              )}
            >
              {opt.label}
              <span className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                stockFilter === opt.value
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}>
                {opt.count}
              </span>
            </button>
          ))}
          {/* Price range filter */}
          <Separator orientation="vertical" className="h-6 mx-1" />
          <div className="flex items-center gap-1">
            <Input
              placeholder="Цена от"
              type="number"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              className="h-7 w-20 text-xs px-2"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              placeholder="до"
              type="number"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              className="h-7 w-20 text-xs px-2"
            />
            {hasPriceFilter && (
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={() => { setPriceMin(''); setPriceMax(''); }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedProducts.size > 0 && (
        <div className="shrink-0 bg-primary/10 border-b px-4 py-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedProducts.size === filteredProducts.length}
                onCheckedChange={toggleSelectAll}
              />
              <span className="text-sm font-medium">
                {selectedProducts.size === filteredProducts.length
                  ? 'Все выбраны'
                  : `Выбрано: ${selectedProducts.size}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setBatchPriceMode('percentage'); setBatchPriceValue(''); setBatchPriceDirection('up'); setBulkActionDialog('price'); }}
              >
                <Percent className="h-4 w-4 mr-1" />
                Изменить цену
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkActionDialog('show')}
              >
                <Eye className="h-4 w-4 mr-1" />
                Показать
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkActionDialog('hide')}
              >
                <EyeOff className="h-4 w-4 mr-1" />
                Скрыть
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkActionDialog('delete')}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Удалить
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs + View Toggle */}
      <div className="shrink-0 border-b px-4">
        <div className="flex items-center justify-between">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'active' | 'hidden'); setStockFilter('all'); }}>
            <TabsList className="grid w-full grid-cols-2 h-10">
              <TabsTrigger value="active" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Активные ({activeProducts.length})
              </TabsTrigger>
              <TabsTrigger value="hidden" className="flex items-center gap-2">
                <EyeOff className="h-4 w-4" />
                Скрытые ({hiddenProducts.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {/* View toggle */}
          <div className="flex items-center gap-1 border rounded-lg p-0.5">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode('list')}
              title="Список"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => setViewMode('grid')}
              title="Сетка"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <div className="p-3">
          {filteredProducts.length === 0 ? (
            renderEmptyState(getEmptyStateType())
          ) : viewMode === 'list' ? (
            <motion.div
              className="space-y-2"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {filteredProducts.map(product => renderListProduct(product))}
            </motion.div>
          ) : (
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {filteredProducts.map(product => renderGridProduct(product))}
            </motion.div>
          )}
        </div>
      </div>

      {/* ============ QUICK VIEW SHEET ============ */}
      <Sheet open={quickViewProduct !== null} onOpenChange={(open) => { if (!open) setQuickViewProduct(null); }}>
        <SheetContent className="w-[340px] sm:w-[400px] overflow-y-auto">
          {quickViewProduct && (
            <>
              <SheetHeader>
                <SheetTitle className="text-left">{quickViewProduct.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {/* Image */}
                <div className="rounded-xl overflow-hidden bg-muted aspect-square">
                  {(() => {
                    const imgs = getProductImages(quickViewProduct);
                    if (imgs.length > 0) {
                      return <img src={imgs[0]} alt={quickViewProduct.name} className="w-full h-full object-cover" />;
                    }
                    return (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-muted-foreground/40" />
                      </div>
                    );
                  })()}
                </div>

                {/* Key info */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{formatPrice(quickViewProduct.price)}</span>
                    {quickViewProduct.discountPrice && (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatPrice(quickViewProduct.discountPrice)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn(
                      quickViewProduct.stock === 0 && 'border-red-300 text-red-600 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-900/20',
                      quickViewProduct.stock > 0 && quickViewProduct.stock <= 3 && 'border-amber-300 text-amber-600 bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-900/20',
                      quickViewProduct.stock > 3 && 'border-green-300 text-green-600 bg-green-50 dark:border-green-800 dark:text-green-400 dark:bg-green-900/20'
                    )}>
                      <Warehouse className="h-3 w-3 mr-1" />
                      Остаток: {quickViewProduct.stock}
                    </Badge>
                    <Badge variant="outline">
                      {quickViewProduct.category?.name || 'Без категории'}
                    </Badge>
                  </div>

                  {quickViewProduct.rating > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{quickViewProduct.rating.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">({quickViewProduct.reviewCount} отзывов)</span>
                    </div>
                  )}

                  {/* Financial insights */}
                  {(() => {
                    const insights = getFinancialInsights(quickViewProduct);
                    if (!insights) return null;
                    return (
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                          <TrendingUp className="h-4 w-4" />
                          Финансовые показатели
                        </div>
                        <Separator />
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground">Маржа</p>
                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{insights.margin.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Наценка</p>
                            <p className="text-sm font-bold text-sky-600 dark:text-sky-400">{insights.markup.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Прибыль</p>
                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{insights.profit.toLocaleString('ru-RU')} ₽</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* All images thumbnails */}
                  {(() => {
                    const imgs = getProductImages(quickViewProduct);
                    if (imgs.length <= 1) return null;
                    return (
                      <div>
                        <Label className="text-xs text-muted-foreground">Все изображения</Label>
                        <div className="flex gap-2 mt-1">
                          {imgs.map((img, idx) => (
                            <div key={idx} className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                              <img src={img} alt={`${quickViewProduct.name} ${idx + 1}`} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <Separator />

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => { handleEditProduct(quickViewProduct); setQuickViewProduct(null); }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Редактировать
                    </Button>
                    <Button variant="outline" onClick={() => handleDuplicateProduct(quickViewProduct)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Recently modified */}
                  {(() => {
                    const relTime = getRelativeTime(quickViewProduct.updatedAt);
                    if (!relTime) return null;
                    return (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Изменено {relTime}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {productToDelete && isProductArchived(productToDelete)
                ? 'Полностью удалить товар?'
                : 'Удалить товар?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {productToDelete && isProductArchived(productToDelete)
                ? `Товар "${productToDelete.name}" уже заархивирован. Полное удаление навсегда удалит товар из базы. История заказов будет затронута.`
                : `Вы уверены, что хотите удалить товар "${productToDelete?.name}"? Если товар есть в заказах, он будет сначала заархивирован.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={bulkActionDialog !== null} onOpenChange={() => setBulkActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkActionDialog === 'delete' && 'Подтвердите удаление'}
              {bulkActionDialog === 'hide' && 'Подтвердите скрытие'}
              {bulkActionDialog === 'show' && 'Подтвердите показ'}
              {bulkActionDialog === 'price' && 'Изменить цены'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkActionDialog === 'delete' && `Вы уверены, что хотите удалить ${selectedProducts.size} ${pluralize(selectedProducts.size, 'товар', 'товара', 'товаров')}? Это действие нельзя отменить.`}
              {bulkActionDialog === 'hide' && `Вы уверены, что хотите скрыть ${selectedProducts.size} ${pluralize(selectedProducts.size, 'товар', 'товара', 'товаров')}? Они не будут отображаться в каталоге.`}
              {bulkActionDialog === 'show' && `Вы уверены, что хотите показать ${selectedProducts.size} ${pluralize(selectedProducts.size, 'товар', 'товара', 'товаров')}? Они будут отображаться в каталоге.`}
              {bulkActionDialog === 'price' && `Изменить цены для ${selectedProducts.size} ${pluralize(selectedProducts.size, 'товара', 'товаров', 'товаров')}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Batch price update form */}
          {bulkActionDialog === 'price' && (
            <div className="space-y-3 py-2">
              <div className="flex gap-2">
                <Select value={batchPriceMode} onValueChange={(v) => setBatchPriceMode(v as BatchPriceMode)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Процент (%)</SelectItem>
                    <SelectItem value="fixed">Фикс. сумма (₽)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Button
                    variant={batchPriceDirection === 'up' ? 'default' : 'outline'}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setBatchPriceDirection('up')}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={batchPriceDirection === 'down' ? 'destructive' : 'outline'}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setBatchPriceDirection('down')}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Input
                type="number"
                placeholder={batchPriceMode === 'percentage' ? 'Введите процент' : 'Введите сумму'}
                value={batchPriceValue}
                onChange={(e) => setBatchPriceValue(e.target.value)}
                min={0}
              />
              {batchPriceValue && (
                <p className="text-xs text-muted-foreground">
                  {batchPriceDirection === 'up' ? 'Увеличение' : 'Уменьшение'} цены на {batchPriceValue}{batchPriceMode === 'percentage' ? '%' : ' ₽'} для {selectedProducts.size} {pluralize(selectedProducts.size, 'товара', 'товаров', 'товаров')}
                </p>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkAction}
              disabled={bulkActionDialog === 'price' && (!batchPriceValue || parseFloat(batchPriceValue) <= 0)}
              className={cn(bulkActionDialog === 'delete' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
            >
              {bulkActionDialog === 'delete' && 'Удалить'}
              {bulkActionDialog === 'hide' && 'Скрыть'}
              {bulkActionDialog === 'show' && 'Показать'}
              {bulkActionDialog === 'price' && 'Применить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct?.id ? 'Редактировать товар' : 'Новый товар'}
            </DialogTitle>
          </DialogHeader>

          {editingProduct && (
            <div className="space-y-4">
              {/* Hidden file input */}
              <input
                id="product-file-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={handleFileInputChange}
              />

              {/* ============ IMAGE GALLERY WITH THUMBNAILS & REORDER ============ */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Изображения (до 3 шт.)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddImage}
                    disabled={(editingProduct.imageUrls?.length || 0) >= 3}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Добавить фото
                  </Button>
                </div>
                {/* Thumbnail gallery with reorder arrows */}
                {editingProduct.imageUrls && editingProduct.imageUrls.length > 0 && (
                  <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                    {editingProduct.imageUrls.map((url, index) => (
                      url.trim() ? (
                        <div key={index} className="relative group flex-shrink-0">
                          <div className={cn(
                            "w-20 h-20 rounded-xl overflow-hidden bg-muted border-2",
                            index === 0 ? "border-primary" : "border-transparent"
                          )}>
                            <img
                              src={url}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder-product.svg';
                              }}
                            />
                          </div>
                          {index === 0 && (
                            <div className="absolute -top-1 -left-1 bg-primary text-primary-foreground text-[9px] px-1 rounded font-medium">1-е</div>
                          )}
                          {/* Reorder buttons */}
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {index > 0 && (
                              <button
                                className="w-5 h-5 rounded bg-background border text-[10px] flex items-center justify-center hover:bg-muted"
                                onClick={() => handleMoveImage(index, index - 1)}
                                title="Переместить влево"
                              >
                                ←
                              </button>
                            )}
                            {index < editingProduct.imageUrls!.length - 1 && (
                              <button
                                className="w-5 h-5 rounded bg-background border text-[10px] flex items-center justify-center hover:bg-muted"
                                onClick={() => handleMoveImage(index, index + 1)}
                                title="Переместить вправо"
                              >
                                →
                              </button>
                            )}
                          </div>
                          {/* Delete button */}
                          <button
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveImage(index)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : null
                    ))}
                  </div>
                )}
                {/* URL inputs with drag handle icon */}
                <div className="space-y-2">
                  {editingProduct.imageUrls?.map((url, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex gap-2">
                        <div className="flex items-center text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <Input
                            placeholder="URL изображения или загрузите файл"
                            value={url}
                            onChange={(e) => handleImageUrlChange(index, e.target.value)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => triggerFileUpload(index)}
                          disabled={uploadingImage === index}
                          title="Загрузить файл"
                        >
                          {uploadingImage === index ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveImage(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  PNG, JPEG, WebP, GIF, SVG до 5MB. Первое изображение — основное. Используйте ← → для изменения порядка.
                </p>
              </div>

              <div>
                <Label htmlFor="name">Название *</Label>
                <Input
                  id="name"
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Цена *</Label>
                  <Input
                    id="price"
                    type="number"
                    value={editingProduct.price || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="purchasePrice">Цена закупки</Label>
                  <Input
                    id="purchasePrice"
                    type="number"
                    placeholder="0"
                    value={editingProduct.purchasePrice ?? ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, purchasePrice: parseFloat(e.target.value) || null })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="discountPrice">Скидочная цена</Label>
                <Input
                  id="discountPrice"
                  type="number"
                  value={editingProduct.discountPrice || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, discountPrice: parseFloat(e.target.value) || null })}
                />
              </div>

              {/* Financial calculations */}
              {financialCalc && (
                <div className="rounded-xl bg-muted/50 p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Наценка</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{financialCalc.markup.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Маржа</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">{financialCalc.margin.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Прибыль</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">{financialCalc.profit.toLocaleString('ru-RU')} ₽</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stock">Остаток</Label>
                  <Input
                    id="stock"
                    type="number"
                    value={editingProduct.stock || 0}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="category">Категория</Label>
                  <Select
                    value={editingProduct.categoryId || ''}
                    onValueChange={(value) => setEditingProduct({ ...editingProduct, categoryId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Attributes section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <Label>Характеристики</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                        >
                          <Settings2 className="h-3 w-3 mr-1" />
                          Шаблон
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {ATTRIBUTE_TEMPLATES.map((tmpl) => (
                          <DropdownMenuItem
                            key={tmpl.name}
                            onClick={() => handleAddAttributeTemplate(tmpl.name)}
                          >
                            {tmpl.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddAttribute}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Добавить
                    </Button>
                  </div>
                </div>

                {editingProduct.attributesList && editingProduct.attributesList.length > 0 ? (
                  <div className="space-y-2">
                    {editingProduct.attributesList.map((attr, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <Input
                          placeholder="Название"
                          value={attr.name}
                          onChange={(e) => handleAttributeChange(index, 'name', e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder="Значение"
                          value={attr.value}
                          onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleRemoveAttribute(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Нет характеристик. Нажмите &laquo;Добавить&raquo; чтобы создать.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingProduct.isActive ?? true}
                    onCheckedChange={(checked) => setEditingProduct({ ...editingProduct, isActive: checked })}
                  />
                  <Label>Активен</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingProduct.isFeatured ?? false}
                    onCheckedChange={(checked) => setEditingProduct({ ...editingProduct, isFeatured: checked })}
                  />
                  <Label>Популярный</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingProduct.isNew ?? false}
                    onCheckedChange={(checked) => setEditingProduct({ ...editingProduct, isNew: checked })}
                  />
                  <Label>Новинка</Label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Отмена
            </Button>
            <Button onClick={handleSaveProduct} disabled={saving}>
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
