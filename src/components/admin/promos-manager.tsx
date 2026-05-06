'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useShopStore } from '@/stores/shop-store';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Percent,
  Gift,
  Plus,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit,
  Save,
  X,
  Loader2,
  Calendar,
  Tag,
  Star,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
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

interface Promocode {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minOrder: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageCount: number;
  isActive: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface LoyaltySettings {
  pointsPerRub: number;
  pointsToRub: number;
  welcomeBonus: number;
  referralBonus: number;
  birthdayBonus: number;
  bronzeThreshold: number;
  bronzeMultiplier: number;
  silverThreshold: number;
  silverMultiplier: number;
  goldThreshold: number;
  goldMultiplier: number;
  platinumThreshold: number;
  platinumMultiplier: number;
  maxPointsPayment: number;
}

type PromoFilter = 'all' | 'active' | 'expired';

const defaultPromoForm = {
  code: '',
  discountType: 'percentage',
  discountValue: '',
  minOrder: '',
  maxDiscount: '',
  usageLimit: '',
  startsAt: '',
  expiresAt: '',
  isActive: true,
};

const defaultLoyaltySettings: LoyaltySettings = {
  pointsPerRub: 1,
  pointsToRub: 0.01,
  welcomeBonus: 100,
  referralBonus: 500,
  birthdayBonus: 500,
  bronzeThreshold: 0,
  bronzeMultiplier: 1,
  silverThreshold: 500,
  silverMultiplier: 1.5,
  goldThreshold: 2000,
  goldMultiplier: 2,
  platinumThreshold: 10000,
  platinumMultiplier: 3,
  maxPointsPayment: 50,
};

function getPromoStatus(promo: Promocode): 'active' | 'expired' | 'upcoming' {
  const now = new Date();
  if (promo.expiresAt && new Date(promo.expiresAt) < now) return 'expired';
  if (promo.startsAt && new Date(promo.startsAt) > now) return 'upcoming';
  if (!promo.isActive) return 'expired';
  return 'active';
}

function StatusBadge({ status }: { status: 'active' | 'expired' | 'upcoming' }) {
  const config = {
    active: { label: 'Активен', className: 'bg-green-500/90 text-white hover:bg-green-500/90 border-0' },
    expired: { label: 'Истёк', className: 'bg-red-500/90 text-white hover:bg-red-500/90 border-0' },
    upcoming: { label: 'Скоро', className: 'bg-amber-500/90 text-white hover:bg-amber-500/90 border-0' },
  };
  const { label, className } = config[status];
  return <Badge className={cn('text-xs font-medium', className)}>{label}</Badge>;
}

export function PromosManager() {
  const { setCurrentView } = useShopStore();
  const { toast } = useToast();
  const [promocodes, setPromocodes] = useState<Promocode[]>([]);
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings>(defaultLoyaltySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeFilter, setActiveFilter] = useState<PromoFilter>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promocode | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [promoForm, setPromoForm] = useState(defaultPromoForm);
  const [loyaltyForm, setLoyaltyForm] = useState<LoyaltySettings>(defaultLoyaltySettings);
  const [isLoyaltyFormOpen, setIsLoyaltyFormOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [promoToDelete, setPromoToDelete] = useState<Promocode | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Reset copied code after 2 seconds
  useEffect(() => {
    if (copiedCode) {
      const timer = setTimeout(() => setCopiedCode(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedCode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [promosRes, settingsRes] = await Promise.all([
        fetch('/api/promocodes'),
        fetch('/api/settings?keys=loyalty'),
      ]);

      const promosData = await promosRes.json();
      setPromocodes(Array.isArray(promosData) ? promosData : []);

      const settingsData = await settingsRes.json();
      if (settingsData.loyalty) {
        const parsed = JSON.parse(settingsData.loyalty);
        setLoyaltySettings(parsed);
        setLoyaltyForm(parsed);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setPromocodes([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtered promos with counts
  const filteredPromos = useMemo(() => {
    return promocodes.filter((promo) => {
      const status = getPromoStatus(promo);
      if (activeFilter === 'all') return true;
      if (activeFilter === 'active') return status === 'active' || status === 'upcoming';
      if (activeFilter === 'expired') return status === 'expired';
      return true;
    });
  }, [promocodes, activeFilter]);

  const filterCounts = useMemo(() => {
    const counts = { all: promocodes.length, active: 0, expired: 0 };
    promocodes.forEach((promo) => {
      const status = getPromoStatus(promo);
      if (status === 'active' || status === 'upcoming') counts.active++;
      else counts.expired++;
    });
    return counts;
  }, [promocodes]);

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast({ title: `Код ${code} скопирован` });
    } catch {
      toast({ title: 'Не удалось скопировать', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!promoForm.code || !promoForm.discountValue) {
      toast({ title: 'Заполните обязательные поля', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: promoForm.code.toUpperCase(),
        discountType: promoForm.discountType,
        discountValue: parseFloat(promoForm.discountValue),
        minOrder: promoForm.minOrder ? parseFloat(promoForm.minOrder) : null,
        maxDiscount: promoForm.maxDiscount ? parseFloat(promoForm.maxDiscount) : null,
        usageLimit: promoForm.usageLimit ? parseInt(promoForm.usageLimit) : null,
        startsAt: promoForm.startsAt || null,
        expiresAt: promoForm.expiresAt || null,
        isActive: promoForm.isActive,
      };

      if (editingPromo) {
        const res = await fetch(`/api/promocodes/${editingPromo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast({ title: 'Промокод обновлен' });
          handleDialogClose(false);
          fetchData();
        } else {
          const data = await res.json();
          toast({ title: data.error || 'Ошибка обновления', variant: 'destructive' });
        }
      } else {
        const res = await fetch('/api/promocodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast({ title: 'Промокод создан' });
          handleDialogClose(false);
          fetchData();
        } else {
          const data = await res.json();
          toast({ title: data.error || 'Ошибка создания', variant: 'destructive' });
        }
      }
    } catch (error) {
      console.error('Error saving promocode:', error);
      toast({ title: 'Ошибка сохранения', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (promo: Promocode) => {
    setPromoToDelete(promo);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!promoToDelete) return;

    try {
      const res = await fetch(`/api/promocodes/${promoToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({ title: 'Промокод удален' });
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting promocode:', error);
      toast({ title: 'Ошибка удаления', variant: 'destructive' });
    } finally {
      setDeleteConfirmOpen(false);
      setPromoToDelete(null);
    }
  };

  const handleTogglePromo = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/promocodes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });

      if (res.ok) {
        toast({ title: isActive ? 'Промокод включен' : 'Промокод выключен' });
        fetchData();
      }
    } catch (error) {
      console.error('Error toggling promocode:', error);
    }
  };

  const handleSaveLoyalty = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'loyalty',
          value: JSON.stringify(loyaltyForm),
        }),
      });

      if (res.ok) {
        toast({ title: 'Настройки лояльности сохранены' });
        setLoyaltySettings(loyaltyForm);
        setIsLoyaltyFormOpen(false);
      } else {
        toast({ title: 'Ошибка сохранения', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error saving loyalty settings:', error);
      toast({ title: 'Ошибка сохранения', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const startEditPromo = (promo: Promocode) => {
    setEditingPromo(promo);
    setPromoForm({
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue.toString(),
      minOrder: promo.minOrder?.toString() || '',
      maxDiscount: promo.maxDiscount?.toString() || '',
      usageLimit: promo.usageLimit?.toString() || '',
      startsAt: promo.startsAt?.split('T')[0] || '',
      expiresAt: promo.expiresAt?.split('T')[0] || '',
      isActive: promo.isActive,
    });
    setIsCreating(false);
    setEditDialogOpen(true);
  };

  const startCreate = () => {
    setIsCreating(true);
    setEditingPromo(null);
    setPromoForm(defaultPromoForm);
    setEditDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setEditDialogOpen(false);
      setEditingPromo(null);
      setIsCreating(false);
      setPromoForm(defaultPromoForm);
    }
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
              <h1 className="text-xl font-bold">Промокоды и лояльность</h1>
              <p className="text-sm text-muted-foreground">
                Управление скидками и бонусами
              </p>
            </div>
          </div>
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <div className="p-3 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Loyalty Settings */}
              <Collapsible open={isLoyaltyFormOpen} onOpenChange={setIsLoyaltyFormOpen}>
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left">
                        <div className="p-2 rounded-xl bg-primary/10">
                          <Gift className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">Программа лояльности</p>
                          <p className="text-sm text-muted-foreground">
                            {loyaltySettings.pointsPerRub} балл/руб &bull; Макс. оплата: {loyaltySettings.maxPointsPayment}%
                          </p>
                        </div>
                        {isLoyaltyFormOpen ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Separator />
                      <div className="p-3 space-y-3">
                        {/* Базовые настройки */}
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Начисление и оплата</Label>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Баллов за 1 руб.</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={loyaltyForm.pointsPerRub}
                                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, pointsPerRub: parseFloat(e.target.value) || 0 })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">1 балл = (руб.)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={loyaltyForm.pointsToRub}
                                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, pointsToRub: parseFloat(e.target.value) || 0 })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Макс. оплата баллами (%)</Label>
                              <Input
                                type="number"
                                value={loyaltyForm.maxPointsPayment}
                                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, maxPointsPayment: parseInt(e.target.value) || 0 })}
                              />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Бонусы */}
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Бонусы</Label>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Приветственные</Label>
                              <Input
                                type="number"
                                value={loyaltyForm.welcomeBonus}
                                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, welcomeBonus: parseInt(e.target.value) || 0 })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">За приглашение</Label>
                              <Input
                                type="number"
                                value={loyaltyForm.referralBonus}
                                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, referralBonus: parseInt(e.target.value) || 0 })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">На день рождения</Label>
                              <Input
                                type="number"
                                value={loyaltyForm.birthdayBonus}
                                onChange={(e) => setLoyaltyForm({ ...loyaltyForm, birthdayBonus: parseInt(e.target.value) || 0 })}
                              />
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {/* Уровни лояльности */}
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-sm font-semibold">
                            <Star className="h-4 w-4" />
                            Уровни лояльности (порог в руб. &times; множитель)
                          </Label>
                          <div className="grid grid-cols-4 gap-3">
                            <div className="p-3 rounded-xl bg-amber-900/20 border border-amber-800/30">
                              <p className="text-xs text-amber-600 mb-2 font-medium">Бронза</p>
                              <div className="space-y-2">
                                <Input
                                  type="number"
                                  placeholder="Порог"
                                  value={loyaltyForm.bronzeThreshold}
                                  onChange={(e) => setLoyaltyForm({ ...loyaltyForm, bronzeThreshold: parseInt(e.target.value) || 0 })}
                                  className="h-7 text-sm"
                                />
                                <Input
                                  type="number"
                                  step="0.1"
                                  placeholder="&times;1"
                                  value={loyaltyForm.bronzeMultiplier}
                                  onChange={(e) => setLoyaltyForm({ ...loyaltyForm, bronzeMultiplier: parseFloat(e.target.value) || 1 })}
                                  className="h-7 text-sm"
                                />
                              </div>
                            </div>
                            <div className="p-3 rounded-xl bg-gray-400/20 dark:bg-gray-600/20 border border-gray-400/30 dark:border-gray-600/30">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Серебро</p>
                              <div className="space-y-2">
                                <Input
                                  type="number"
                                  placeholder="Порог"
                                  value={loyaltyForm.silverThreshold}
                                  onChange={(e) => setLoyaltyForm({ ...loyaltyForm, silverThreshold: parseInt(e.target.value) || 0 })}
                                  className="h-7 text-sm"
                                />
                                <Input
                                  type="number"
                                  step="0.1"
                                  placeholder="&times;1.5"
                                  value={loyaltyForm.silverMultiplier}
                                  onChange={(e) => setLoyaltyForm({ ...loyaltyForm, silverMultiplier: parseFloat(e.target.value) || 1 })}
                                  className="h-7 text-sm"
                                />
                              </div>
                            </div>
                            <div className="p-3 rounded-xl bg-yellow-500/20 border border-yellow-500/30">
                              <p className="text-xs text-yellow-600 mb-2 font-medium">Золото</p>
                              <div className="space-y-2">
                                <Input
                                  type="number"
                                  placeholder="Порог"
                                  value={loyaltyForm.goldThreshold}
                                  onChange={(e) => setLoyaltyForm({ ...loyaltyForm, goldThreshold: parseInt(e.target.value) || 0 })}
                                  className="h-7 text-sm"
                                />
                                <Input
                                  type="number"
                                  step="0.1"
                                  placeholder="&times;2"
                                  value={loyaltyForm.goldMultiplier}
                                  onChange={(e) => setLoyaltyForm({ ...loyaltyForm, goldMultiplier: parseFloat(e.target.value) || 1 })}
                                  className="h-7 text-sm"
                                />
                              </div>
                            </div>
                            <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-500/30">
                              <p className="text-xs text-purple-400 mb-2 font-medium">Платина</p>
                              <div className="space-y-2">
                                <Input
                                  type="number"
                                  placeholder="Порог"
                                  value={loyaltyForm.platinumThreshold}
                                  onChange={(e) => setLoyaltyForm({ ...loyaltyForm, platinumThreshold: parseInt(e.target.value) || 0 })}
                                  className="h-7 text-sm"
                                />
                                <Input
                                  type="number"
                                  step="0.1"
                                  placeholder="&times;3"
                                  value={loyaltyForm.platinumMultiplier}
                                  onChange={(e) => setLoyaltyForm({ ...loyaltyForm, platinumMultiplier: parseFloat(e.target.value) || 1 })}
                                  className="h-7 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Множитель увеличивает количество баллов, начисляемых за покупки
                          </p>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <Button onClick={handleSaveLoyalty} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Сохранить
                          </Button>
                          <Button variant="outline" onClick={() => { setIsLoyaltyFormOpen(false); setLoyaltyForm(loyaltySettings); }}>
                            Отмена
                          </Button>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </Collapsible>

              {/* Filter Tabs */}
              <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as PromoFilter)}>
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="flex-1">
                    Все
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 min-w-[18px] flex items-center justify-center">
                      {filterCounts.all}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="active" className="flex-1">
                    Активные
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 min-w-[18px] flex items-center justify-center">
                      {filterCounts.active}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="expired" className="flex-1">
                    Истёкшие
                    <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4 min-w-[18px] flex items-center justify-center">
                      {filterCounts.expired}
                    </Badge>
                  </TabsTrigger>
                </TabsList>

                {/* Content for all tabs */}
                {(['all', 'active', 'expired'] as PromoFilter[]).map((filter) => (
                  <TabsContent key={filter} value={filter}>
                    {filteredPromos.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                      >
                        <Card>
                          <CardContent className="py-12 text-center">
                            <Percent className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground mb-2">
                              {filter === 'all' && 'Промокодов пока нет'}
                              {filter === 'active' && 'Нет активных промокодов'}
                              {filter === 'expired' && 'Нет истёкших промокодов'}
                            </p>
                            {filter === 'all' && (
                              <Button className="mt-4" onClick={startCreate}>
                                <Plus className="h-4 w-4 mr-2" />
                                Создать промокод
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    ) : (
                      <div className="space-y-3">
                        <AnimatePresence mode="popLayout">
                          {filteredPromos.map((promo, index) => {
                            const status = getPromoStatus(promo);
                            return (
                              <motion.div
                                key={promo.id}
                                layout
                                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: index * 0.05 }}
                              >
                                <Card className={cn('overflow-hidden', status === 'expired' && 'opacity-60')}>
                                  <CardContent className="p-4">
                                    {/* Code row */}
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono font-bold text-lg tracking-wider truncate">
                                          {promo.code}
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 shrink-0"
                                          onClick={() => handleCopyCode(promo.code)}
                                        >
                                          {copiedCode === promo.code ? (
                                            <Check className="h-3.5 w-3.5 text-green-500" />
                                          ) : (
                                            <Copy className="h-3.5 w-3.5" />
                                          )}
                                        </Button>
                                      </div>
                                      <StatusBadge status={status} />
                                    </div>

                                    {/* Details row */}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground mb-3">
                                      <span className="flex items-center gap-1.5">
                                        {promo.discountType === 'percentage' ? (
                                          <Percent className="h-3.5 w-3.5" />
                                        ) : (
                                          <span className="text-xs font-medium">Фикс</span>
                                        )}
                                        <span className="font-medium text-foreground">
                                          {promo.discountType === 'percentage'
                                            ? `${promo.discountValue}%`
                                            : `${promo.discountValue}₽`}
                                        </span>
                                      </span>

                                      {promo.minOrder && (
                                        <span>От {promo.minOrder}₽</span>
                                      )}

                                      <span className="flex items-center gap-1">
                                        <Tag className="h-3 w-3" />
                                        {promo.usageCount}{promo.usageLimit ? `/${promo.usageLimit}` : ''} исп.
                                      </span>

                                      {promo.expiresAt && (
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          до {new Date(promo.expiresAt).toLocaleDateString('ru-RU')}
                                        </span>
                                      )}
                                    </div>

                                    {/* Actions row */}
                                    <div className="flex items-center justify-between pt-2 border-t">
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          checked={promo.isActive}
                                          onCheckedChange={(checked) => handleTogglePromo(promo.id, checked)}
                                        />
                                        <span className="text-xs text-muted-foreground">
                                          {promo.isActive ? 'Вкл' : 'Выкл'}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7"
                                          onClick={() => startEditPromo(promo)}
                                        >
                                          <Edit className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={() => handleDeleteClick(promo)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? 'Новый промокод' : 'Редактирование промокода'}
            </DialogTitle>
            <DialogDescription>
              {isCreating
                ? 'Заполните данные для создания нового промокода'
                : `Редактирование ${editingPromo?.code}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Код *</Label>
                <Input
                  value={promoForm.code}
                  onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })}
                  placeholder="SALE2024"
                />
              </div>
              <div className="space-y-2">
                <Label>Тип скидки</Label>
                <Select value={promoForm.discountType} onValueChange={(v) => setPromoForm({ ...promoForm, discountType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Процент (%)</SelectItem>
                    <SelectItem value="fixed">Фиксированная (₽)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Размер скидки *</Label>
                <Input
                  type="number"
                  value={promoForm.discountValue}
                  onChange={(e) => setPromoForm({ ...promoForm, discountValue: e.target.value })}
                  placeholder={promoForm.discountType === 'percentage' ? '10' : '500'}
                />
              </div>
              <div className="space-y-2">
                <Label>Мин. сумма заказа</Label>
                <Input
                  type="number"
                  value={promoForm.minOrder}
                  onChange={(e) => setPromoForm({ ...promoForm, minOrder: e.target.value })}
                  placeholder="1000"
                />
              </div>
              <div className="space-y-2">
                <Label>Макс. скидка (₽)</Label>
                <Input
                  type="number"
                  value={promoForm.maxDiscount}
                  onChange={(e) => setPromoForm({ ...promoForm, maxDiscount: e.target.value })}
                  placeholder="5000"
                />
              </div>
              <div className="space-y-2">
                <Label>Лимит использований</Label>
                <Input
                  type="number"
                  value={promoForm.usageLimit}
                  onChange={(e) => setPromoForm({ ...promoForm, usageLimit: e.target.value })}
                  placeholder="Без ограничений"
                />
              </div>
              <div className="space-y-2">
                <Label>Начало действия</Label>
                <Input
                  type="date"
                  value={promoForm.startsAt}
                  onChange={(e) => setPromoForm({ ...promoForm, startsAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Окончание действия</Label>
                <Input
                  type="date"
                  value={promoForm.expiresAt}
                  onChange={(e) => setPromoForm({ ...promoForm, expiresAt: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch
                checked={promoForm.isActive}
                onCheckedChange={(checked) => setPromoForm({ ...promoForm, isActive: checked })}
              />
              <Label className="cursor-pointer">
                {promoForm.isActive ? 'Активен' : 'Неактивен'}
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogClose(false)}>
              <X className="h-4 w-4 mr-2" />
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving || !promoForm.code || !promoForm.discountValue}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить промокод?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить промокод &laquo;{promoToDelete?.code}&raquo;? Это действие нельзя отменить.
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
    </div>
  );
}
