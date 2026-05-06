'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useShopStore } from '@/stores/shop-store';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  Image as ImageIcon,
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Search,
  LayoutList,
  GalleryHorizontalEnd,
  Calendar as CalendarIcon,
  CalendarClock,
  Clock,
  Eye,
  FolderOpen,
  Package,
  Globe,
  AlertTriangle,
  Ban,
  Play,
  Pause,
  Timer,
  ImagePlus,
  Link2,
  GripVertical,
  Copy,
  Maximize2,
  BarChart3,
  MousePointerClick,
  Upload,
  Loader2,
  Tag,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format as formatDateFns } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

/* ──────────────────── Types ──────────────────── */

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
  linkType: string | null;
  sortOrder: number;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  group: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  parentId?: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { products: number };
}

interface ProductSearchResult {
  id: string;
  name: string;
  price: number;
  images?: string | null;
}

type LinkType = 'none' | 'category' | 'product' | 'external';
type ViewMode = 'list' | 'carousel';
type TabValue = 'all' | 'active' | 'inactive';

const LINK_TYPE_OPTIONS: { value: LinkType; label: string; icon: React.ReactNode }[] = [
  { value: 'none', label: 'Нет ссылки', icon: <Ban className="h-3.5 w-3.5" /> },
  { value: 'category', label: 'Категория', icon: <FolderOpen className="h-3.5 w-3.5" /> },
  { value: 'product', label: 'Товар', icon: <Package className="h-3.5 w-3.5" /> },
  { value: 'external', label: 'Внешний URL', icon: <Globe className="h-3.5 w-3.5" /> },
];

const BANNER_GROUPS = [
  { value: 'none', label: 'Без группы' },
  { value: 'main', label: 'Главная' },
  { value: 'promotions', label: 'Акции' },
  { value: 'seasonal', label: 'Сезонные' },
  { value: 'new', label: 'Новинки' },
  { value: 'other', label: 'Другое' },
] as const;

const defaultBanner: Omit<Banner, 'id' | 'createdAt' | 'updatedAt'> = {
  title: '',
  subtitle: '',
  imageUrl: '',
  linkUrl: '',
  linkType: 'category',
  sortOrder: 0,
  isActive: true,
  startDate: null,
  endDate: null,
  group: 'none',
};

/* ──────────────────── Helper Components ──────────────────── */

function InfinityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />
    </svg>
  );
}

function getLinkTypeLabel(linkType: string | null): { label: string; icon: React.ReactNode; color: string } {
  switch (linkType) {
    case 'category':
      return { label: 'Категория', icon: <FolderOpen className="h-3 w-3" />, color: 'bg-blue-500/10 text-blue-600' };
    case 'product':
      return { label: 'Товар', icon: <Package className="h-3 w-3" />, color: 'bg-emerald-500/10 text-emerald-600' };
    case 'external':
      return { label: 'Ссылка', icon: <Globe className="h-3 w-3" />, color: 'bg-orange-500/10 text-orange-600' };
    default:
      return { label: 'Нет ссылки', icon: <Ban className="h-3 w-3" />, color: 'bg-gray-500/10 text-gray-500' };
  }
}

function getScheduleStatus(banner: Banner): { label: string; icon: React.ReactNode; color: string } {
  if (!banner.startDate && !banner.endDate) {
    return { label: 'Постоянный', icon: <InfinityIcon className="h-3 w-3" />, color: 'text-muted-foreground' };
  }
  const now = new Date();
  const start = banner.startDate ? new Date(banner.startDate) : null;
  const end = banner.endDate ? new Date(banner.endDate) : null;

  if (start && now < start) {
    return { label: 'Запланирован', icon: <CalendarClock className="h-3 w-3" />, color: 'text-amber-500' };
  }
  if (end && now > end) {
    return { label: 'Истёк', icon: <Timer className="h-3 w-3" />, color: 'text-red-500' };
  }
  return { label: 'По расписанию', icon: <CalendarIcon className="h-3 w-3" />, color: 'text-green-500' };
}

function isBannerExpired(banner: Banner): boolean {
  if (!banner.endDate) return false;
  return new Date(banner.endDate) < new Date() && banner.isActive;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getGroupLabel(group: string | null): string {
  if (!group) return '';
  const found = BANNER_GROUPS.find(g => g.value === group);
  return found ? found.label : group;
}

/* ──────────────────── Sortable Banner Card ──────────────────── */

function SortableBannerCard({
  banner,
  index,
  categories,
  productNames,
  onToggleActive,
  onEdit,
  onDelete,
  onDuplicate,
  onPreview,
  onDeactivateExpired,
}: {
  banner: Banner;
  index: number;
  categories: Category[];
  productNames: Record<string, string>;
  onToggleActive: (banner: Banner) => void;
  onEdit: (banner: Banner) => void;
  onDelete: (banner: Banner) => void;
  onDuplicate: (banner: Banner) => void;
  onPreview: (banner: Banner) => void;
  onDeactivateExpired: (banner: Banner) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: banner.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const linkInfo = getLinkTypeLabel(banner.linkType);
  const scheduleInfo = getScheduleStatus(banner);
  const expired = isBannerExpired(banner);

  const getResolvedLinkName = (): string | null => {
    if (!banner.linkUrl || banner.linkType === 'none') return null;
    if (banner.linkType === 'category') {
      return categories.find(c => c.id === banner.linkUrl)?.name || null;
    }
    if (banner.linkType === 'product') {
      return productNames[banner.linkUrl] || null;
    }
    return null;
  };

  const resolvedLinkName = getResolvedLinkName();

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: index * 0.04 }}
      className={cn(isDragging && 'z-50 opacity-70')}
    >
      <Card className={cn(
        'overflow-hidden transition-all',
        !banner.isActive && 'opacity-60',
                expired && 'ring-2 ring-red-400/50',
      )}>
        {/* Expired warning banner */}
        {expired && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-b border-red-200">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            <span className="text-xs text-red-600 flex-1">Баннер истёк — срок действия закончился</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-500/10 px-2"
              onClick={() => onDeactivateExpired(banner)}
            >
              Отключить
            </Button>
          </div>
        )}

        <div className="flex">
          {/* Drag handle */}
          <div
            className="flex items-center justify-center w-9 shrink-0 cursor-grab active:cursor-grabbing border-r bg-muted/30 hover:bg-muted/60 transition-colors"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Image preview */}
          <div className="relative w-28 sm:w-36 shrink-0 bg-muted">
            {banner.imageUrl ? (
              <img
                src={banner.imageUrl}
                alt={banner.title}
                className="w-full h-full object-cover min-h-[80px]"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center min-h-[80px]">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            {banner.imageUrl && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/20" />
            )}
            <div className="absolute bottom-1 left-1">
              <Badge variant="secondary" className="text-[9px] font-mono bg-black/50 text-white border-0 h-4 px-1">
                #{banner.sortOrder + 1}
              </Badge>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 p-3 flex flex-col justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm truncate">{banner.title}</h3>
                  {banner.group && (
                    <Badge variant="outline" className="text-[9px] shrink-0 h-4 px-1.5 gap-0.5">
                      <Tag className="h-2.5 w-2.5" />
                      {getGroupLabel(banner.group)}
                    </Badge>
                  )}
                </div>
                {banner.subtitle && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{banner.subtitle}</p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className={cn('text-[9px] font-medium border-0 h-4 px-1.5', linkInfo.color)}>
                    {linkInfo.icon}
                    <span className="ml-0.5">{linkInfo.label}</span>
                    {resolvedLinkName && (
                      <span className="ml-1 opacity-70 truncate max-w-[100px]">: {resolvedLinkName}</span>
                    )}
                  </Badge>
                  {(banner.startDate || banner.endDate) && (
                    <Badge className={cn(
                      'text-[9px] font-medium border-0 h-4 px-1.5',
                      scheduleInfo.color === 'text-amber-500' ? 'bg-amber-500/10 text-amber-600' :
                      scheduleInfo.color === 'text-red-500' ? 'bg-red-500/10 text-red-600' :
                      scheduleInfo.color === 'text-green-500' ? 'bg-green-500/10 text-green-600' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {scheduleInfo.icon}
                      <span className="ml-0.5">{scheduleInfo.label}</span>
                    </Badge>
                  )}
                </div>
                {banner.linkUrl && banner.linkType !== 'none' && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 truncate mt-0.5">
                    <Link2 className="h-3 w-3 shrink-0" />
                    {resolvedLinkName
                      ? resolvedLinkName
                      : banner.linkType === 'category'
                        ? categories.find(c => c.id === banner.linkUrl)?.name || banner.linkUrl
                        : banner.linkType === 'product'
                          ? productNames[banner.linkUrl] || `Товар: ${banner.linkUrl}`
                          : banner.linkUrl}
                  </p>
                )}
                {(banner.startDate || banner.endDate) && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3 shrink-0" />
                    {banner.startDate && `с ${formatDate(banner.startDate)}`}
                    {banner.startDate && banner.endDate && ' '}
                    {banner.endDate && `до ${formatDate(banner.endDate)}`}
                  </p>
                )}

            <div className="flex items-center justify-between pt-2 mt-1 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  checked={banner.isActive}
                  onCheckedChange={() => onToggleActive(banner)}
                />
                <span className="text-xs text-muted-foreground">{banner.isActive ? 'Вкл' : 'Выкл'}</span>
                <div className="hidden sm:flex items-center gap-2 ml-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground cursor-default">
                        <BarChart3 className="h-3 w-3" /> 0
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Просмотры</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground cursor-default">
                        <MousePointerClick className="h-3 w-3" /> 0
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Клики</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPreview(banner)}>
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Превью</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDuplicate(banner)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Дублировать</TooltipContent>
                </Tooltip>
                <div className="w-px h-4 bg-border mx-0.5" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(banner)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Редактировать</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(banner)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Удалить</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center px-2 border-l bg-muted/20">
            <Badge className={cn(
              'text-[9px] font-medium border-0 h-4 px-1.5',
              banner.isActive ? 'bg-green-500/90 text-white hover:bg-green-500/90' : 'bg-gray-400/90 text-white hover:bg-gray-400/90'
            )}>
              {banner.isActive ? 'ON' : 'OFF'}
            </Badge>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

/* ──────────────────── Date Picker Field ──────────────────── */

function DatePickerField({
  label,
  date,
  onChange,
}: {
  label: string;
  date: Date | undefined;
  onChange: (date: Date | undefined) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('w-full justify-start text-left font-normal h-9', !date && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            {date ? formatDateFns(date, 'dd.MM.yyyy', { locale: ru }) : 'Выберите дату'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => { onChange(d); setOpen(false); }}
            initialFocus
          />
          {date && (
            <div className="border-t p-2 flex justify-end">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { onChange(undefined); setOpen(false); }}>
                Очистить
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/* ──────────────────── Main Component ──────────────────── */

export function BannersManager() {
  const { setCurrentView } = useShopStore();
  const { toast } = useToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Omit<Banner, 'id' | 'createdAt' | 'updatedAt'>>(defaultBanner);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bannerToDelete, setBannerToDelete] = useState<Banner | null>(null);

  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [categories, setCategories] = useState<Category[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productNames, setProductNames] = useState<Record<string, string>>({});

  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const [previewBanner, setPreviewBanner] = useState<Banner | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const autoplayRef = useRef<NodeJS.Timeout | null>(null);

  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editStartDate, setEditStartDate] = useState<Date | undefined>(undefined);
  const [editEndDate, setEditEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => { fetchBanners(); fetchCategories(); }, []);

  useEffect(() => {
    setEditStartDate(editForm.startDate ? new Date(editForm.startDate) : undefined);
    setEditEndDate(editForm.endDate ? new Date(editForm.endDate) : undefined);
  }, [editForm.startDate, editForm.endDate]);

  useEffect(() => {
    const productBanners = banners.filter(b => b.linkType === 'product' && b.linkUrl);
    if (productBanners.length === 0) return;
    const missingIds = productBanners.map(b => b.linkUrl!).filter(id => !productNames[id]);
    if (missingIds.length === 0) return;
    const resolveProducts = async () => {
      const newNames: Record<string, string> = {};
      for (const id of missingIds.slice(0, 5)) {
        try {
          const res = await fetch(`/api/products/${id}`);
          if (res.ok) { const data = await res.json(); newNames[id] = data.name || id; }
        } catch { /* ignore */ }
      }
      if (Object.keys(newNames).length > 0) setProductNames(prev => ({ ...prev, ...newNames }));
    };
    resolveProducts();
  }, [banners, productNames]);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/banners/all');
      if (!res.ok) {
        const fallbackRes = await fetch('/api/banners');
        const data = await fallbackRes.json();
        setBanners(Array.isArray(data) ? data : []);
      } else {
        const data = await res.json();
        setBanners(Array.isArray(data) ? data : []);
      }
    } catch (error) { console.error('Error fetching banners:', error); }
    finally { setLoading(false); }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories?includeInactive=true');
      if (res.ok) { const data = await res.json(); setCategories(Array.isArray(data) ? data : []); }
    } catch (error) { console.error('Error fetching categories:', error); }
  };

  const searchProducts = useCallback(async (query: string) => {
    if (!query || query.length < 2) { setProductResults([]); return; }
    setProductSearchLoading(true);
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=10&all=true&includeCategory=false`);
      if (res.ok) { const data = await res.json(); const products = data.products || data; setProductResults(Array.isArray(products) ? products : []); }
    } catch { setProductResults([]); }
    finally { setProductSearchLoading(false); }
  }, []);

  useEffect(() => { const timer = setTimeout(() => searchProducts(productSearch), 300); return () => clearTimeout(timer); }, [productSearch, searchProducts]);

  const tabCounts = useMemo(() => ({
    total: banners.length,
    active: banners.filter(b => b.isActive).length,
    inactive: banners.filter(b => !b.isActive).length,
  }), [banners]);

  const filteredBanners = useMemo(() => {
    let result = [...banners];
    if (activeTab === 'active') result = result.filter(b => b.isActive);
    else if (activeTab === 'inactive') result = result.filter(b => !b.isActive);
    return result.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [banners, activeTab]);

  // Carousel autoplay effect
  useEffect(() => {
    if (autoplayEnabled && viewMode === 'carousel' && filteredBanners.length > 1) {
      autoplayRef.current = setInterval(() => {
        setCurrentSlide(prev => (prev + 1) % filteredBanners.length);
      }, 3500);
    }
    return () => { if (autoplayRef.current) clearInterval(autoplayRef.current); };
  }, [autoplayEnabled, viewMode, filteredBanners.length]);



  const handleSave = async () => {
    try {
      const formData = { ...editForm };
      if (isCreating) {
        const res = await fetch('/api/banners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
        if (res.ok) { toast({ title: 'Баннер создан' }); setEditDialogOpen(false); setIsCreating(false); setEditForm(defaultBanner); fetchBanners(); }
        else { toast({ title: 'Ошибка создания', variant: 'destructive' }); }
      } else if (editingId) {
        const res = await fetch(`/api/banners/${editingId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
        if (res.ok) { toast({ title: 'Баннер обновлён' }); setEditDialogOpen(false); setEditingId(null); setEditForm(defaultBanner); fetchBanners(); }
        else { toast({ title: 'Ошибка обновления', variant: 'destructive' }); }
      }
    } catch (error) { console.error('Error saving banner:', error); toast({ title: 'Ошибка сохранения', variant: 'destructive' }); }
  };

  const handleDeleteClick = (banner: Banner) => { setBannerToDelete(banner); setDeleteConfirmOpen(true); };
  const handleConfirmDelete = async () => {
    if (!bannerToDelete) return;
    try { const res = await fetch(`/api/banners/${bannerToDelete.id}`, { method: 'DELETE' }); if (res.ok) { toast({ title: 'Баннер удалён' }); fetchBanners(); } else { toast({ title: 'Ошибка удаления', variant: 'destructive' }); } }
    catch (error) { console.error('Error deleting banner:', error); toast({ title: 'Ошибка удаления', variant: 'destructive' }); }
    finally { setDeleteConfirmOpen(false); setBannerToDelete(null); }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      const res = await fetch(`/api/banners/${banner.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...banner, isActive: !banner.isActive }) });
      if (res.ok) { toast({ title: banner.isActive ? 'Баннер отключён' : 'Баннер включён' }); fetchBanners(); }
    } catch (error) { console.error('Error toggling banner:', error); }
  };

  const handleDeactivateExpired = async (banner: Banner) => {
    try {
      const res = await fetch(`/api/banners/${banner.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...banner, isActive: false }) });
      if (res.ok) { toast({ title: 'Баннер отключён (истёк срок)' }); fetchBanners(); }
    } catch (error) { console.error('Error deactivating expired banner:', error); }
  };

  const handleDuplicate = async (banner: Banner) => {
    try {
      const duplicateData = { title: `${banner.title} (копия)`, subtitle: banner.subtitle, imageUrl: banner.imageUrl, linkUrl: banner.linkUrl, linkType: banner.linkType, sortOrder: banners.length, isActive: false, startDate: banner.startDate, endDate: banner.endDate, group: banner.group };
      const res = await fetch('/api/banners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(duplicateData) });
      if (res.ok) { toast({ title: 'Баннер дублирован' }); fetchBanners(); }
      else { toast({ title: 'Ошибка дублирования', variant: 'destructive' }); }
    } catch (error) { console.error('Error duplicating banner:', error); toast({ title: 'Ошибка дублирования', variant: 'destructive' }); }
  };

  const handlePreview = (banner: Banner) => { setPreviewBanner(banner); setPreviewOpen(true); };

  const handleDragStart = (event: DragStartEvent) => { setActiveId(event.active.id as string); };
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filteredBanners.findIndex(b => b.id === active.id);
    const newIndex = filteredBanners.findIndex(b => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(filteredBanners, oldIndex, newIndex);
    setBanners(prev => { const all = [...prev]; reordered.forEach((banner, idx) => { const bIdx = all.findIndex(b => b.id === banner.id); if (bIdx !== -1) all[bIdx] = { ...all[bIdx], sortOrder: idx }; }); return all; });
    try { const updates = reordered.map((banner, idx) => fetch(`/api/banners/${banner.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...banner, sortOrder: idx }) })); await Promise.all(updates); }
    catch (error) { console.error('Error reordering banners:', error); toast({ title: 'Ошибка сортировки', variant: 'destructive' }); fetchBanners(); }
  };

  const startEdit = (banner: Banner) => {
    setEditingId(banner.id);
    setEditForm({ title: banner.title, subtitle: banner.subtitle || '', imageUrl: banner.imageUrl, linkUrl: banner.linkUrl || '', linkType: banner.linkType || 'category', sortOrder: banner.sortOrder, isActive: banner.isActive, startDate: banner.startDate ? banner.startDate.split('T')[0] : null, endDate: banner.endDate ? banner.endDate.split('T')[0] : null, group: banner.group || 'none' });
    setIsCreating(false); setEditDialogOpen(true); setProductSearch(''); setProductResults([]);
  };

  const startCreate = () => { setIsCreating(true); setEditingId(null); setEditForm({ ...defaultBanner, sortOrder: banners.length }); setEditDialogOpen(true); setProductSearch(''); setProductResults([]); };

  const handleDialogClose = (open: boolean) => { if (!open) { setEditDialogOpen(false); setEditingId(null); setIsCreating(false); setEditForm(defaultBanner); setProductSearch(''); setProductResults([]); setEditStartDate(undefined); setEditEndDate(undefined); } };

  const currentLinkType = (editForm.linkType || 'category') as LinkType;
  const handleLinkTypeChange = (value: string) => { const newType = value as LinkType; setEditForm(prev => ({ ...prev, linkType: newType, linkUrl: newType === 'none' ? '' : prev.linkUrl })); setProductSearch(''); setProductResults([]); };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast({ title: 'Выберите изображение', variant: 'destructive' }); return; }
    if (file.size > 5 * 1024 * 1024) { toast({ title: 'Файл слишком большой (макс. 5 МБ)', variant: 'destructive' }); return; }
    setImageUploading(true);
    try {
      const formData = new FormData(); formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) { const data = await res.json(); const imageUrl = data.url || data.imageUrl || data.secure_url; if (imageUrl) { setEditForm(prev => ({ ...prev, imageUrl })); toast({ title: 'Изображение загружено' }); } else { toast({ title: 'Ошибка: URL не получен', variant: 'destructive' }); } }
      else { toast({ title: 'Ошибка загрузки', variant: 'destructive' }); }
    } catch (error) { console.error('Error uploading image:', error); toast({ title: 'Ошибка загрузки', variant: 'destructive' }); }
    finally { setImageUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setCurrentView('admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Баннеры</h1>
              <p className="text-sm text-muted-foreground">Управление баннерами на главной</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
              <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('list')}><LayoutList className="h-3.5 w-3.5" /></Button>
              <Button variant={viewMode === 'carousel' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setViewMode('carousel')}><GalleryHorizontalEnd className="h-3.5 w-3.5" /></Button>
            </div>
            <Button onClick={startCreate}><Plus className="h-4 w-4 mr-2" />Добавить</Button>
          </div>
        </div>
      </div>



      {/* Tabs */}
      <div className="shrink-0 border-b px-4 pt-3">
        <div className="pb-2">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="flex-1">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">Все<Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{tabCounts.total}</Badge></TabsTrigger>
              <TabsTrigger value="active" className="flex-1">Активные<Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{tabCounts.active}</Badge></TabsTrigger>
              <TabsTrigger value="inactive" className="flex-1">Отключенные<Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">{tabCounts.inactive}</Badge></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <div className="p-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
          ) : filteredBanners.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}>
              <Card><CardContent className="py-16 text-center">
                <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4"><ImagePlus className="h-10 w-10 text-muted-foreground" /></div>
                <p className="text-lg font-medium text-foreground mb-1">Баннеры не найдены</p>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">Добавьте первый баннер для отображения на главной странице магазина</p>
                <Button onClick={startCreate}><Plus className="h-4 w-4 mr-2" />Создать баннер</Button>
              </CardContent></Card>
            </motion.div>
          ) : viewMode === 'carousel' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><GalleryHorizontalEnd className="h-4 w-4" />Превью: как баннеры выглядят для пользователей</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">{currentSlide + 1} / {filteredBanners.length}</span>
                  <Button variant={autoplayEnabled ? 'secondary' : 'outline'} size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setAutoplayEnabled(!autoplayEnabled)}>
                    {autoplayEnabled ? <><Pause className="h-3 w-3" /> Стоп</> : <><Play className="h-3 w-3" /> Авто</>}
                  </Button>
                </div>
              </div>
              <Carousel opts={{ loop: true, startIndex: currentSlide }} className="w-full">
                <CarouselContent>
                  {filteredBanners.map((banner) => (
                    <CarouselItem key={banner.id}>
                      <Card className="overflow-hidden border-0 cursor-pointer" onClick={() => handlePreview(banner)}>
                        <div className="relative aspect-[620/280] sm:aspect-[620/320]">
                          {banner.imageUrl ? <img src={banner.imageUrl} alt={banner.title} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center bg-muted"><ImageIcon className="h-12 w-12 text-muted-foreground" /></div>}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0"><div className="backdrop-blur-md bg-white/10 border-t border-white/10"><div className="px-4 py-3 text-white">
                            <div className="flex items-center gap-2"><h3 className="text-lg sm:text-2xl font-bold drop-shadow-sm">{banner.title}</h3>{banner.group && <Badge className="bg-white/20 text-white border-0 text-[9px] h-4 gap-0.5"><Tag className="h-2.5 w-2.5" />{getGroupLabel(banner.group)}</Badge>}</div>
                            {banner.subtitle && <p className="text-sm sm:text-base opacity-90 drop-shadow-sm">{banner.subtitle}</p>}
                          </div></div></div>
                          <div className="absolute top-3 right-3"><Badge className={cn('text-xs font-medium shadow-sm border-0', banner.isActive ? 'bg-green-500/90 text-white hover:bg-green-500/90' : 'bg-red-500/90 text-white hover:bg-red-500/90')}>{banner.isActive ? 'Активен' : 'Выключен'}</Badge></div>
                          <div className="absolute top-3 left-3"><Badge className="bg-black/40 text-white/80 border-0 text-[10px] backdrop-blur-sm"><Maximize2 className="h-2.5 w-2.5 mr-1" />Нажмите для просмотра</Badge></div>
                        </div>
                      </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-2" /><CarouselNext className="right-2" />
              </Carousel>
              <div className="mt-4 space-y-2">
                {filteredBanners.map((banner, idx) => {
                  const linkInfo = getLinkTypeLabel(banner.linkType);
                  return (
                    <div key={banner.id} className={cn('flex items-center gap-3 p-2 rounded-lg text-sm transition-colors cursor-pointer', idx === currentSlide ? 'bg-primary/10 ring-1 ring-primary/20' : 'bg-muted/50 hover:bg-muted/80')} onClick={() => setCurrentSlide(idx)}>
                      <span className="text-muted-foreground font-mono text-xs w-6 text-center">#{idx + 1}</span>
                      <span className="font-medium truncate flex-1">{banner.title}</span>
                      {banner.group && <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">{getGroupLabel(banner.group)}</Badge>}
                      <Badge className={cn('text-[9px] border-0 h-4 px-1.5', linkInfo.color)}>{linkInfo.icon}<span className="ml-0.5">{linkInfo.label}</span></Badge>
                      <Badge variant="outline" className={cn('text-[10px] shrink-0', banner.isActive ? 'border-green-500 text-green-600' : 'border-red-400 text-red-500')}>{banner.isActive ? 'Активен' : 'Выкл'}</Badge>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-muted-foreground">Перетаскивайте для сортировки</span>
              </div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredBanners.map(b => b.id)} strategy={verticalListSortingStrategy}>
                  <AnimatePresence mode="popLayout">
                    {filteredBanners.map((banner, index) => (
                      <SortableBannerCard key={banner.id} banner={banner} index={index} categories={categories} productNames={productNames} onToggleActive={handleToggleActive} onEdit={startEdit} onDelete={handleDeleteClick} onDuplicate={handleDuplicate} onPreview={handlePreview} onDeactivateExpired={handleDeactivateExpired} />
                    ))}
                  </AnimatePresence>
                </SortableContext>
                <DragOverlay>{activeId ? <Card className="shadow-xl opacity-80 overflow-hidden border-2 border-primary/30"><div className="flex items-center gap-3 p-3"><GripVertical className="h-4 w-4 text-muted-foreground" /><span className="font-medium text-sm truncate">{filteredBanners.find(b => b.id === activeId)?.title}</span></div></Card> : null}</DragOverlay>
              </DndContext>
            </div>
          )}
        </div>
      </div>



      {/* Full-screen Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden">
          {previewBanner && (
            <div className="relative">
              <div className="relative aspect-[620/280] sm:aspect-[620/320]">
                {previewBanner.imageUrl ? <img src={previewBanner.imageUrl} alt={previewBanner.title} className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /> : <div className="w-full h-full flex items-center justify-center bg-muted"><ImageIcon className="h-16 w-16 text-muted-foreground" /></div>}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0"><div className="backdrop-blur-md bg-white/10 border-t border-white/10"><div className="px-6 py-4 text-white">
                  <div className="flex items-center gap-2"><h3 className="text-xl sm:text-3xl font-bold drop-shadow-sm">{previewBanner.title}</h3>{previewBanner.group && <Badge className="bg-white/20 text-white border-0 text-[10px] gap-0.5"><Tag className="h-2.5 w-2.5" />{getGroupLabel(previewBanner.group)}</Badge>}</div>
                  {previewBanner.subtitle && <p className="text-base sm:text-lg opacity-90 drop-shadow-sm mt-1">{previewBanner.subtitle}</p>}
                </div></div></div>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Статус</p><Badge className={cn('text-xs border-0', previewBanner.isActive ? 'bg-green-500/10 text-green-600' : 'bg-gray-500/10 text-gray-500')}>{previewBanner.isActive ? 'Активен' : 'Выключен'}</Badge></div>
                  <div className="space-y-1"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Ссылка</p><Badge className={cn('text-xs border-0', getLinkTypeLabel(previewBanner.linkType).color)}>{getLinkTypeLabel(previewBanner.linkType).icon}<span className="ml-0.5">{getLinkTypeLabel(previewBanner.linkType).label}</span></Badge></div>
                  <div className="space-y-1"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Просмотры</p><p className="text-sm font-bold flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">N/A</span></p></div>
                  <div className="space-y-1"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Клики</p><p className="text-sm font-bold flex items-center gap-1"><MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">N/A</span></p></div>
                </div>
                {previewBanner.linkUrl && previewBanner.linkType !== 'none' && (
                  <div className="p-2 rounded-md bg-muted/50 text-xs"><span className="text-muted-foreground">Цель ссылки: </span><span className="font-medium">{previewBanner.linkType === 'category' ? categories.find(c => c.id === previewBanner.linkUrl)?.name || previewBanner.linkUrl : previewBanner.linkType === 'product' ? productNames[previewBanner.linkUrl] || `Товар: ${previewBanner.linkUrl}` : previewBanner.linkUrl}</span></div>
                )}
                {(previewBanner.startDate || previewBanner.endDate) && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 text-xs"><CalendarClock className="h-3.5 w-3.5 text-amber-600 shrink-0" /><span className="text-amber-700">{previewBanner.startDate && `с ${formatDate(previewBanner.startDate)}`}{previewBanner.startDate && previewBanner.endDate && ' '}{previewBanner.endDate && `до ${formatDate(previewBanner.endDate)}`}</span>{isBannerExpired(previewBanner) && <Badge className="bg-red-500/10 text-red-600 border-0 text-[10px] ml-auto">Истёк</Badge>}</div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" className="h-8" onClick={() => { setPreviewOpen(false); startEdit(previewBanner); }}><Edit className="h-3.5 w-3.5 mr-1.5" />Редактировать</Button>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => { setPreviewOpen(false); handleDuplicate(previewBanner); }}><Copy className="h-3.5 w-3.5 mr-1.5" />Дублировать</Button>
                  {isBannerExpired(previewBanner) && <Button variant="destructive" size="sm" className="h-8 ml-auto" onClick={() => { setPreviewOpen(false); handleDeactivateExpired(previewBanner); }}><RotateCcw className="h-3.5 w-3.5 mr-1.5" />Отключить (истёк)</Button>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreating ? 'Новый баннер' : 'Редактирование баннера'}</DialogTitle>
            <DialogDescription>{isCreating ? 'Заполните данные для создания нового баннера' : 'Измените данные баннера'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="banner-title">Заголовок *</Label><Input id="banner-title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Заголовок баннера" /></div>
            <div className="space-y-2"><Label htmlFor="banner-subtitle">Подзаголовок</Label><Input id="banner-subtitle" value={editForm.subtitle || ''} onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })} placeholder="Дополнительный текст" /></div>
            <div className="space-y-2">
              <Label>Изображение * <span className="text-muted-foreground font-normal text-[10px]">(рекомендуется 620×280)</span></Label>
              <div className="flex gap-2">
                <Input value={editForm.imageUrl} onChange={(e) => setEditForm({ ...editForm, imageUrl: e.target.value })} placeholder="https://example.com/image.jpg" className="flex-1" />
                <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" disabled={imageUploading} onClick={() => fileInputRef.current?.click()}>
                  {imageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>
            </div>
            {editForm.imageUrl && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }} className="overflow-hidden">
                <div className="aspect-[620/280] rounded-xl overflow-hidden bg-muted border"><img src={editForm.imageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /></div>
              </motion.div>
            )}
            <div className="space-y-2"><Label>Группа</Label><Select value={editForm.group || 'none'} onValueChange={(val) => setEditForm({ ...editForm, group: val === 'none' ? null : val })}><SelectTrigger className="w-full"><SelectValue placeholder="Выберите группу" /></SelectTrigger><SelectContent>{BANNER_GROUPS.map((g) => (<SelectItem key={g.value} value={g.value}><div className="flex items-center gap-2"><Tag className="h-3.5 w-3.5 text-muted-foreground" />{g.label}</div></SelectItem>))}</SelectContent></Select></div>
            <div className="space-y-3">
              <Label>Тип ссылки</Label>
              <Select value={currentLinkType} onValueChange={handleLinkTypeChange}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{LINK_TYPE_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}><div className="flex items-center gap-2">{opt.icon}{opt.label}</div></SelectItem>))}</SelectContent></Select>
              {currentLinkType === 'category' && (
                <div className="space-y-2">
                  <Label>Категория</Label>
                  <Select value={editForm.linkUrl || ''} onValueChange={(val) => setEditForm({ ...editForm, linkUrl: val, linkType: 'category' })}><SelectTrigger className="w-full"><SelectValue placeholder="Выберите категорию" /></SelectTrigger><SelectContent>{categories.filter(c => c.isActive).map((cat) => (<SelectItem key={cat.id} value={cat.id}><div className="flex items-center gap-2"><FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />{cat.name}{cat._count && cat._count.products > 0 && <span className="text-muted-foreground text-xs">({cat._count.products})</span>}</div></SelectItem>))}</SelectContent></Select>
                  {editForm.linkUrl && currentLinkType === 'category' && <div className="flex items-center gap-2 p-2 rounded-md bg-blue-500/5 text-xs"><FolderOpen className="h-3.5 w-3.5 text-blue-500 shrink-0" /><span className="text-blue-600">{categories.find(c => c.id === editForm.linkUrl)?.name || 'Категория не найдена'}</span></div>}
                </div>
              )}
              {currentLinkType === 'product' && (
                <div className="space-y-2">
                  <Label>Поиск товара</Label>
                  <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Введите название товара..." className="pl-9" />{productSearchLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" /></div>}</div>
                  {editForm.linkUrl && currentLinkType === 'product' && <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-500/5 text-xs"><Package className="h-3.5 w-3.5 text-emerald-500 shrink-0" /><span className="text-emerald-600 truncate flex-1">{productNames[editForm.linkUrl] || `Товар: ${editForm.linkUrl}`}</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditForm({ ...editForm, linkUrl: '' })}><X className="h-3 w-3" /></Button></div>}
                  {productResults.length > 0 && <div className="border rounded-md max-h-40 overflow-y-auto">{productResults.map((product) => (<button key={product.id} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left" onClick={() => { setEditForm({ ...editForm, linkUrl: product.id, linkType: 'product' }); setProductNames(prev => ({ ...prev, [product.id]: product.name })); setProductSearch(''); setProductResults([]); }}><Package className="h-4 w-4 text-muted-foreground shrink-0" /><span className="truncate">{product.name}</span><span className="text-muted-foreground text-xs ml-auto shrink-0">{product.price} ₽</span></button>))}</div>}
                </div>
              )}
              {currentLinkType === 'external' && (
                <div className="space-y-2">
                  <Label>URL</Label>
                  <div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={editForm.linkUrl || ''} onChange={(e) => setEditForm({ ...editForm, linkUrl: e.target.value, linkType: 'external' })} placeholder="https://example.com" className="pl-9" /></div>
                  {editForm.linkUrl && <div className="flex items-center gap-2 p-2 rounded-md bg-orange-500/5 text-xs"><Globe className="h-3.5 w-3.5 text-orange-500 shrink-0" /><span className="text-orange-600 truncate">{editForm.linkUrl}</span></div>}
                </div>
              )}
            </div>
            <div className="space-y-2"><Label htmlFor="banner-sort">Порядок</Label><Input id="banner-sort" type="number" value={editForm.sortOrder} onChange={(e) => setEditForm({ ...editForm, sortOrder: parseInt(e.target.value) || 0 })} /></div>
            <div className="space-y-3">
              <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-muted-foreground" /><Label className="text-sm font-medium">Расписание</Label></div>
              <p className="text-xs text-muted-foreground">Оставьте пустым для постоянного отображения баннера</p>
              <div className="grid grid-cols-2 gap-4">
                <DatePickerField label="Дата начала" date={editStartDate} onChange={(d) => { setEditStartDate(d); setEditForm(prev => ({ ...prev, startDate: d ? formatDateFns(d, 'yyyy-MM-dd') : null })); }} />
                <DatePickerField label="Дата окончания" date={editEndDate} onChange={(d) => { setEditEndDate(d); setEditForm(prev => ({ ...prev, endDate: d ? formatDateFns(d, 'yyyy-MM-dd') : null })); }} />
              </div>
              {(editForm.startDate || editForm.endDate) && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 text-amber-700 text-xs">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  <span>Баннер будет отображаться{editForm.startDate && ` с ${formatDate(editForm.startDate)}`}{editForm.endDate && ` до ${formatDate(editForm.endDate)}`}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] ml-auto text-amber-700 hover:text-amber-800" onClick={() => { setEditForm({ ...editForm, startDate: null, endDate: null }); setEditStartDate(undefined); setEditEndDate(undefined); }}>Убрать</Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" /><Label className="text-sm font-medium">Статистика</Label></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50 space-y-1"><div className="flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Просмотры</span></div><p className="text-lg font-bold">&mdash;</p><p className="text-[10px] text-muted-foreground">Отслеживание недоступно</p></div>
                <div className="p-3 rounded-lg bg-muted/50 space-y-1"><div className="flex items-center gap-1.5"><MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Клики</span></div><p className="text-lg font-bold">&mdash;</p><p className="text-[10px] text-muted-foreground">Отслеживание недоступно</p></div>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch id="banner-active" checked={editForm.isActive} onCheckedChange={(checked) => setEditForm({ ...editForm, isActive: checked })} />
              <Label htmlFor="banner-active" className="cursor-pointer">{editForm.isActive ? 'Активен' : 'Неактивен'}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)}><X className="h-4 w-4 mr-2" />Отмена</Button>
            <Button onClick={handleSave} disabled={!editForm.title || !editForm.imageUrl}><Save className="h-4 w-4 mr-2" />Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Удалить баннер?</AlertDialogTitle><AlertDialogDescription>Вы уверены, что хотите удалить баннер &laquo;{bannerToDelete?.title}&raquo;? Это действие нельзя отменить.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Удалить</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
  );
}
