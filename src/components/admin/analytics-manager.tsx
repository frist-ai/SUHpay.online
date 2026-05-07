'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  ChevronLeft,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Package,

  CheckCircle2,
  Clock,
  Truck,
  BarChart3,
  Calendar as CalendarIcon,
  RefreshCw,
  Download,
  Users,
  Timer,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  UserCheck,
  MapPin,
  PieChart as PieChartIcon,
  Printer,
  Settings2,
  Activity,
  FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyableOrderNumber } from '@/components/shared/copyable-order-number';
import { motion, useSpring, useTransform } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import { DateRange } from 'react-day-picker';

interface StatsData {
  isDemo?: boolean;
  _error?: boolean;
  _apiError?: boolean;
  _apiErrorMessage?: string;
  reason?: string;
  totalProducts: number;
  totalOrders: number;
  totalUsers: number;
  totalRevenue: number;
  averageCheck: number;
  conversionRate: number;
  totalItemsSold: number;
  paidOrdersCount: number;
  ordersByStatus: { status: string; _count: { id: number } }[];
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    total: number;
    createdAt: string;
    items: Array<{ id: string; productName: string }>;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    skuCount: number;
    price: number;
  }>;
  dailyRevenue: Record<string, number>;
  monthlyRevenue: Record<string, number>;
  hourlyRevenue: Record<string, number>;
  newUsers: number;
  avgDeliveryHours: number;
  topCategories: Array<{ name: string; revenue: number; orderCount: number }>;
  revenueByPaymentMethod: Array<{ method: string; label: string; revenue: number; count: number }>;
  customerRetention: Array<{ period: string; newCustomers: number; repeatCustomers: number }>;
  deliveryTimeTrend: Array<{ period: string; avgHours: number }>;
  profitability: {
    totalProfit: number;
    totalCost: number;
    averageMargin: number;
    mostProfitableProducts: Array<{ name: string; profit: number; margin: number }>;
  };
  geoDistribution: Array<{ city: string; orders: number; revenue: number }>;
}

const statusConfig: Record<string, { label: string; color: string; barColor: string }> = {
  pending: {
    label: 'Ожидает',
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    barColor: 'bg-yellow-400 dark:bg-yellow-500',
  },
  confirmed: {
    label: 'Подтвержден',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    barColor: 'bg-blue-400 dark:bg-blue-500',
  },
  processing: {
    label: 'В обработке',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    barColor: 'bg-purple-400 dark:bg-purple-500',
  },
  shipped: {
    label: 'Отправлен',
    color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    barColor: 'bg-cyan-400 dark:bg-cyan-500',
  },
  delivered: {
    label: 'Доставлен',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    barColor: 'bg-green-400 dark:bg-green-500',
  },
  cancelled: {
    label: 'Отменен',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    barColor: 'bg-gray-400 dark:bg-gray-500',
  },
};

type DateRangeType = 'today' | 'week' | 'month' | 'all' | 'custom';

const PAYMENT_COLORS = [
  'oklch(0.72 0.19 155)',  // green
  'oklch(0.65 0.18 250)',  // blue-ish
  'oklch(0.70 0.15 60)',   // amber
  'oklch(0.65 0.20 330)',  // pink
  'oklch(0.60 0.15 280)',  // purple
  'oklch(0.55 0.12 200)',  // cyan
];

function getDateRange(range: DateRangeType, customFrom?: Date, customTo?: Date) {
  const now = new Date();
  switch (range) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { gte: start.toISOString() };
    }
    case 'week': {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { gte: start.toISOString() };
    }
    case 'month': {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { gte: start.toISOString() };
    }
    case 'custom': {
      if (customFrom) {
        const gte = new Date(customFrom.getFullYear(), customFrom.getMonth(), customFrom.getDate()).toISOString();
        if (customTo) {
          const lt = new Date(customTo.getFullYear(), customTo.getMonth(), customTo.getDate() + 1).toISOString();
          return { gte, lt };
        }
        return { gte };
      }
      return null;
    }
    default:
      return null;
  }
}

function getPreviousDateRange(range: DateRangeType) {
  const now = new Date();
  switch (range) {
    case 'today': {
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      return { gte: start.toISOString(), lt: end.toISOString() };
    }
    case 'week': {
      const end = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { gte: start.toISOString(), lt: end.toISOString() };
    }
    case 'month': {
      const end = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { gte: start.toISOString(), lt: end.toISOString() };
    }
    default:
      return null;
  }
}

function formatPrice(price: number) {
  return Math.round(price).toLocaleString('ru-RU') + ' ₽';
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatDeliveryHours(hours: number) {
  if (hours <= 0) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} мин`;
  if (hours < 24) return `${Math.round(hours * 10) / 10} ч`;
  const days = Math.floor(hours / 24);
  const remainHours = Math.round((hours % 24) * 10) / 10;
  return remainHours > 0 ? `${days} д ${remainHours} ч` : `${days} д`;
}

const monthNames = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
];

const chartTitleByRange: Record<string, string> = {
  today: 'Выручка за сегодня',
  week: 'Выручка за неделю',
  month: 'Выручка за месяц',
  all: 'Выручка за всё время',
  custom: 'Выручка за период',
};

function getChartData(
  dailyRevenue: Record<string, number>,
  monthlyRevenue: Record<string, number>,
  hourlyRevenue: Record<string, number>,
  range: DateRangeType
): Array<{ date: string; label: string; revenue: number }> {
  if (range === 'all' || range === 'custom') {
    const months = Object.entries(monthlyRevenue)
      .filter(([, revenue]) => revenue > 0)
      .map(([key, revenue]) => {
        const [year, month] = key.split('-');
        const label = `${monthNames[parseInt(month, 10) - 1]} ${year}`;
        return { date: key, label, revenue };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    return months;
  }

  if (range === 'month') {
    const days = Object.entries(dailyRevenue)
      .filter(([, revenue]) => revenue > 0)
      .map(([dateStr, revenue]) => {
        const d = new Date(dateStr);
        const label = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        return { date: dateStr, label, revenue };
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
    return days;
  }

  if (range === 'today') {
    const hours = Object.entries(hourlyRevenue)
      .filter(([, revenue]) => revenue > 0)
      .map(([hour, revenue]) => ({
        date: hour,
        label: `${String(hour).padStart(2, '0')}:00`,
        revenue,
      }))
      .sort((a, b) => parseInt(a.date) - parseInt(b.date));
    return hours;
  }

  // Default: week
  const weekDays = Object.entries(dailyRevenue)
    .filter(([, revenue]) => revenue > 0)
    .map(([dateStr, revenue]) => {
      const d = new Date(dateStr);
      const label = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      return { date: dateStr, label, revenue };
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);
  return weekDays;
}

const dateRangeLabels: Record<DateRangeType, string> = {
  today: 'Сегодня',
  week: 'Неделя',
  month: 'Месяц',
  all: 'Всё время',
  custom: 'Свой период',
};

function TrendIndicator({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-green-600 dark:text-green-400">
        <ArrowUpRight className="h-3 w-3" />
        Новый
      </span>
    );
  }
  const change = ((current - previous) / previous) * 100;
  const isPositive = invert ? change < 0 : change > 0;
  const isNeutral = Math.abs(change) < 0.1;

  if (isNeutral) {
    return <span className="text-xs text-muted-foreground">0%</span>;
  }

  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-xs font-medium',
        isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      )}
    >
      {change > 0 ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {change > 0 ? '+' : ''}{Math.round(change)}%
    </span>
  );
}

function HourHeatmap({ hourlyRevenue }: { hourlyRevenue: Record<string, number> }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const values = hours.map(h => hourlyRevenue[String(h)] || 0);
  const maxVal = Math.max(...values, 1);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-1 sm:grid-cols-24">
        {hours.map(h => {
          const val = hourlyRevenue[String(h)] || 0;
          const intensity = val / maxVal;
          const isNow = new Date().getHours() === h;
          return (
            <div
              key={h}
              className={cn(
                'relative aspect-square rounded-sm flex items-center justify-center',
                'transition-all duration-200',
                intensity === 0 && 'bg-muted/30',
                intensity > 0 && intensity <= 0.25 && 'bg-green-200 dark:bg-green-900/40',
                intensity > 0.25 && intensity <= 0.5 && 'bg-green-300 dark:bg-green-800/50',
                intensity > 0.5 && intensity <= 0.75 && 'bg-green-400 dark:bg-green-700/60',
                intensity > 0.75 && 'bg-green-500 dark:bg-green-600/70',
                isNow && 'ring-2 ring-primary'
              )}
              title={`${String(h).padStart(2, '0')}:00 — ${formatPrice(val)}`}
            >
              <span className={cn(
                'text-[8px] sm:text-[9px] leading-none',
                intensity > 0.5 ? 'text-white dark:text-white' : 'text-muted-foreground'
              )}>
                {h}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Меньше заказов</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-muted/30" />
          <div className="w-3 h-3 rounded-sm bg-green-200 dark:bg-green-900/40" />
          <div className="w-3 h-3 rounded-sm bg-green-300 dark:bg-green-800/50" />
          <div className="w-3 h-3 rounded-sm bg-green-400 dark:bg-green-700/60" />
          <div className="w-3 h-3 rounded-sm bg-green-500 dark:bg-green-600/70" />
        </div>
        <span>Больше заказов</span>
      </div>
    </div>
  );
}

// --- Animated Counter Component ---
function AnimatedCounter({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 100, damping: 30, mass: 0.8 } as const);
  const display = useTransform(spring, (current) => Math.round(current).toLocaleString('ru-RU'));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}

// --- Section visibility config ---
interface SectionConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  defaultVisible: boolean;
}

const SECTION_CONFIG: SectionConfig[] = [
  { id: 'metrics', label: 'Ключевые метрики', icon: <BarChart3 className="h-3.5 w-3.5" />, defaultVisible: true },
  { id: 'revenue', label: 'График выручки', icon: <TrendingUp className="h-3.5 w-3.5" />, defaultVisible: true },
  { id: 'status', label: 'Статусы заказов', icon: <Layers className="h-3.5 w-3.5" />, defaultVisible: true },
  { id: 'payment', label: 'По способу оплаты', icon: <CreditCard className="h-3.5 w-3.5" />, defaultVisible: true },
  { id: 'heatmap', label: 'Активность по часам', icon: <Clock className="h-3.5 w-3.5" />, defaultVisible: true },
  { id: 'categories', label: 'Топ категорий', icon: <Layers className="h-3.5 w-3.5" />, defaultVisible: true },
  { id: 'retention', label: 'Удержание клиентов', icon: <UserCheck className="h-3.5 w-3.5" />, defaultVisible: true },
  { id: 'delivery', label: 'Время доставки', icon: <Truck className="h-3.5 w-3.5" />, defaultVisible: true },
  { id: 'profitability', label: 'Рентабельность', icon: <DollarSign className="h-3.5 w-3.5" />, defaultVisible: true },
  { id: 'geo', label: 'Геораспределение', icon: <MapPin className="h-3.5 w-3.5" />, defaultVisible: true },
  { id: 'tabs', label: 'Заказы и товары', icon: <ShoppingCart className="h-3.5 w-3.5" />, defaultVisible: true },
];

export function AnalyticsManager() {
  const { setCurrentView } = useShopStore();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [prevStats, setPrevStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeType>('all');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    SECTION_CONFIG.forEach(s => { initial[s.id] = s.defaultVisible; });
    return initial;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<30 | 60>(30);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isSectionVisible = useCallback((id: string) => sectionVisibility[id] !== false, [sectionVisibility]);

  const toggleSection = useCallback((id: string) => {
    setSectionVisibility(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const fetchStats = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const params = new URLSearchParams();
      if (dateRange !== 'all') {
        const range = getDateRange(dateRange, customFrom, customTo);
        if (range) {
          params.set('from', range.gte);
          if (range.lt) params.set('to', range.lt);
        }
      }
      const res = await fetch(`/api/stats?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || data._error || data.error) {
        console.error('[Analytics] API error:', data);
        setStats({
          ...data,
          _apiError: true,
          _apiErrorMessage: data.reason || data.error || `HTTP ${res.status}`,
        });
      } else {
        setStats(data);
      }

      // Fetch previous period for comparison
      const prevRange = getPreviousDateRange(dateRange);
      if (prevRange) {
        const prevParams = new URLSearchParams();
        prevParams.set('from', prevRange.gte);
        if (prevRange.lt) prevParams.set('to', prevRange.lt);
        try {
          const prevRes = await fetch(`/api/stats?${prevParams.toString()}`);
          const prevData = await prevRes.json();
          if (prevRes.ok && !prevData._error) {
            setPrevStats(prevData);
          } else {
            setPrevStats(null);
          }
        } catch {
          setPrevStats(null);
        }
      } else {
        setPrevStats(null);
      }
    } catch (error) {
      console.error('[Analytics] Error fetching stats:', error);
      setStats({
        isDemo: true,
        _apiError: true,
        _apiErrorMessage: error instanceof Error ? error.message : 'Network error',
        totalProducts: 0, totalOrders: 0, totalUsers: 0, totalRevenue: 0,
        averageCheck: 0, conversionRate: 0, totalItemsSold: 0, paidOrdersCount: 0,
        ordersByStatus: [], recentOrders: [], topProducts: [],
        dailyRevenue: {}, monthlyRevenue: {}, hourlyRevenue: {},
        newUsers: 0, avgDeliveryHours: 0, topCategories: [],
        revenueByPaymentMethod: [], customerRetention: [], deliveryTimeTrend: [],
        profitability: { totalProfit: 0, totalCost: 0, averageMargin: 0, mostProfitableProducts: [] },
        geoDistribution: [],
      } as StatsData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, customFrom, customTo]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => {
        fetchStats(true);
      }, autoRefreshInterval * 1000);
    }
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [autoRefresh, autoRefreshInterval, fetchStats]);

  // Client-side date filter
  const dateFilter = useMemo(() => {
    if (dateRange === 'all') return null;
    const range = getDateRange(dateRange, customFrom, customTo);
    return range ? new Date(range.gte) : null;
  }, [dateRange, customFrom, customTo]);

  // Filter recent orders by date range
  const filteredRecentOrders = useMemo(() => {
    if (!stats?.recentOrders || !dateFilter) return stats?.recentOrders || [];
    return stats.recentOrders.filter(o => new Date(o.createdAt) >= dateFilter);
  }, [stats, dateFilter]);

  // Revenue comparison
  const revenueChange = useMemo(() => {
    if (!prevStats || !stats) return null;
    const current = stats.totalRevenue;
    const previous = prevStats.totalRevenue;
    if (previous === 0 && current === 0) return 0;
    if (previous === 0) return 100;
    return ((current - previous) / previous) * 100;
  }, [stats, prevStats]);

  // Export data as JSON
  const handleExportJSON = useCallback(() => {
    if (!stats) return;
    const exportData = {
      exportedAt: new Date().toISOString(),
      period: dateRangeLabels[dateRange],
      metrics: {
        totalRevenue: stats.totalRevenue,
        totalOrders: stats.totalOrders,
        totalUsers: stats.totalUsers,
        newUsers: stats.newUsers,
        averageCheck: stats.averageCheck,
        conversionRate: stats.conversionRate,
        totalItemsSold: stats.totalItemsSold,
        paidOrdersCount: stats.paidOrdersCount,
        avgDeliveryHours: stats.avgDeliveryHours,
      },
      ordersByStatus: stats.ordersByStatus,
      topProducts: stats.topProducts,
      topCategories: stats.topCategories,
      revenueByPaymentMethod: stats.revenueByPaymentMethod,
      customerRetention: stats.customerRetention,
      deliveryTimeTrend: stats.deliveryTimeTrend,
      profitability: stats.profitability,
      geoDistribution: stats.geoDistribution,
      dailyRevenue: stats.dailyRevenue,
      monthlyRevenue: stats.monthlyRevenue,
      hourlyRevenue: stats.hourlyRevenue,
      recentOrders: stats.recentOrders.map(o => ({
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        total: o.total,
        createdAt: o.createdAt,
        items: o.items.map(i => i.productName),
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [stats, dateRange]);

  // Export data as CSV
  const handleExportCSV = useCallback(() => {
    if (!stats) return;
    const rows: string[][] = [];

    // Metrics section
    rows.push(['=== Ключевые метрики ===']);
    rows.push(['Метрика', 'Значение']);
    rows.push(['Выручка', String(stats.totalRevenue)]);
    rows.push(['Средний чек', String(stats.averageCheck)]);
    rows.push(['Конверсия', `${stats.conversionRate.toFixed(1)}%`]);
    rows.push(['Продано товаров', String(stats.totalItemsSold)]);
    rows.push(['Всего заказов', String(stats.totalOrders)]);
    rows.push(['Оплаченных', String(stats.paidOrdersCount)]);
    rows.push(['Новые клиенты', String(stats.newUsers)]);
    rows.push(['Ср. доставка (ч)', String(stats.avgDeliveryHours)]);
    rows.push([]);

    // Orders by status
    rows.push(['=== Статусы заказов ===']);
    rows.push(['Статус', 'Количество']);
    stats.ordersByStatus.forEach(s => {
      rows.push([s.status, String(s._count.id)]);
    });
    rows.push([]);

    // Revenue by payment method
    if (stats.revenueByPaymentMethod?.length) {
      rows.push(['=== По способу оплаты ===']);
      rows.push(['Способ', 'Выручка', 'Кол-во']);
      stats.revenueByPaymentMethod.forEach(p => {
        rows.push([p.label, String(p.revenue), String(p.count)]);
      });
      rows.push([]);
    }

    // Top products
    if (stats.topProducts?.length) {
      rows.push(['=== Топ товаров ===']);
      rows.push(['Название', 'Продано', 'Цена', 'Выручка']);
      stats.topProducts.forEach(p => {
        rows.push([p.name, String(p.skuCount), String(p.price), String(p.price * p.skuCount)]);
      });
      rows.push([]);
    }

    // Top categories
    if (stats.topCategories?.length) {
      rows.push(['=== Топ категорий ===']);
      rows.push(['Категория', 'Выручка', 'Кол-во товаров']);
      stats.topCategories.forEach(c => {
        rows.push([c.name, String(c.revenue), String(c.orderCount)]);
      });
      rows.push([]);
    }

    // Geo distribution
    if (stats.geoDistribution?.length) {
      rows.push(['=== Геораспределение ===']);
      rows.push(['Город', 'Заказов', 'Выручка']);
      stats.geoDistribution.forEach(g => {
        rows.push([g.city, String(g.orders), String(g.revenue)]);
      });
      rows.push([]);
    }

    // Profitability
    if (stats.profitability?.totalProfit > 0) {
      rows.push(['=== Рентабельность ===']);
      rows.push(['Показатель', 'Значение']);
      rows.push(['Общая прибыль', String(stats.profitability.totalProfit)]);
      rows.push(['Себестоимость', String(stats.profitability.totalCost)]);
      rows.push(['Средняя маржа %', String(stats.profitability.averageMargin)]);
      rows.push([]);
      if (stats.profitability.mostProfitableProducts?.length) {
        rows.push(['Самые прибыльные товары']);
        rows.push(['Название', 'Прибыль', 'Маржа %']);
        stats.profitability.mostProfitableProducts.forEach(p => {
          rows.push([p.name, String(p.profit), String(p.margin)]);
        });
      }
    }

    const csvContent = '\uFEFF' + rows.map(r => r.map(cell => {
      const escaped = String(cell).replace(/"/g, '""');
      return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')
        ? `"${escaped}"`
        : escaped;
    }).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [stats, dateRange]);

  // Print handler
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Order status distribution data
  const totalStatusOrders = stats?.ordersByStatus?.reduce(
    (sum, s) => sum + s._count.id, 0
  ) || 0;

  // Payment method pie data
  const paymentPieData = useMemo(() => {
    if (!stats?.revenueByPaymentMethod?.length) return [];
    return stats.revenueByPaymentMethod.map((p, i) => ({
      name: p.label,
      value: p.revenue,
      count: p.count,
      fill: PAYMENT_COLORS[i % PAYMENT_COLORS.length],
    }));
  }, [stats?.revenueByPaymentMethod]);

  // Retention chart data
  const retentionChartData = useMemo(() => {
    if (!stats?.customerRetention?.length) return [];
    return stats.customerRetention.map(r => ({
      period: r.period,
      'Новые': r.newCustomers,
      'Повторные': r.repeatCustomers,
    }));
  }, [stats?.customerRetention]);

  // Delivery trend chart data
  const deliveryChartData = useMemo(() => {
    if (!stats?.deliveryTimeTrend?.length) return [];
    return stats.deliveryTimeTrend.map(d => ({
      period: d.period,
      'Ср. время (ч)': d.avgHours,
    }));
  }, [stats?.deliveryTimeTrend]);

  // Geo chart data
  const geoChartData = useMemo(() => {
    if (!stats?.geoDistribution?.length) return [];
    return stats.geoDistribution.slice(0, 8).map(g => ({
      city: g.city,
      'Выручка': g.revenue,
      'Заказов': g.orders,
    }));
  }, [stats?.geoDistribution]);

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-3">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-9 w-9" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border p-4 space-y-2">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border p-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            <div className="rounded-lg bg-muted h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const metricsCards = [
    {
      title: 'Выручка',
      rawValue: stats?.totalRevenue || 0,
      value: formatPrice(stats?.totalRevenue || 0),
      icon: DollarSign,
      color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      trend: prevStats ? <TrendIndicator current={stats?.totalRevenue || 0} previous={prevStats.totalRevenue} /> : null,
      animate: true,
    },
    {
      title: 'Средний чек',
      rawValue: stats?.averageCheck || 0,
      value: formatPrice(stats?.averageCheck || 0),
      icon: BarChart3,
      color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
      trend: prevStats ? <TrendIndicator current={stats?.averageCheck || 0} previous={prevStats.averageCheck} /> : null,
      animate: true,
    },
    {
      title: 'Конверсия',
      rawValue: stats?.conversionRate || 0,
      value: `${(stats?.conversionRate || 0).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      trend: null,
      animate: false,
    },
    {
      title: 'Продано товаров',
      rawValue: stats?.totalItemsSold || 0,
      value: (stats?.totalItemsSold || 0).toLocaleString('ru-RU'),
      icon: Package,
      color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
      trend: prevStats ? <TrendIndicator current={stats?.totalItemsSold || 0} previous={prevStats.totalItemsSold} /> : null,
      animate: true,
    },
    {
      title: 'Всего заказов',
      rawValue: stats?.totalOrders || 0,
      value: (stats?.totalOrders || 0).toLocaleString('ru-RU'),
      icon: ShoppingCart,
      color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
      trend: prevStats ? <TrendIndicator current={stats?.totalOrders || 0} previous={prevStats.totalOrders} /> : null,
      animate: true,
    },
    {
      title: 'Оплаченных',
      rawValue: stats?.paidOrdersCount || 0,
      value: (stats?.paidOrdersCount || 0).toLocaleString('ru-RU'),
      icon: CheckCircle2,
      color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
      trend: prevStats ? <TrendIndicator current={stats?.paidOrdersCount || 0} previous={prevStats.paidOrdersCount} /> : null,
      animate: true,
    },
    {
      title: 'Новые клиенты',
      rawValue: stats?.newUsers || 0,
      value: (stats?.newUsers || 0).toLocaleString('ru-RU'),
      icon: Users,
      color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
      trend: prevStats ? <TrendIndicator current={stats?.newUsers || 0} previous={prevStats.newUsers} /> : null,
      animate: true,
    },
    {
      title: 'Ср. доставка',
      rawValue: stats?.avgDeliveryHours || 0,
      value: formatDeliveryHours(stats?.avgDeliveryHours || 0),
      icon: Timer,
      color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
      trend: prevStats ? <TrendIndicator current={stats?.avgDeliveryHours || 0} previous={prevStats.avgDeliveryHours} invert /> : null,
      animate: false,
    },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden print:overflow-visible">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-3 print:border-0 print:bg-white">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView('admin')} className="print:hidden">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold">Аналитика продаж</h1>
            <p className="text-xs text-muted-foreground">
              Статистика вашего магазина
              {autoRefresh && (
                <span className="ml-2 inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Activity className="h-3 w-3 animate-pulse" />
                  Авто {autoRefreshInterval}с
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1 print:hidden">
            {/* Layout settings */}
            <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" align="end">
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Настройки дашборда</p>

                  {/* Auto-refresh */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Авто-обновление</span>
                      <Switch
                        checked={autoRefresh}
                        onCheckedChange={setAutoRefresh}
                      />
                    </div>
                    {autoRefresh && (
                      <Select value={String(autoRefreshInterval)} onValueChange={(v) => setAutoRefreshInterval(Number(v) as 30 | 60)}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">Каждые 30 сек</SelectItem>
                          <SelectItem value="60">Каждые 60 сек</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="border-t pt-2" />

                  {/* Section toggles */}
                  <p className="text-xs font-medium text-muted-foreground">Отображение секций</p>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {SECTION_CONFIG.map(section => (
                      <div key={section.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {section.icon}
                          <span className="text-xs">{section.label}</span>
                        </div>
                        <Switch
                          checked={isSectionVisible(section.id)}
                          onCheckedChange={() => toggleSection(section.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchStats(true)}
              disabled={refreshing}
              className="h-8 w-8"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>

            {/* Export dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" disabled={!stats} className="h-8 w-8">
                  <Download className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="end">
                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Экспорт JSON
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Экспорт CSV
                </button>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrint}
              className="h-8 w-8"
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Date range selector */}
        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeType)}>
            <SelectTrigger className="w-[140px] sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Сегодня</SelectItem>
              <SelectItem value="week">Неделя</SelectItem>
              <SelectItem value="month">Месяц</SelectItem>
              <SelectItem value="all">Всё время</SelectItem>
              <SelectItem value="custom">Свой период</SelectItem>
            </SelectContent>
          </Select>

          {/* Custom date range picker */}
          {dateRange === 'custom' && (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {customFrom ? formatShortDate(customFrom.toISOString()) : 'От'}
                  {' — '}
                  {customTo ? formatShortDate(customTo.toISOString()) : 'До'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={{ from: customFrom, to: customTo } as DateRange}
                  onSelect={(range: DateRange | undefined) => {
                    setCustomFrom(range?.from);
                    setCustomTo(range?.to);
                    if (range?.to) setCalendarOpen(false);
                  }}
                  numberOfMonths={1}
                  disabled={{ after: new Date() }}
                />
              </PopoverContent>
            </Popover>
          )}

          <Badge variant="secondary" className="ml-auto">
            {dateRangeLabels[dateRange]}
          </Badge>
          {/* Revenue comparison badge */}
          {revenueChange !== null && (
            <Badge
              className={cn(
                'text-xs font-semibold',
                revenueChange > 0
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : revenueChange < 0
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
              )}
            >
              {revenueChange > 0 ? '↑' : revenueChange < 0 ? '↓' : '→'}
              {' '}{Math.abs(Math.round(revenueChange))}%
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-14 print:overflow-visible print:pb-0">
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-5 print:p-2 print:space-y-3">
          {/* Demo data warning */}
          {stats?.isDemo && (
            <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 print:hidden">
              <CardContent className="p-3">
                <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                  Данные недоступны
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                  {stats.reason || 'База данных не подключена или произошла ошибка запроса.'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* API Error */}
          {stats?._apiError && !stats?.isDemo && (
            <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 print:hidden">
              <CardContent className="flex items-start gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                    Ошибка загрузки данных
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-500 mt-1 break-all">
                    {stats._apiErrorMessage || 'Неизвестная ошибка'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchStats(true)}
                  className="shrink-0 text-red-600 hover:text-red-800"
                >
                  Повторить
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Key Metrics Grid */}
          {isSectionVisible('metrics') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 } as const}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 print:grid-cols-4"
            >
              {metricsCards.map((metric, idx) => {
                const Icon = metric.icon;
                return (
                  <motion.div
                    key={metric.title}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.3 } as const}
                  >
                    <Card className="overflow-hidden">
                      <CardContent className="p-2.5 sm:p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={cn('p-1.5 rounded-lg', metric.color)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{metric.title}</p>
                        </div>
                        <div className="flex items-end justify-between gap-1">
                          <p className="text-base sm:text-lg font-bold leading-tight">
                            {metric.animate && metric.rawValue > 0 ? (
                              <AnimatedCounter value={metric.rawValue} />
                            ) : (
                              metric.value
                            )}
                          </p>
                          {metric.trend}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Revenue Chart + Status Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 print:grid-cols-3">
            {/* Revenue Chart */}
            {isSectionVisible('revenue') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 } as const}
                className="lg:col-span-2"
              >
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        {chartTitleByRange[dateRange]}
                      </CardTitle>
                      {revenueChange !== null && (
                        <span
                          className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded-full',
                            revenueChange > 0
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : revenueChange < 0
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          )}
                        >
                          {revenueChange > 0 ? '↑ +' : revenueChange < 0 ? '↓ ' : '→ '}{Math.abs(Math.round(revenueChange))}% vs пред. период
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const chartData = getChartData(
                        stats?.dailyRevenue || {},
                        stats?.monthlyRevenue || {},
                        stats?.hourlyRevenue || {},
                        dateRange
                      );
                      if (chartData.length === 0) {
                        return (
                          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                            Нет данных за выбранный период
                          </div>
                        );
                      }
                      const hasMultiplePoints = chartData.length > 1;
                      return (
                        <div className={cn('w-full', dateRange === 'all' ? 'h-56' : 'h-48')}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                              <XAxis
                                dataKey="label"
                                tick={{ fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                interval={dateRange === 'month' ? 4 : dateRange === 'all' || dateRange === 'custom' ? 0 : 0}
                              />
                              <YAxis
                                tick={{ fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => {
                                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}М`;
                                  if (value >= 1000) return `${(value / 1000).toFixed(0)}к`;
                                  return String(value);
                                }}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                }}
                                formatter={(value) => [formatPrice(Number(value)), 'Выручка']}
                                labelFormatter={(label) => `📅 ${label}`}
                              />
                              <Line
                                type={hasMultiplePoints ? 'monotone' : 'linear'}
                                dataKey="revenue"
                                stroke="oklch(0.72 0.19 155)"
                                strokeWidth={2.5}
                                dot={{
                                  fill: 'oklch(0.72 0.19 155)',
                                  strokeWidth: 0,
                                  r: dateRange === 'all' || dateRange === 'custom' ? 3 : dateRange === 'month' ? 1 : 4,
                                }}
                                activeDot={{ r: 6, strokeWidth: 2, stroke: 'white' }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Order Status Distribution */}
            {isSectionVisible('status') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.3 } as const}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Layers className="h-4 w-4 text-purple-500" />
                      Статусы заказов
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats?.ordersByStatus?.length ? (
                      <div className="space-y-2.5">
                        {stats.ordersByStatus
                          .sort((a, b) => b._count.id - a._count.id)
                          .map((item) => {
                            const config = statusConfig[item.status];
                            const count = item._count.id;
                            const pct = totalStatusOrders > 0 ? Math.round((count / totalStatusOrders) * 100) : 0;
                            return (
                              <div key={item.status} className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Badge className={cn('text-[10px] px-1.5 py-0 h-4 shrink-0', config?.color || 'bg-gray-100 text-gray-600')}>
                                      {config?.label || item.status}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">{count}</span>
                                  </div>
                                  <span className="text-xs font-semibold">{pct}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                                  <div
                                    className={cn('h-full rounded-full transition-all duration-500', config?.barColor || 'bg-gray-400')}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        <p className="text-[10px] text-muted-foreground pt-1">
                          Всего: {totalStatusOrders} заказов
                        </p>
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                        Нет данных
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Revenue by Payment Method + Customer Retention */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-2">
            {/* Revenue by Payment Method (Donut Chart) */}
            {isSectionVisible('payment') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.3 } as const}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-500" />
                      По способу оплаты
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {paymentPieData.length > 0 ? (
                      <div className="space-y-3">
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={paymentPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {paymentPieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                }}
                                formatter={(value, name) => [formatPrice(Number(value)), name]}
                              />
                              <Legend
                                iconType="circle"
                                iconSize={8}
                                wrapperStyle={{ fontSize: '11px' }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-1.5">
                          {stats?.revenueByPaymentMethod?.map((p, i) => {
                            const total = stats.revenueByPaymentMethod.reduce((s, x) => s + x.revenue, 0);
                            const pct = total > 0 ? Math.round((p.revenue / total) * 100) : 0;
                            return (
                              <div key={p.method} className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }}
                                  />
                                  <span className="truncate">{p.label}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-muted-foreground">{pct}% ({p.count})</span>
                                  <span className="font-medium">{formatPrice(p.revenue)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                        Нет данных об оплате
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Customer Retention Chart */}
            {isSectionVisible('retention') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.3 } as const}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-teal-500" />
                      Удержание клиентов
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {retentionChartData.length > 0 ? (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={retentionChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="period" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                fontSize: '12px',
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="Новые"
                              stackId="1"
                              stroke="oklch(0.65 0.18 250)"
                              fill="oklch(0.65 0.18 250 / 0.3)"
                              strokeWidth={2}
                            />
                            <Area
                              type="monotone"
                              dataKey="Повторные"
                              stackId="1"
                              stroke="oklch(0.72 0.19 155)"
                              fill="oklch(0.72 0.19 155 / 0.3)"
                              strokeWidth={2}
                            />
                            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                        Нет данных об удержании
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Delivery Time Trend + Profitability */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-2">
            {/* Average Delivery Time Trend */}
            {isSectionVisible('delivery') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.3 } as const}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Truck className="h-4 w-4 text-orange-500" />
                      Время доставки (тренд)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {deliveryChartData.length > 0 ? (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={deliveryChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="period" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis
                              tick={{ fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                              unit="ч"
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                fontSize: '12px',
                              }}
                              formatter={(value) => [`${Number(value).toFixed(1)} ч`, 'Ср. время']}
                            />
                            <Line
                              type="monotone"
                              dataKey="Ср. время (ч)"
                              stroke="oklch(0.70 0.15 60)"
                              strokeWidth={2.5}
                              dot={{ fill: 'oklch(0.70 0.15 60)', strokeWidth: 0, r: 4 }}
                              activeDot={{ r: 6, strokeWidth: 2, stroke: 'white' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                        Нет данных о доставке
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Profitability Analysis */}
            {isSectionVisible('profitability') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.3 } as const}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-500" />
                      Рентабельность
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats?.profitability && stats.profitability.totalProfit > 0 ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Прибыль</p>
                            <p className="text-sm font-bold text-green-600 dark:text-green-400">
                              <AnimatedCounter value={stats.profitability.totalProfit} />
                            </p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Себестоимость</p>
                            <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                              <AnimatedCounter value={stats.profitability.totalCost} />
                            </p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Маржа</p>
                            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                              {stats.profitability.averageMargin}%
                            </p>
                          </div>
                        </div>
                        {stats.profitability.mostProfitableProducts?.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Самые прибыльные товары</p>
                            {stats.profitability.mostProfitableProducts.map((p, i) => (
                              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-bold text-muted-foreground w-4 shrink-0">{i + 1}</span>
                                  <span className="truncate">{p.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                    {p.margin}%
                                  </Badge>
                                  <span className="font-medium text-green-600 dark:text-green-400">
                                    +{formatPrice(p.profit)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                        <PieChartIcon className="h-8 w-8 mr-2 opacity-30" />
                        Нет данных о себестоимости
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Hour Heatmap */}
          {isSectionVisible('heatmap') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.3 } as const}
            >
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    Активность по часам
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <HourHeatmap hourlyRevenue={stats?.hourlyRevenue || {}} />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Geo Distribution + Top Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-2">
            {/* Geo Distribution */}
            {isSectionVisible('geo') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.3 } as const}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-rose-500" />
                      Геораспределение заказов
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {geoChartData.length > 0 ? (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={geoChartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                            <XAxis
                              type="number"
                              tick={{ fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(value) => {
                                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}М`;
                                if (value >= 1000) return `${(value / 1000).toFixed(0)}к`;
                                return String(value);
                              }}
                            />
                            <YAxis
                              type="category"
                              dataKey="city"
                              tick={{ fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                              width={80}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                fontSize: '12px',
                              }}
                              formatter={(value, name) => {
                                if (name === 'Выручка') return [formatPrice(Number(value)), name];
                                return [value, name];
                              }}
                            />
                            <Bar dataKey="Выручка" fill="oklch(0.65 0.20 330)" radius={[0, 4, 4, 0]} barSize={18} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                        Нет данных о городах доставки
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Top Categories by Revenue */}
            {isSectionVisible('categories') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.3 } as const}
              >
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Layers className="h-4 w-4 text-teal-500" />
                      Топ категорий по выручке
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats?.topCategories && stats.topCategories.length > 0 ? (
                      <div className="space-y-2">
                        {(stats.topCategories ?? []).map((cat, idx) => {
                          const maxRevenue = (stats.topCategories ?? [])[0]?.revenue || 1;
                          const pct = Math.round((cat.revenue / maxRevenue) * 100);
                          return (
                            <div key={cat.name} className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-bold text-muted-foreground w-5 shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="text-sm font-medium truncate">{cat.name}</span>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-semibold">{formatPrice(cat.revenue)}</p>
                                  <p className="text-[10px] text-muted-foreground">{cat.orderCount} товаров</p>
                                </div>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-teal-400 dark:bg-teal-500 transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                        Нет данных о категориях
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Tabs: Recent Orders + Top Products */}
          {isSectionVisible('tabs') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.3 } as const}
            >
              <Tabs defaultValue="recent-orders">
                <TabsList className="w-full">
                  <TabsTrigger value="recent-orders" className="flex-1">
                    Последние заказы
                  </TabsTrigger>
                  <TabsTrigger value="top-products" className="flex-1">
                    Топ товаров
                  </TabsTrigger>
                </TabsList>

                {/* Recent Orders */}
                <TabsContent value="recent-orders" className="mt-4">
                  <Card>
                    <CardContent className="p-0">
                      {filteredRecentOrders.length > 0 ? (
                        <div className="max-h-96 overflow-y-auto">
                          {filteredRecentOrders.map((order, index) => {
                            const status = statusConfig[order.status];
                            return (
                              <div key={order.id}>
                                {index > 0 && <div className="border-t" />}
                                <div className="p-3 flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <CopyableOrderNumber orderNumber={order.orderNumber} className="text-xs" />
                                      {status && (
                                        <Badge className={cn('text-[10px] px-1.5 py-0 h-4', status.color)}>
                                          {status.label}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {formatShortDate(order.createdAt)}
                                      {order.items?.[0]?.productName && (
                                        <span className="block truncate max-w-[200px]">
                                          {order.items[0].productName}
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  <p className="text-sm font-semibold shrink-0">
                                    {formatPrice(order.total)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-muted-foreground">
                          <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Заказов за этот период нет</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Top Products */}
                <TabsContent value="top-products" className="mt-4">
                  <Card>
                    <CardContent className="p-0">
                      {stats?.topProducts?.length ? (
                        <div className="max-h-96 overflow-y-auto">
                          {stats.topProducts.slice(0, 10).map((product, index) => (
                            <div key={product.id}>
                              {index > 0 && <div className="border-t" />}
                              <div className="p-3 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <span className="text-sm font-bold text-muted-foreground w-5 shrink-0">
                                    {index + 1}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{product.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Продано: {product.skuCount.toLocaleString('ru-RU')} шт.
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-semibold">
                                    {formatPrice(product.price)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatPrice(product.price * product.skuCount)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-muted-foreground">
                          <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Данных о продажах пока нет</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

