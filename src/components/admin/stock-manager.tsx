'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useShopStore, Product } from '@/stores/shop-store';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, 
  Upload, 
  Package, 
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  ArrowLeft,
  Loader2,
  Wallet,
  TrendingUp,
  DollarSign,
  Search,
  ChevronDown,
  ChevronUp,
  Percent,
  BarChart3,
  X,
  PackageX,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef } from 'react';

interface ImportResult {
  success: boolean;
  message: string;
  created?: number;
  updated?: number;
  errors?: string[];
}

type StockFilter = 'all' | 'low' | 'out';

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <Badge variant="destructive" className="text-xs font-semibold px-2 py-0.5">
        0
      </Badge>
    );
  }
  if (stock <= 5) {
    return (
      <Badge className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
        {stock}
      </Badge>
    );
  }
  return (
    <Badge className="text-xs font-semibold px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
      {stock}
    </Badge>
  );
}

export function StockManager() {
  const { setCurrentView } = useShopStore();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Products data
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Filter tabs
  const [activeFilter, setActiveFilter] = useState<StockFilter>('all');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products?limit=500&all=true');
        const data = await res.json();
        setProducts(data.products || []);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Filter counts
  const filterCounts = useMemo(() => ({
    all: products.length,
    low: products.filter(p => p.stock > 0 && p.stock <= 5).length,
    out: products.filter(p => p.stock === 0).length,
  }), [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    let list = products;

    // Apply filter
    if (activeFilter === 'low') {
      list = list.filter(p => p.stock > 0 && p.stock <= 5);
    } else if (activeFilter === 'out') {
      list = list.filter(p => p.stock === 0);
    }

    // Apply search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }

    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'category': cmp = (a.category?.name || '').localeCompare(b.category?.name || ''); break;
        case 'price': cmp = a.price - b.price; break;
        case 'stock': cmp = a.stock - b.stock; break;
        case 'profit': {
          const pa = a.purchasePrice != null ? a.price - a.purchasePrice : 0;
          const pb = b.purchasePrice != null ? b.price - b.purchasePrice : 0;
          cmp = pa - pb;
          break;
        }
        default: cmp = 0;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [products, searchQuery, sortField, sortDir, activeFilter]);

  // Financial calculations (only in-stock products)
  const inStockProducts = useMemo(() => products.filter(p => p.stock > 0), [products]);
  const financials = useMemo(() => {
    const totalProductValue = inStockProducts.reduce((sum, p) => sum + p.price * p.stock, 0);
    const totalPurchaseValue = inStockProducts.reduce((sum, p) => sum + (p.purchasePrice || 0) * p.stock, 0);
    const potentialProfit = totalProductValue - totalPurchaseValue;

    const productsWithCost = inStockProducts.filter(p => p.purchasePrice != null && p.purchasePrice > 0);
    const avgMarkup = productsWithCost.length > 0
      ? productsWithCost.reduce((sum, p) => sum + ((p.price - p.purchasePrice!) / p.purchasePrice!) * 100, 0) / productsWithCost.length
      : null;

    const productsWithPrice = products.filter(p => p.purchasePrice != null && p.purchasePrice > 0 && p.price > 0);
    const avgMargin = productsWithPrice.length > 0
      ? productsWithPrice.reduce((sum, p) => sum + ((p.price - p.purchasePrice!) / p.price) * 100, 0) / productsWithPrice.length
      : null;

    return { totalProductValue, totalPurchaseValue, potentialProfit, avgMarkup, avgMargin, productsWithCostCount: productsWithCost.length };
  }, [inStockProducts, products]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const formatMoney = (value: number) => {
    return value.toLocaleString('ru-RU') + ' ₽';
  };

  // Export / Import
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/stock/export');
      if (!response.ok) throw new Error('Ошибка экспорта');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('Ошибка при экспорте файла');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('Пожалуйста, выберите файл Excel (.xlsx или .xls)');
      return;
    }
    uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/stock/import', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      setImportResult(result);
      // Refresh products after import
      const res = await fetch('/api/products?limit=500&all=true');
      const data = await res.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        message: 'Ошибка при импорте файла',
        errors: ['Не удалось обработать файл'],
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />;
  };

  const filterTabs: { key: StockFilter; label: string; icon: typeof Package; count: number }[] = [
    { key: 'all', label: 'Все', icon: Package, count: filterCounts.all },
    { key: 'low', label: 'Низкий остаток', icon: AlertTriangle, count: filterCounts.low },
    { key: 'out', label: 'Отсутствуют', icon: PackageX, count: filterCounts.out },
  ];

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="shrink-0 bg-background/95 backdrop-blur border-b p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex-1">
              <Skeleton className="h-5 w-40 mb-1" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        </div>
        <div className="flex-1 p-3 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView('admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Склад и финансы</h1>
            <p className="text-sm text-muted-foreground">
              Управление остатками и финансовые показатели
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <div className="p-3 space-y-3">
          {/* Financial Summary Cards — Row 1 */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Wallet className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 truncate">Товаров на сумму</span>
                </div>
                <p className="text-base font-bold text-blue-700 dark:text-blue-300 truncate">
                  {formatMoney(financials.totalProductValue)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {inStockProducts.length} {inStockProducts.length === 1 ? 'товар' : inStockProducts.length < 5 ? 'товара' : 'товаров'} в наличии
                </p>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 shrink-0" />
                  <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400 truncate">Закупочная стоимость</span>
                </div>
                <p className="text-base font-bold text-orange-700 dark:text-orange-300 truncate">
                  {formatMoney(financials.totalPurchaseValue)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Себестоимость склада</p>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400 shrink-0" />
                  <span className="text-[11px] font-medium text-green-600 dark:text-green-400 truncate">Потенциальная прибыль</span>
                </div>
                <p className="text-base font-bold text-green-700 dark:text-green-300 truncate">
                  {formatMoney(financials.potentialProfit)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {financials.totalProductValue > 0 ? ((financials.potentialProfit / financials.totalProductValue) * 100).toFixed(1) : 0}% маржа
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Financial Summary Cards — Row 2 */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Percent className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400">Средняя наценка</span>
                </div>
                <p className="text-base font-bold text-purple-700 dark:text-purple-300">
                  {financials.avgMarkup != null ? `${financials.avgMarkup.toFixed(1)}%` : '—'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Наценка: (цена − закупка) / закупка
                  {financials.productsWithCostCount > 0 && (
                    <span className="text-purple-500 dark:text-purple-400"> · {financials.productsWithCostCount} тов.</span>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400">Средняя маржа</span>
                </div>
                <p className="text-base font-bold text-teal-700 dark:text-teal-300">
                  {financials.avgMargin != null ? `${financials.avgMargin.toFixed(1)}%` : '—'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Маржа: (цена − закупка) / цена
                  {financials.productsWithCostCount > 0 && (
                    <span className="text-teal-500 dark:text-teal-400"> · {financials.productsWithCostCount} тов.</span>
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filterTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  <span className={cn(
                    'ml-1 text-xs px-1.5 py-0.5 rounded-full',
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/10 text-muted-foreground'
                  )}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Product List */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Товары ({filteredProducts.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto overflow-x-auto">
                {/* Sort Header */}
                <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground border-b">
                  <button className="flex items-center text-left hover:text-foreground transition-colors min-w-0 flex-1" onClick={() => handleSort('name')}>
                    <span className="truncate">Название <SortIcon field="name" /></span>
                  </button>
                  <button className="flex items-center justify-end text-right hover:text-foreground transition-colors w-20 shrink-0" onClick={() => handleSort('price')}>
                    <span className="truncate">Цена <SortIcon field="price" /></span>
                  </button>
                  <button className="flex items-center justify-center hover:text-foreground transition-colors w-20 shrink-0" onClick={() => handleSort('stock')}>
                    <span className="truncate">Остаток <SortIcon field="stock" /></span>
                  </button>
                  <button className="flex items-center justify-end text-right hover:text-foreground transition-colors w-24 shrink-0" onClick={() => handleSort('profit')}>
                    <span className="truncate">Прибыль/шт <SortIcon field="profit" /></span>
                  </button>
                </div>

                {/* Product Rows */}
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    {activeFilter === 'out' ? (
                      <>
                        <PackageX className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p className="font-medium">Нет отсутствующих товаров</p>
                        <p className="text-xs mt-1">Все товары есть в наличии</p>
                      </>
                    ) : activeFilter === 'low' ? (
                      <>
                        <AlertTriangle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p className="font-medium">Нет товаров с низким остатком</p>
                        <p className="text-xs mt-1">Все товары хорошо укомплектованы</p>
                      </>
                    ) : searchQuery ? (
                      <>
                        <Search className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p className="font-medium">Ничего не найдено</p>
                        <p className="text-xs mt-1">Попробуйте другой запрос</p>
                      </>
                    ) : (
                      <>
                        <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p className="font-medium">Нет товаров</p>
                        <p className="text-xs mt-1">Добавьте товары для управления остатками</p>
                      </>
                    )}
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredProducts.map((product) => {
                      const profitPerItem = product.purchasePrice != null
                        ? product.price - product.purchasePrice
                        : null;
                      const marginPct = product.purchasePrice != null && product.purchasePrice > 0
                        ? ((product.price - product.purchasePrice) / product.price) * 100
                        : null;

                      return (
                        <motion.div
                          key={product.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ type: 'spring' as const, stiffness: 500, damping: 35 }}
                          className="flex items-center gap-2 px-3 py-2.5 text-xs border-b last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          {/* Name + Category + Image */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold line-clamp-2 leading-tight" title={product.name}>{product.name}</p>
                            </div>
                          </div>

                          {/* Price */}
                          <div className="w-20 shrink-0 text-right">
                            <span className="font-medium whitespace-nowrap">{formatMoney(product.price)}</span>
                            {product.discountPrice != null && product.discountPrice < product.price && (
                              <p className="text-[10px] text-primary font-medium">скидка {formatMoney(product.discountPrice)}</p>
                            )}
                          </div>

                          {/* Stock (read-only) */}
                          <div className="w-20 shrink-0 flex items-center justify-center">
                            <StockBadge stock={product.stock} />
                          </div>

                          {/* Profit per item */}
                          <div className="w-24 shrink-0 text-right">
                            {profitPerItem != null ? (
                              <>
                                <span className={cn(
                                  'font-medium whitespace-nowrap',
                                  profitPerItem > 0 ? 'text-green-600 dark:text-green-400' : profitPerItem < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                                )}>
                                  {profitPerItem > 0 ? '+' : ''}{formatMoney(profitPerItem)}
                                </span>
                                {marginPct != null && (
                                  <p className="text-[10px] text-muted-foreground">{marginPct.toFixed(1)}% маржа</p>
                                )}
                              </>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Export Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4" />
                Экспорт / Импорт
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <Button onClick={handleExport} disabled={isExporting} variant="outline" className="w-full">
                  {isExporting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Экспорт...</>
                  ) : (
                    <><Download className="h-4 w-4 mr-2" />Экспорт XLSX</>
                  )}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                  {isImporting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Импорт...</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" />Импорт XLSX</>
                  )}
                </Button>
              </div>

              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleInputChange} className="hidden" />

              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-4 text-center transition-colors",
                  dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                  isImporting && "opacity-50 pointer-events-none"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {isImporting ? (
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Обработка файла...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Перетащите XLSX файл сюда</p>
                  </div>
                )}
              </div>

              {importResult && (
                <div className={cn(
                  "mt-3 p-3 rounded-xl",
                  importResult.success ? "bg-green-100 dark:bg-green-900/20" : "bg-red-100 dark:bg-red-900/20"
                )}>
                  <div className="flex items-start gap-2">
                    {importResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium",
                        importResult.success ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                      )}>
                        {importResult.message}
                      </p>
                      {importResult.success && (importResult.created || importResult.updated) && (
                        <div className="flex gap-2 mt-1">
                          {importResult.created !== undefined && importResult.created > 0 && (
                            <Badge variant="secondary" className="bg-green-200 text-green-800 text-xs">
                              Создано: {importResult.created}
                            </Badge>
                          )}
                          {importResult.updated !== undefined && importResult.updated > 0 && (
                            <Badge variant="secondary" className="bg-blue-200 text-blue-800 text-xs">
                              Обновлено: {importResult.updated}
                            </Badge>
                          )}
                        </div>
                      )}
                      {importResult.errors && importResult.errors.length > 0 && (
                        <ul className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {importResult.errors.slice(0, 3).map((error, i) => (
                            <li key={i}>• {error}</li>
                          ))}
                          {importResult.errors.length > 3 && (
                            <li>... и ещё {importResult.errors.length - 3}</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-primary/5">
            <CardContent className="p-3">
              <div className="flex gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium mb-1">Формат файла</p>
                  <ul className="text-muted-foreground space-y-0.5">
                    <li>• Экспорт содержит все товары с закупочными ценами</li>
                    <li>• Каждая строка = один товар</li>
                    <li>• Новые товары создаются автоматически при импорте</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
