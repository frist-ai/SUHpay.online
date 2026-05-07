'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  CreditCard,
  Banknote,
  Wallet,
  Star,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Settings,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Send,
} from 'lucide-react';
import { useShopStore } from '@/stores/shop-store';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  PaymentSettings,
  defaultPaymentSettings,
  cardProviders,
  cryptoNetworks,
  sbpBanks,
} from '@/lib/payment-config';
import { motion, AnimatePresence } from 'framer-motion';

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

// ── Color config per method ────────────────────────────

const methodColors = {
  card: {
    border: 'border-l-rose-500',
    bg: 'bg-rose-500/10',
    icon: 'text-rose-500',
    title: 'text-rose-700 dark:text-rose-400',
  },
  cash: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-500/10',
    icon: 'text-emerald-500',
    title: 'text-emerald-700 dark:text-emerald-400',
  },
  crypto: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/10',
    icon: 'text-amber-500',
    title: 'text-amber-700 dark:text-amber-400',
  },
  stars: {
    border: 'border-l-yellow-500',
    bg: 'bg-yellow-500/10',
    icon: 'text-yellow-500',
    title: 'text-yellow-700 dark:text-yellow-400',
  },
  sbp: {
    border: 'border-l-sky-500',
    bg: 'bg-sky-500/10',
    icon: 'text-sky-500',
    title: 'text-sky-700 dark:text-sky-400',
  },
  cardTransfer: {
    border: 'border-l-pink-500',
    bg: 'bg-pink-500/10',
    icon: 'text-pink-500',
    title: 'text-pink-700 dark:text-pink-400',
  },
} as const;

// ── Component ──────────────────────────────────────────

export function PaymentManager() {
  const { setCurrentView } = useShopStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PaymentSettings>(defaultPaymentSettings);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Expandable sections
  const [cardExpanded, setCardExpanded] = useState(false);
  const [cashExpanded, setCashExpanded] = useState(false);
  const [cryptoExpanded, setCryptoExpanded] = useState(false);
  const [starsExpanded, setStarsExpanded] = useState(false);
  const [sbpExpanded, setSbpExpanded] = useState(false);
  const [cardTransferExpanded, setCardTransferExpanded] = useState(false);

  // ── Load settings ──────────────────────────────────

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/payment-settings');
        const data = await res.json();
        // Deep merge with defaults to preserve enabled states when API returns partial data
        setSettings({
          ...defaultPaymentSettings,
          ...data,
          card: { ...defaultPaymentSettings.card, ...data.card },
          sbp: { ...defaultPaymentSettings.sbp, ...data.sbp },
          crypto: { ...defaultPaymentSettings.crypto, ...data.crypto },
          stars: { ...defaultPaymentSettings.stars, ...data.stars },
          cash: { ...defaultPaymentSettings.cash, ...data.cash },
          cardTransfer: { ...defaultPaymentSettings.cardTransfer, ...data.cardTransfer },
        });
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  // ── Save ───────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/payment-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        toast({
          title: 'Настройки сохранены',
          description: 'Платёжные методы обновлены',
        });
      } else {
        throw new Error(data.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Error saving payment settings:', error);
      toast({
        variant: 'destructive',
        title: 'Ошибка сохранения',
        description: error instanceof Error ? error.message : 'Попробуйте ещё раз',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Update helpers ─────────────────────────────────

  const updateCardSetting = (key: keyof PaymentSettings['card'], value: unknown) => {
    setSettings(prev => ({ ...prev, card: { ...prev.card, [key]: value } }));
  };

  const updateCashSetting = (key: keyof PaymentSettings['cash'], value: unknown) => {
    setSettings(prev => ({ ...prev, cash: { ...prev.cash, [key]: value } }));
  };

  const updateCryptoSetting = (key: keyof PaymentSettings['crypto'], value: unknown) => {
    setSettings(prev => ({ ...prev, crypto: { ...prev.crypto, [key]: value } }));
  };

  const updateStarsSetting = (key: keyof PaymentSettings['stars'], value: unknown) => {
    setSettings(prev => ({ ...prev, stars: { ...prev.stars, [key]: value } }));
  };

  const updateSbpSetting = (key: keyof PaymentSettings['sbp'], value: unknown) => {
    setSettings(prev => ({ ...prev, sbp: { ...prev.sbp, [key]: value } }));
  };

  const updateCardTransferSetting = (key: keyof PaymentSettings['cardTransfer'], value: unknown) => {
    setSettings(prev => ({ ...prev, cardTransfer: { ...prev.cardTransfer, [key]: value } }));
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
              <h1 className="text-lg font-bold">Способы оплаты</h1>
              <p className="text-xs text-muted-foreground">Настройка платёжных методов</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-2xl mx-auto">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl border border-l-4 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-xl" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
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
              <h1 className="text-lg font-bold">Способы оплаты</h1>
              <p className="text-xs text-muted-foreground">Настройка платёжных методов</p>
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

          {/* ═══════════════ CARD PAYMENT ═══════════════ */}
          <motion.div custom={0} variants={cardVariants} initial="hidden" animate="visible">
            <Card className={`overflow-hidden border-l-4 ${methodColors.card.border}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer select-none"
                    onClick={() => setCardExpanded(!cardExpanded)}
                  >
                    <div className={`h-11 w-11 rounded-xl ${methodColors.card.bg} flex items-center justify-center`}>
                      <CreditCard className={`h-6 w-6 ${methodColors.card.icon}`} />
                    </div>
                    <div>
                      <CardTitle className={`text-lg ${methodColors.card.title}`}>
                        Банковская карта
                      </CardTitle>
                      <CardDescription>Безопасная оплата картой Visa, Mastercard, Мир</CardDescription>
                    </div>
                    {cardExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
                  </div>
                  <Switch
                    checked={settings.card.enabled}
                    onCheckedChange={(v) => updateCardSetting('enabled', v)}
                  />
                </div>
              </CardHeader>

              <AnimatePresence initial={false}>
                {cardExpanded && (
                  <motion.div
                    key="card-content"
                    variants={expandVariants}
                    initial="collapsed"
                    animate="expanded"
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                  >
                    <Separator />
                    <CardContent className="p-5 space-y-4">
                      <div className="space-y-2">
                        <Label>Провайдер</Label>
                        <Select
                          value={settings.card.provider || ''}
                          onValueChange={(v) => updateCardSetting('provider', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите провайдера" />
                          </SelectTrigger>
                          <SelectContent>
                            {cardProviders.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                <div>
                                  <span className="font-medium">{p.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {p.description}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Shop ID</Label>
                        <Input
                          value={settings.card.shopId || ''}
                          onChange={(e) => updateCardSetting('shopId', e.target.value)}
                          placeholder="Идентификатор магазина"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Secret Key</Label>
                        <div className="relative">
                          <Input
                            type={showSecrets.cardSecret ? 'text' : 'password'}
                            value={settings.card.secretKey || ''}
                            onChange={(e) => updateCardSetting('secretKey', e.target.value)}
                            placeholder="Секретный ключ"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => setShowSecrets(prev => ({ ...prev, cardSecret: !prev.cardSecret }))}
                          >
                            {showSecrets.cardSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Комиссия (%)</Label>
                          <p className="text-xs text-muted-foreground">Покрывает продавец</p>
                        </div>
                        <Input
                          type="number"
                          className="w-20"
                          value={settings.card.commission}
                          onChange={(e) => updateCardSetting('commission', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Тестовый режим</Label>
                          <p className="text-xs text-muted-foreground">Для разработки</p>
                        </div>
                        <Switch
                          checked={settings.card.testMode}
                          onCheckedChange={(v) => updateCardSetting('testMode', v)}
                        />
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* ═══════════════ CASH PAYMENT ═══════════════ */}
          <motion.div custom={1} variants={cardVariants} initial="hidden" animate="visible">
            <Card className={`overflow-hidden border-l-4 ${methodColors.cash.border}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer select-none"
                    onClick={() => setCashExpanded(!cashExpanded)}
                  >
                    <div className={`h-11 w-11 rounded-xl ${methodColors.cash.bg} flex items-center justify-center`}>
                      <Banknote className={`h-6 w-6 ${methodColors.cash.icon}`} />
                    </div>
                    <div>
                      <CardTitle className={`text-lg ${methodColors.cash.title}`}>
                        Оплата при встрече
                      </CardTitle>
                      <CardDescription>Наличными или картой при получении</CardDescription>
                    </div>
                    {cashExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
                  </div>
                  <Switch
                    checked={settings.cash.enabled}
                    onCheckedChange={(v) => updateCashSetting('enabled', v)}
                  />
                </div>
              </CardHeader>

              <AnimatePresence initial={false}>
                {cashExpanded && (
                  <motion.div
                    key="cash-content"
                    variants={expandVariants}
                    initial="collapsed"
                    animate="expanded"
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                  >
                    <Separator />
                    <CardContent className="p-5 space-y-4">
                      <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 p-4 border border-emerald-200/50 dark:border-emerald-800/30">
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                          Оплата наличными или картой при получении заказа
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Инструкция для покупателя</Label>
                        <Input
                          value={settings.cash.instructions || ''}
                          onChange={(e) => updateCashSetting('instructions', e.target.value)}
                          placeholder="Подготовьте точную сумму..."
                        />
                        <p className="text-xs text-muted-foreground">
                          Покажется покупателю при выборе этого способа
                        </p>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* ═══════════════ CRYPTO PAYMENT ═══════════════ */}
          <motion.div custom={2} variants={cardVariants} initial="hidden" animate="visible">
            <Card className={`overflow-hidden border-l-4 ${methodColors.crypto.border}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer select-none"
                    onClick={() => setCryptoExpanded(!cryptoExpanded)}
                  >
                    <div className={`h-11 w-11 rounded-xl ${methodColors.crypto.bg} flex items-center justify-center`}>
                      <Wallet className={`h-6 w-6 ${methodColors.crypto.icon}`} />
                    </div>
                    <div>
                      <CardTitle className={`text-lg ${methodColors.crypto.title}`}>
                        Криптовалюта
                      </CardTitle>
                      <CardDescription>USDT TRC-20, ERC-20, BSC</CardDescription>
                    </div>
                    {cryptoExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
                  </div>
                  <Switch
                    checked={settings.crypto.enabled}
                    onCheckedChange={(v) => updateCryptoSetting('enabled', v)}
                  />
                </div>
              </CardHeader>

              <AnimatePresence initial={false}>
                {cryptoExpanded && (
                  <motion.div
                    key="crypto-content"
                    variants={expandVariants}
                    initial="collapsed"
                    animate="expanded"
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                  >
                    <Separator />
                    <CardContent className="p-5 space-y-4">
                      <div className="space-y-2">
                        <Label>Сеть</Label>
                        <Select
                          value={settings.crypto.network || ''}
                          onValueChange={(v) => updateCryptoSetting('network', v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите сеть" />
                          </SelectTrigger>
                          <SelectContent>
                            {cryptoNetworks.map(n => (
                              <SelectItem key={n.id} value={n.id}>
                                <div>
                                  <span className="font-medium">{n.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {n.description}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>USDT кошелёк</Label>
                        <Input
                          value={settings.crypto.walletAddress || ''}
                          onChange={(e) => updateCryptoSetting('walletAddress', e.target.value)}
                          placeholder="TRX7Kf..."
                          className="font-mono"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Курс USDT</Label>
                        <Select
                          value={settings.crypto.rateType || 'auto'}
                          onValueChange={(v) => updateCryptoSetting('rateType', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Автоматический</SelectItem>
                            <SelectItem value="fixed">Фиксированный</SelectItem>
                          </SelectContent>
                        </Select>
                        <AnimatePresence>
                          {settings.crypto.rateType === 'fixed' && (
                            <motion.div
                              key="fixed-rate"
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                              className="flex items-center gap-2 mt-2"
                            >
                              <Input
                                type="number"
                                className="flex-1"
                                value={settings.crypto.fixedRate || ''}
                                onChange={(e) => updateCryptoSetting('fixedRate', parseFloat(e.target.value))}
                                placeholder="95"
                              />
                              <span className="text-sm text-muted-foreground">₽ за 1 USDT</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Комиссия сети</Label>
                          <p className="text-xs text-muted-foreground">Добавляется к сумме</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            className="w-20"
                            value={settings.crypto.networkFee}
                            onChange={(e) => updateCryptoSetting('networkFee', parseFloat(e.target.value) || 0)}
                          />
                          <span className="text-sm">₽</span>
                        </div>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* ═══════════════ TELEGRAM STARS ═══════════════ */}
          <motion.div custom={3} variants={cardVariants} initial="hidden" animate="visible">
            <Card className={`overflow-hidden border-l-4 ${methodColors.stars.border}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer select-none"
                    onClick={() => setStarsExpanded(!starsExpanded)}
                  >
                    <div className={`h-11 w-11 rounded-xl ${methodColors.stars.bg} flex items-center justify-center`}>
                      <Star className={`h-6 w-6 ${methodColors.stars.icon}`} />
                    </div>
                    <div>
                      <CardTitle className={`text-lg ${methodColors.stars.title}`}>
                        Telegram Stars
                      </CardTitle>
                      <CardDescription>Оплата звёздами Telegram (цифровые товары)</CardDescription>
                    </div>
                    {starsExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
                  </div>
                  <Switch
                    checked={settings.stars.enabled}
                    onCheckedChange={(v) => updateStarsSetting('enabled', v)}
                  />
                </div>
              </CardHeader>

              <AnimatePresence initial={false}>
                {starsExpanded && (
                  <motion.div
                    key="stars-content"
                    variants={expandVariants}
                    initial="collapsed"
                    animate="expanded"
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                  >
                    <Separator />
                    <CardContent className="p-5 space-y-4">
                      <div className="rounded-xl bg-yellow-50 dark:bg-yellow-950/20 p-4 border border-yellow-200/50 dark:border-yellow-800/30">
                        <p className="text-sm text-yellow-700 dark:text-yellow-400">
                          Только для цифровых товаров и услуг (ограничение Telegram)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Bot Token</Label>
                        <div className="relative">
                          <Input
                            type={showSecrets.starsToken ? 'text' : 'password'}
                            value={settings.stars.botToken || ''}
                            onChange={(e) => updateStarsSetting('botToken', e.target.value)}
                            placeholder="123456:ABC-DEF..."
                            className="pr-10 font-mono"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => setShowSecrets(prev => ({ ...prev, starsToken: !prev.starsToken }))}
                          >
                            {showSecrets.starsToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Курс звёзды/рубль</Label>
                          <p className="text-xs text-muted-foreground">Стоимость 1 звезды в рублях</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            className="w-20"
                            value={settings.stars.rate}
                            onChange={(e) => updateStarsSetting('rate', parseFloat(e.target.value) || 0.5)}
                          />
                          <span className="text-sm">₽</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Только цифровые товары</Label>
                          <p className="text-xs text-muted-foreground">Ограничение Telegram</p>
                        </div>
                        <Switch
                          checked={settings.stars.digitalOnly}
                          onCheckedChange={(v) => updateStarsSetting('digitalOnly', v)}
                        />
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* ═══════════════ SBP PAYMENT ═══════════════ */}
          <motion.div custom={4} variants={cardVariants} initial="hidden" animate="visible">
            <Card className={`overflow-hidden border-l-4 ${methodColors.sbp.border}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer select-none"
                    onClick={() => setSbpExpanded(!sbpExpanded)}
                  >
                    <div className={`h-11 w-11 rounded-xl ${methodColors.sbp.bg} flex items-center justify-center`}>
                      <Smartphone className={`h-6 w-6 ${methodColors.sbp.icon}`} />
                    </div>
                    <div>
                      <CardTitle className={`text-lg ${methodColors.sbp.title}`}>
                        СБП
                      </CardTitle>
                      <CardDescription>Моментальный перевод по номеру телефона</CardDescription>
                    </div>
                    {sbpExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
                  </div>
                  <Switch
                    checked={settings.sbp.enabled}
                    onCheckedChange={(v) => updateSbpSetting('enabled', v)}
                  />
                </div>
              </CardHeader>

              <AnimatePresence initial={false}>
                {sbpExpanded && (
                  <motion.div
                    key="sbp-content"
                    variants={expandVariants}
                    initial="collapsed"
                    animate="expanded"
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                  >
                    <Separator />
                    <CardContent className="p-5 space-y-4">
                      <div className="rounded-xl bg-sky-50 dark:bg-sky-950/20 p-4 border border-sky-200/50 dark:border-sky-800/30">
                        <p className="text-sm text-sky-700 dark:text-sky-300">
                          Перевод через Систему Быстрых Платежей по номеру телефона
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Номер телефона</Label>
                        <Input
                          value={settings.sbp.phone || ''}
                          onChange={(e) => updateSbpSetting('phone', e.target.value)}
                          placeholder="+7 (999) 123-45-67"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Банк</Label>
                        <Select
                          value={settings.sbp.bankId || ''}
                          onValueChange={(v) => {
                            const bank = sbpBanks.find(b => b.bankId === v);
                            updateSbpSetting('bankId', v);
                            if (bank) updateSbpSetting('bankName', bank.name);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите банк" />
                          </SelectTrigger>
                          <SelectContent>
                            {sbpBanks.map(b => (
                              <SelectItem key={b.bankId} value={b.bankId}>
                                <span className="font-medium">{b.name}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Автоматическая квитанция</Label>
                          <p className="text-xs text-muted-foreground">Для самозанятых</p>
                        </div>
                        <Switch
                          checked={settings.sbp.autoReceipt}
                          onCheckedChange={(v) => updateSbpSetting('autoReceipt', v)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Самозанятый</Label>
                          <p className="text-xs text-muted-foreground">Режим самозанятого</p>
                        </div>
                        <Switch
                          checked={settings.sbp.selfEmployed}
                          onCheckedChange={(v) => updateSbpSetting('selfEmployed', v)}
                        />
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* ═══════════════ CARD TRANSFER PAYMENT ═══════════════ */}
          <motion.div custom={5} variants={cardVariants} initial="hidden" animate="visible">
            <Card className={`overflow-hidden border-l-4 ${methodColors.cardTransfer.border}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 cursor-pointer select-none"
                    onClick={() => setCardTransferExpanded(!cardTransferExpanded)}
                  >
                    <div className={`h-11 w-11 rounded-xl ${methodColors.cardTransfer.bg} flex items-center justify-center`}>
                      <Send className={`h-6 w-6 ${methodColors.cardTransfer.icon}`} />
                    </div>
                    <div>
                      <CardTitle className={`text-lg ${methodColors.cardTransfer.title}`}>
                        Перевод на карту
                      </CardTitle>
                      <CardDescription>Перевод на банковскую карту</CardDescription>
                    </div>
                    {cardTransferExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
                  </div>
                  <Switch
                    checked={settings.cardTransfer.enabled}
                    onCheckedChange={(v) => updateCardTransferSetting('enabled', v)}
                  />
                </div>
              </CardHeader>

              <AnimatePresence initial={false}>
                {cardTransferExpanded && (
                  <motion.div
                    key="cardTransfer-content"
                    variants={expandVariants}
                    initial="collapsed"
                    animate="expanded"
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                  >
                    <Separator />
                    <CardContent className="p-5 space-y-4">
                      <div className="rounded-xl bg-pink-50 dark:bg-pink-950/20 p-4 border border-pink-200/50 dark:border-pink-800/30">
                        <p className="text-sm text-pink-700 dark:text-pink-300">
                          Покупатель переводит деньги на вашу банковскую карту
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Номер карты</Label>
                        <Input
                          value={settings.cardTransfer.cardNumber || ''}
                          onChange={(e) => updateCardTransferSetting('cardNumber', e.target.value)}
                          placeholder="2200 0000 0000 0000"
                          className="font-mono"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Имя держателя</Label>
                        <Input
                          value={settings.cardTransfer.holderName || ''}
                          onChange={(e) => updateCardTransferSetting('holderName', e.target.value)}
                          placeholder="Иван И."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Банк</Label>
                        <Input
                          value={settings.cardTransfer.bankName || ''}
                          onChange={(e) => updateCardTransferSetting('bankName', e.target.value)}
                          placeholder="Т-Банк"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Телефон для перевода</Label>
                        <Input
                          value={settings.cardTransfer.phone || ''}
                          onChange={(e) => updateCardTransferSetting('phone', e.target.value)}
                          placeholder="+7 (999) 123-45-67"
                        />
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* ═══════════════ INFO CARD ═══════════════ */}
          <motion.div custom={6} variants={cardVariants} initial="hidden" animate="visible">
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Settings className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Подсказка:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Включите нужные способы оплаты переключателем</li>
                      <li>Разверните карточку метода для настройки</li>
                      <li>Заполните все обязательные поля</li>
                      <li>Для крипты нужен USDT кошелёк</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </div>
      </div>
    </div>
  );
}
