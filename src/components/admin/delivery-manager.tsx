'use client';

import { useState, useEffect, useCallback } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Truck,
  Plus,
  Trash2,
  MapPin,
  ChevronLeft,
  Loader2,
  Clock,
  Gift,
  Info,
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';

// ── Types ──────────────────────────────────────────────

interface DeliveryZoneSetting {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
}

interface CourierSettings {
  enabled: boolean;
  basePrice: number;
  freeDeliveryEnabled: boolean;
  freeFrom: number;
  minHours: number;
  maxHours: number;
  description: string;
  zones: DeliveryZoneSetting[];
}

interface PickupSettings {
  enabled: boolean;
  address: string;
  city: string;
  phone: string;
  workHoursOpen: string;
  workHoursClose: string;
  instructions: string;
  description: string;
}

interface DeliverySlotSetting {
  id: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface DeliverySettingsData {
  courier: CourierSettings;
  pickup: PickupSettings;
  deliverySlots: DeliverySlotSetting[];
}

// ── Defaults ───────────────────────────────────────────

const defaultSettings: DeliverySettingsData = {
  courier: {
    enabled: true,
    basePrice: 300,
    freeDeliveryEnabled: true,
    freeFrom: 3000,
    minHours: 1,
    maxHours: 3,
    description: 'Доставка курьером до двери',
    zones: [],
  },
  pickup: {
    enabled: true,
    address: '',
    city: '',
    phone: '',
    workHoursOpen: '09:00',
    workHoursClose: '21:00',
    instructions: '',
    description: 'Самовывоз из нашего магазина',
  },
  deliverySlots: [],
};

// ── Animation variants ─────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
      delay: i * 0.1,
    },
  }),
};

const expandVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: 'auto', opacity: 1 },
};

// ── Component ──────────────────────────────────────────

export function DeliveryManager() {
  const { setCurrentView } = useShopStore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettingsData>(defaultSettings);

  // Expandable sections
  const [courierExpanded, setCourierExpanded] = useState(true);
  const [pickupExpanded, setPickupExpanded] = useState(true);

  // ── Fetch settings ─────────────────────────────────

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings?keys=delivery_settings');
      const data = await response.json();

      if (data.delivery_settings) {
        const parsed = JSON.parse(data.delivery_settings);
        setDeliverySettings({
          courier: { ...defaultSettings.courier, ...parsed.courier },
          pickup: {
            ...defaultSettings.pickup,
            ...parsed.pickup,
            workHoursOpen: parsed.pickup?.workHoursOpen || defaultSettings.pickup.workHoursOpen,
            workHoursClose: parsed.pickup?.workHoursClose || defaultSettings.pickup.workHoursClose,
            instructions: parsed.pickup?.instructions || '',
          },
          deliverySlots: parsed.deliverySlots || [],
        });
      }
    } catch (error) {
      console.error('Error fetching delivery settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ── Save settings ──────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'delivery_settings',
          value: JSON.stringify(deliverySettings),
          type: 'json',
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      toast({
        title: 'Сохранено',
        description: 'Настройки доставки успешно сохранены',
      });
    } catch (error) {
      console.error('Error saving delivery settings:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить настройки',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Settings helpers ───────────────────────────────

  const updateSettings = <K extends keyof DeliverySettingsData>(
    section: K,
    field: keyof DeliverySettingsData[K],
    value: DeliverySettingsData[K][keyof DeliverySettingsData[K]]
  ) => {
    setDeliverySettings(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const addDeliveryZone = () => {
    const newZone: DeliveryZoneSetting = { id: Date.now().toString(), name: '', price: 0, isActive: true };
    setDeliverySettings(prev => ({
      ...prev,
      courier: { ...prev.courier, zones: [...prev.courier.zones, newZone] },
    }));
  };

  const updateDeliveryZone = (index: number, field: keyof DeliveryZoneSetting, value: string | number | boolean) => {
    setDeliverySettings(prev => {
      const updated = [...prev.courier.zones];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, courier: { ...prev.courier, zones: updated } };
    });
  };

  const removeDeliveryZone = (index: number) => {
    setDeliverySettings(prev => ({
      ...prev,
      courier: { ...prev.courier, zones: prev.courier.zones.filter((_, i) => i !== index) },
    }));
  };

  const addSlot = () => {
    const newSlot: DeliverySlotSetting = { id: Date.now().toString(), startTime: '10:00', endTime: '12:00', isActive: true };
    setDeliverySettings(prev => ({ ...prev, deliverySlots: [...prev.deliverySlots, newSlot] }));
  };

  const updateSlot = (index: number, field: keyof DeliverySlotSetting, value: string | boolean) => {
    setDeliverySettings(prev => {
      const updated = [...prev.deliverySlots];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, deliverySlots: updated };
    });
  };

  const removeSlot = (index: number) => {
    setDeliverySettings(prev => ({
      ...prev,
      deliverySlots: prev.deliverySlots.filter((_, i) => i !== index),
    }));
  };

  // ── Loading ────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setCurrentView('admin')}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Доставка</h1>
              <p className="text-xs text-muted-foreground">Настройка способов доставки</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl mx-auto">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-4 w-56" />
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full max-w-[200px]" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setCurrentView('admin')}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Доставка</h1>
              <p className="text-xs text-muted-foreground">Настройка способов доставки</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="shadow-sm">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Сохранить
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <div className="p-4 space-y-3 max-w-2xl mx-auto">

          {/* ═══════════════ COURIER DELIVERY CARD ═══════════════ */}
          <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
            <Card className="overflow-hidden border-l-4 border-l-orange-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer select-none"
                    onClick={() => setCourierExpanded(!courierExpanded)}
                  >
                    <div className="h-11 w-11 rounded-xl bg-orange-500/10 flex items-center justify-center">
                      <Truck className="h-6 w-6 text-orange-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-orange-700 dark:text-orange-400">
                        Курьерская доставка
                      </CardTitle>
                      <CardDescription>Настройки курьерской доставки до двери</CardDescription>
                    </div>
                    {courierExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
                  </div>
                  <Switch
                    checked={deliverySettings.courier.enabled}
                    onCheckedChange={(checked) => updateSettings('courier', 'enabled', checked)}
                  />
                </div>
              </CardHeader>

              <AnimatePresence initial={false}>
                {courierExpanded && (
                  <motion.div
                    key="courier-content"
                    variants={expandVariants}
                    initial="collapsed"
                    animate="expanded"
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                  >
                    <Separator />
                    <CardContent className="p-5 space-y-3">
                      {/* Delivery Cost */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Стоимость доставки (₽)</Label>
                        <Input
                          type="number"
                          value={deliverySettings.courier.basePrice}
                          onChange={(e) => updateSettings('courier', 'basePrice', parseFloat(e.target.value) || 0)}
                          placeholder="300"
                          className="max-w-[200px]"
                        />
                        <p className="text-xs text-muted-foreground">Базовая стоимость доставки курьером</p>
                      </div>

                      {/* Free Delivery Toggle */}
                      <div className="rounded-xl bg-orange-50 dark:bg-orange-950/20 p-4 space-y-3 border border-orange-200/50 dark:border-orange-800/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Gift className="h-4 w-4 text-orange-500" />
                            <Label className="text-sm font-medium">Бесплатная доставка</Label>
                          </div>
                          <Switch
                            checked={deliverySettings.courier.freeDeliveryEnabled}
                            onCheckedChange={(checked) => updateSettings('courier', 'freeDeliveryEnabled', checked)}
                          />
                        </div>
                        <AnimatePresence>
                          {deliverySettings.courier.freeDeliveryEnabled && (
                            <motion.div
                              key="free-delivery-amount"
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                              className="space-y-2"
                            >
                              <Label className="text-xs text-muted-foreground">Минимальная сумма заказа (₽)</Label>
                              <Input
                                type="number"
                                value={deliverySettings.courier.freeFrom}
                                onChange={(e) => updateSettings('courier', 'freeFrom', parseFloat(e.target.value) || 0)}
                                placeholder="3000"
                                className="max-w-[200px]"
                              />
                              <div className="flex items-start gap-2 mt-1">
                                <Info className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-orange-700 dark:text-orange-300">
                                  При заказе от {deliverySettings.courier.freeFrom.toLocaleString()} ₽ доставка будет бесплатной
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Estimated Delivery Time */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          Время доставки (часы)
                        </Label>
                        <div className="flex items-center gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Мин.</Label>
                            <Input
                              type="number"
                              value={deliverySettings.courier.minHours}
                              onChange={(e) => updateSettings('courier', 'minHours', parseInt(e.target.value) || 1)}
                              className="w-24"
                              min={1}
                            />
                          </div>
                          <span className="text-muted-foreground mt-5">—</span>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Макс.</Label>
                            <Input
                              type="number"
                              value={deliverySettings.courier.maxHours}
                              onChange={(e) => updateSettings('courier', 'maxHours', parseInt(e.target.value) || 3)}
                              className="w-24"
                              min={1}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Ориентировочное время доставки</p>
                      </div>

                      {/* Delivery Zones */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            Зоны доставки
                          </Label>
                          <Button variant="outline" size="sm" onClick={addDeliveryZone}>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Добавить зону
                          </Button>
                        </div>
                        {deliverySettings.courier.zones.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-3 text-center">
                            Зоны не добавлены. Без зон доставка рассчитывается по базовой стоимости.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {deliverySettings.courier.zones.map((zone, index) => (
                              <div key={zone.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                                <Switch
                                  checked={zone.isActive}
                                  onCheckedChange={(checked) => updateDeliveryZone(index, 'isActive', checked)}
                                />
                                <Input
                                  value={zone.name}
                                  onChange={(e) => updateDeliveryZone(index, 'name', e.target.value)}
                                  placeholder="Название зоны"
                                  className="flex-1 h-8 text-sm"
                                />
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    value={zone.price}
                                    onChange={(e) => updateDeliveryZone(index, 'price', parseFloat(e.target.value) || 0)}
                                    className="w-20 h-8 text-sm"
                                    placeholder="₽"
                                  />
                                  <span className="text-xs text-muted-foreground">₽</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                                  onClick={() => removeDeliveryZone(index)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Описание</Label>
                        <Textarea
                          value={deliverySettings.courier.description}
                          onChange={(e) => updateSettings('courier', 'description', e.target.value)}
                          placeholder="Доставка курьером до двери"
                          rows={2}
                        />
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* ═══════════════ PICKUP CARD ═══════════════ */}
          <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible">
            <Card className="overflow-hidden border-l-4 border-l-emerald-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer select-none"
                    onClick={() => setPickupExpanded(!pickupExpanded)}
                  >
                    <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <MapPin className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-emerald-700 dark:text-emerald-400">
                        Самовывоз
                      </CardTitle>
                      <CardDescription>Настройки самовывоза из магазина</CardDescription>
                    </div>
                    {pickupExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
                  </div>
                  <Switch
                    checked={deliverySettings.pickup.enabled}
                    onCheckedChange={(checked) => updateSettings('pickup', 'enabled', checked)}
                  />
                </div>
              </CardHeader>

              <AnimatePresence initial={false}>
                {pickupExpanded && (
                  <motion.div
                    key="pickup-content"
                    variants={expandVariants}
                    initial="collapsed"
                    animate="expanded"
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                  >
                    <Separator />
                    <CardContent className="p-5 space-y-3">
                      {/* Address */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Адрес самовывоза</Label>
                        <Input
                          value={deliverySettings.pickup.address}
                          onChange={(e) => updateSettings('pickup', 'address', e.target.value)}
                          placeholder="ул. Примерная, д. 1, оф. 2"
                        />
                      </div>

                      {/* City + Phone */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Город</Label>
                          <Input
                            value={deliverySettings.pickup.city}
                            onChange={(e) => updateSettings('pickup', 'city', e.target.value)}
                            placeholder="Москва"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Телефон</Label>
                          <Input
                            value={deliverySettings.pickup.phone}
                            onChange={(e) => updateSettings('pickup', 'phone', e.target.value)}
                            placeholder="+7 (999) 123-45-67"
                          />
                        </div>
                      </div>

                      {/* Working Hours */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          Время работы
                        </Label>
                        <div className="flex items-center gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Открытие</Label>
                            <Input
                              type="time"
                              value={deliverySettings.pickup.workHoursOpen}
                              onChange={(e) => updateSettings('pickup', 'workHoursOpen', e.target.value)}
                              className="w-32"
                            />
                          </div>
                          <span className="text-muted-foreground mt-5">—</span>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Закрытие</Label>
                            <Input
                              type="time"
                              value={deliverySettings.pickup.workHoursClose}
                              onChange={(e) => updateSettings('pickup', 'workHoursClose', e.target.value)}
                              className="w-32"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Pickup Instructions */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Инструкция для самовывоза</Label>
                        <Textarea
                          value={deliverySettings.pickup.instructions}
                          onChange={(e) => updateSettings('pickup', 'instructions', e.target.value)}
                          placeholder="Подъезд со стороны двора, 2 этаж, код домофона 12К..."
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">Покажется покупателю при выборе самовывоза</p>
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Описание</Label>
                        <Textarea
                          value={deliverySettings.pickup.description}
                          onChange={(e) => updateSettings('pickup', 'description', e.target.value)}
                          placeholder="Самовывоз из нашего магазина"
                          rows={2}
                        />
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* ═══════════════ TIME SLOTS CARD ═══════════════ */}
          <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible">
            <Card className="overflow-hidden border-l-4 border-l-violet-500">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-violet-500/10 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-violet-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-violet-700 dark:text-violet-400">
                      Временные слоты
                    </CardTitle>
                    <CardDescription>Промежутки, в которые доступна доставка</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="bg-violet-50 dark:bg-violet-950/20 rounded-xl p-4 border border-violet-200/50 dark:border-violet-800/30">
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-violet-700 dark:text-violet-300">
                      При выборе курьерской доставки покупатель увидит только установленные здесь слоты.
                      Без слотов выбор времени не отображается.
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {deliverySettings.deliverySlots.map((slot, index) => (
                    <div key={slot.id} className="flex items-center gap-2">
                      <Switch
                        checked={slot.isActive}
                        onCheckedChange={(checked) => updateSlot(index, 'isActive', checked)}
                      />
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateSlot(index, 'startTime', e.target.value)}
                        className="w-32"
                      />
                      <span className="text-muted-foreground text-sm">—</span>
                      <Input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateSlot(index, 'endTime', e.target.value)}
                        className="w-32"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => removeSlot(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {deliverySettings.deliverySlots.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">Слоты не добавлены</p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={addSlot}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Добавить слот
                </Button>
              </CardContent>
            </Card>
          </motion.div>



        </div>
      </div>
    </div>
  );
}
