'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
  ChevronLeft,
  Shield,
  User,
  Database,
  Bot,
  Users,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Settings2,
  Info,
  Copy,
  Smartphone,
  Globe,
  Search,
  Activity,
  Clock,
  Cpu,
  HardDrive,
  Server,
  RefreshCw,
  Download,
  Trash,
  Pencil,
  Store,
  Phone,
  MessageSquare,
  Truck,
  CreditCard,
  ExternalLink,
  Code2,
  Layers,
  GitBranch,
  FileText,
  Heart,
  ShoppingCart,
  Zap,
  Package,
  EyeOff,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { BotManager } from './bot-manager';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SystemConfig {
  status: 'ok' | 'error';
  version?: string;
  config: {
    database: { configured: boolean; type: string };
    telegramBot: { configured: boolean };
    admin: { configured: boolean; count: number };
    devMode: boolean;
  };
  errors?: string[];
}

interface StaffMember {
  id: string;
  telegramId: string;
  role: string;
  name: string | null;
  isActive: boolean;
}

interface AppSettings {
  storeName: string;
  storeDescription: string;
  deliveryFee: string;
  freeDeliveryMin: string;
  contactPhone: string;
  supportTelegram: string;
}

type SettingsTab = 'account' | 'system' | 'staff' | 'app' | 'bot' | 'about';

const DEFAULT_APP_SETTINGS: AppSettings = {
  storeName: 'СУХ[pay]',
  storeDescription: 'Доставка продуктов',
  deliveryFee: '150',
  freeDeliveryMin: '1000',
  contactPhone: '',
  supportTelegram: 'Suhpaybot',
};

const SETTINGS_STORAGE_KEY = 'suhpay_app_settings';

// ─── Helper ─────────────────────────────────────────────────────────────────

function loadAppSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_APP_SETTINGS;
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return DEFAULT_APP_SETTINGS;
}

function saveAppSettingsToStorage(settings: AppSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function SettingsView() {
  const { setCurrentView, user, isAdmin } = useShopStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  // Staff management state
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [addStaffDialogOpen, setAddStaffDialogOpen] = useState(false);
  const [newStaffTelegramId, setNewStaffTelegramId] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('collector');
  const [addStaffSaving, setAddStaffSaving] = useState(false);
  const [deleteStaffConfirmOpen, setDeleteStaffConfirmOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);

  // Enhanced staff state
  const [staffSearch, setStaffSearch] = useState('');
  const [editStaffDialogOpen, setEditStaffDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffRole, setEditStaffRole] = useState('collector');
  const [editStaffActive, setEditStaffActive] = useState(true);
  const [editStaffSaving, setEditStaffSaving] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeactivateConfirmOpen, setBulkDeactivateConfirmOpen] = useState(false);

  // App settings state
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [savingSetting, setSavingSetting] = useState<string | null>(null);

  // System health state
  const [healthChecks, setHealthChecks] = useState({
    db: 'checking' as 'ok' | 'error' | 'checking',
    bot: 'checking' as 'ok' | 'error' | 'checking',
    admin: 'checking' as 'ok' | 'error' | 'checking',
  });

  // Uptime tracking
  const [uptimeStart] = useState(() => Date.now());

  // Fetch config on mount
  useEffect(() => {
    setConfigLoading(true);
    fetch('/api/config')
      .then(res => res.json())
      .then((data: SystemConfig) => {
        setConfig(data);
        setHealthChecks({
          db: data.config.database.configured ? 'ok' : 'error',
          bot: data.config.telegramBot.configured ? 'ok' : 'error',
          admin: data.config.admin.configured ? 'ok' : 'error',
        });
      })
      .catch(() => {
        setHealthChecks({ db: 'error', bot: 'error', admin: 'error' });
      })
      .finally(() => setConfigLoading(false));

    setAppSettings(loadAppSettings());
  }, []);

  // Fetch staff when admin
  useEffect(() => {
    if (isAdmin) {
      fetchStaff();
    }
  }, [isAdmin]);

  const handleBack = useCallback(() => setCurrentView('admin'), [setCurrentView]);

  const fetchStaff = async () => {
    setStaffLoading(true);
    try {
      const res = await fetch('/api/staff');
      const data = await res.json();
      setStaff(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!newStaffTelegramId.trim()) {
      toast({ title: 'Ошибка', description: 'Укажите Telegram ID', variant: 'destructive' });
      return;
    }

    setAddStaffSaving(true);
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: newStaffTelegramId.trim(),
          name: newStaffName.trim() || null,
          role: newStaffRole,
        }),
      });

      if (res.ok) {
        toast({ title: 'Сотрудник добавлен' });
        setAddStaffDialogOpen(false);
        setNewStaffTelegramId('');
        setNewStaffName('');
        setNewStaffRole('collector');
        await fetchStaff();
      } else {
        const data = await res.json();
        toast({ title: 'Ошибка', description: data.error || 'Не удалось добавить', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error adding staff:', error);
      toast({ title: 'Ошибка', description: 'Не удалось добавить сотрудника', variant: 'destructive' });
    } finally {
      setAddStaffSaving(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;

    try {
      const res = await fetch(`/api/staff?id=${staffToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Сотрудник удалён' });
        await fetchStaff();
      }
    } catch (error) {
      console.error('Error deleting staff:', error);
      toast({ title: 'Ошибка', description: 'Не удалось удалить', variant: 'destructive' });
    } finally {
      setDeleteStaffConfirmOpen(false);
      setStaffToDelete(null);
    }
  };

  const handleEditStaff = (member: StaffMember) => {
    setEditingStaff(member);
    setEditStaffName(member.name || '');
    setEditStaffRole(member.role);
    setEditStaffActive(member.isActive);
    setEditStaffDialogOpen(true);
  };

  const handleSaveEditStaff = async () => {
    if (!editingStaff) return;
    setEditStaffSaving(true);
    try {
      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingStaff.id,
          name: editStaffName.trim() || null,
          role: editStaffRole,
          isActive: editStaffActive,
        }),
      });
      if (res.ok) {
        toast({ title: 'Сотрудник обновлён' });
        setEditStaffDialogOpen(false);
        setEditingStaff(null);
        await fetchStaff();
      } else {
        const data = await res.json();
        toast({ title: 'Ошибка', description: data.error || 'Не удалось обновить', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось обновить сотрудника', variant: 'destructive' });
    } finally {
      setEditStaffSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    let success = 0;
    for (const id of selectedStaffIds) {
      try {
        const res = await fetch(`/api/staff?id=${id}`, { method: 'DELETE' });
        if (res.ok) success++;
      } catch { /* skip */ }
    }
    toast({ title: `Удалено: ${success} из ${selectedStaffIds.size}` });
    setSelectedStaffIds(new Set());
    setBulkDeleteConfirmOpen(false);
    await fetchStaff();
  };

  const handleBulkDeactivate = async () => {
    let success = 0;
    for (const id of selectedStaffIds) {
      const member = staff.find(s => s.id === id);
      if (member && member.isActive) {
        try {
          const res = await fetch('/api/staff', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, isActive: false }),
          });
          if (res.ok) success++;
        } catch { /* skip */ }
      }
    }
    toast({ title: `Деактивировано: ${success}` });
    setSelectedStaffIds(new Set());
    setBulkDeactivateConfirmOpen(false);
    await fetchStaff();
  };

  const handleSaveAppSetting = async (key: keyof AppSettings, value: string) => {
    setSavingSetting(key);
    const updated = { ...appSettings, [key]: value };
    setAppSettings(updated);
    await new Promise(r => setTimeout(r, 400));
    saveAppSettingsToStorage(updated);
    setSavingSetting(null);
    toast({ title: 'Настройка сохранена' });
  };

  const handleRefreshConfig = useCallback(() => {
    setConfigLoading(true);
    setHealthChecks({ db: 'checking', bot: 'checking', admin: 'checking' });
    fetch('/api/config')
      .then(res => res.json())
      .then((data: SystemConfig) => {
        setConfig(data);
        setHealthChecks({
          db: data.config.database.configured ? 'ok' : 'error',
          bot: data.config.telegramBot.configured ? 'ok' : 'error',
          admin: data.config.admin.configured ? 'ok' : 'error',
        });
        toast({ title: 'Конфиг обновлён' });
      })
      .catch(() => {
        setHealthChecks({ db: 'error', bot: 'error', admin: 'error' });
        toast({ title: 'Ошибка загрузки конфига', variant: 'destructive' });
      })
      .finally(() => setConfigLoading(false));
  }, [toast]);

  const handleClearCache = useCallback(() => {
    if (typeof window === 'undefined') return;
    const keysToKeep = [SETTINGS_STORAGE_KEY];
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !keysToKeep.includes(key) && key.startsWith('suhpay')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    toast({ title: 'Кэш очищен', description: `Удалено ${keysToRemove.length} записей` });
  }, [toast]);

  const handleExportData = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      appSettings,
      staffCount: staff.length,
      configStatus: config?.status,
      version: config?.version,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suhpay-settings-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Данные экспортированы' });
  }, [appSettings, staff.length, config, toast]);

  // Filtered staff
  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return staff;
    const q = staffSearch.toLowerCase();
    return staff.filter(m =>
      (m.name || '').toLowerCase().includes(q) ||
      m.role.toLowerCase().includes(q) ||
      m.telegramId.includes(q)
    );
  }, [staff, staffSearch]);

  // Staff stats
  const staffStats = useMemo(() => ({
    total: staff.length,
    active: staff.filter(m => m.isActive).length,
    admins: staff.filter(m => m.role === 'admin').length,
    collectors: staff.filter(m => m.role === 'collector').length,
  }), [staff]);

  // Tab configuration with icons
  const tabs: { id: SettingsTab; label: string; icon: typeof User; adminOnly?: boolean }[] = [
    { id: 'account', label: 'Аккаунт', icon: User },
    { id: 'system', label: 'Система', icon: Activity, adminOnly: true },
    { id: 'staff', label: 'Персонал', icon: Users, adminOnly: true },
    { id: 'app', label: 'Приложение', icon: Store, adminOnly: true },
    { id: 'bot', label: 'Бот', icon: Bot, adminOnly: true },
    { id: 'about', label: 'О приложении', icon: Info },
  ];

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center gap-3 p-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-bold">Настройки</h1>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 px-4 pb-3 overflow-x-auto">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {isActive && (
                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-14">

        {/* ─── Quick Actions (System tab only) ─── */}
        {isAdmin && activeTab === 'system' && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleRefreshConfig}
              disabled={configLoading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', configLoading && 'animate-spin')} />
              Обновить конфиг
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleClearCache}
            >
              <Trash className="h-3.5 w-3.5" />
              Очистить кэш
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleExportData}
            >
              <Download className="h-3.5 w-3.5" />
              Экспорт данных
            </Button>
          </div>
        )}

        {/* ═══════════════════ Account Tab ═══════════════════ */}
        {activeTab === 'account' && (
          <>
            {/* Profile Card with Avatar */}
            <Card className="overflow-hidden">
              <div className="h-20 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
              <CardContent className="pt-0 -mt-10">
                <div className="flex items-end gap-4">
                  <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                    {user?.photoUrl ? (
                      <AvatarImage src={user.photoUrl} alt={user.firstName || 'User'} />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                      {user?.firstName?.charAt(0) || user?.username?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 pb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold">{user?.firstName || 'Пользователь'}</h3>
                      {isAdmin && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
                          <Shield className="h-3 w-3" />
                          Админ
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      @{user?.username || 'без username'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <InfoTile label="Telegram ID" value={user?.telegramId || '—'} mono />
                  <InfoTile
                    label="Роль"
                    value={isAdmin ? 'Администратор' : 'Пользователь'}
                    valueClass={isAdmin ? 'text-green-600 dark:text-green-400' : undefined}
                  />
                  <InfoTile label="Бонусы" value={`${user?.loyaltyPoints || 0} ₽`} />
                  <InfoTile label="Заказов" value={String(user?.ordersCount || 0)} />
                </div>
              </CardContent>
            </Card>

            {/* Activity Log */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Активность аккаунта
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ActivityItem
                  icon={ShoppingCart}
                  label="Всего заказов"
                  value={String(user?.ordersCount || 0)}
                  color="text-blue-500"
                />
                <ActivityItem
                  icon={CreditCard}
                  label="Всего потрачено"
                  value={`${((user?.totalSpent || 0) / 100).toFixed(0)} ₽`}
                  color="text-green-500"
                />
                <ActivityItem
                  icon={Clock}
                  label="Последний визит"
                  value={user?.lastVisitAt
                    ? new Date(user.lastVisitAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : '—'}
                  color="text-amber-500"
                />
                <ActivityItem
                  icon={User}
                  label="Дата регистрации"
                  value={user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
                    : '—'}
                  color="text-purple-500"
                />
              </CardContent>
            </Card>

            {/* Referral Card */}
            {user?.referralCode && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Реферальная программа</CardTitle>
                  <CardDescription className="text-xs">
                    Поделитесь кодом с друзьями
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-3 bg-muted rounded-lg font-mono text-center">
                      {user.referralCode}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(user.referralCode || '');
                        toast({ title: 'Скопировано!' });
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Links */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Быстрые действия
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <QuickLinkButton
                    icon={ShoppingCart}
                    label="Заказы"
                    onClick={() => setCurrentView('orders')}
                  />
                  <QuickLinkButton
                    icon={Heart}
                    label="Избранное"
                    onClick={() => setCurrentView('favorites')}
                  />
                  <QuickLinkButton
                    icon={Package}
                    label="Каталог"
                    onClick={() => setCurrentView('catalog')}
                  />
                  {isAdmin && (
                    <QuickLinkButton
                      icon={Layers}
                      label="Аналитика"
                      onClick={() => setCurrentView('admin')}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══════════════════ System Tab ═══════════════════ */}
        {activeTab === 'system' && isAdmin && (
          <>
            {configLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : config && (
              <>
                {/* System Health Dashboard */}
                <Card className="overflow-hidden">
                  <div className={cn(
                    'h-1.5',
                    config.status === 'ok'
                      ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                      : 'bg-gradient-to-r from-red-400 to-destructive'
                  )} />
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Мониторинг системы
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3">
                      <HealthCheckCard
                        icon={Database}
                        label="База данных"
                        value={config.config.database.configured ? config.config.database.type.toUpperCase() : 'Нет'}
                        status={healthChecks.db}
                      />
                      <HealthCheckCard
                        icon={Bot}
                        label="Telegram Бот"
                        value={config.config.telegramBot.configured ? 'Активен' : 'Нет'}
                        status={healthChecks.bot}
                      />
                      <HealthCheckCard
                        icon={Shield}
                        label="Админ доступ"
                        value={`${config.config.admin.count} адм.`}
                        status={healthChecks.admin}
                      />
                    </div>

                    {config.errors && config.errors.length > 0 && (
                      <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                        <p className="font-medium mb-1">Ошибки:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {config.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Uptime & Deploy */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      Статус сервера
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs font-medium text-green-700 dark:text-green-400">Сервер работает</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Сессия: {formatUptime(uptimeStart)}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 border">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium">Последний деплой</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Environment Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                      Окружение
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <EnvRow label="Версия приложения" value={config.version || '—'} mono />
                    <Separator />
                    <EnvRow label="Node.js" value="v20+" mono />
                    <Separator />
                    <EnvRow label="Next.js" value="16" mono />
                    <Separator />
                    <EnvRow label="Режим разработки" value={config.config.devMode ? 'Да' : 'Нет'} badge={config.config.devMode ? 'default' : 'secondary'} />
                    <Separator />
                    <EnvRow label="База данных" value={config.config.database.type.toUpperCase()} mono />
                    <Separator />
                    <EnvRow label="Регион" value="Russia" />
                  </CardContent>
                </Card>

                {/* Memory & Resources */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                      Ресурсы
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ResourceBar label="Подключение к БД" status={healthChecks.db} />
                    <ResourceBar label="Telegram API" status={healthChecks.bot} />
                    <ResourceBar label="Панель администратора" status={healthChecks.admin} />
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* ═══════════════════ Staff Tab ═══════════════════ */}
        {activeTab === 'staff' && isAdmin && (
          <>
            {/* Staff Stats */}
            <div className="grid grid-cols-4 gap-2">
              <StaffStatCard label="Всего" value={staffStats.total} icon={Users} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-900/10" />
              <StaffStatCard label="Активных" value={staffStats.active} icon={CheckCircle2} color="text-green-500" bg="bg-green-50 dark:bg-green-900/10" />
              <StaffStatCard label="Админов" value={staffStats.admins} icon={Shield} color="text-purple-500" bg="bg-purple-50 dark:bg-purple-900/10" />
              <StaffStatCard label="Сборщиков" value={staffStats.collectors} icon={Package} color="text-orange-500" bg="bg-orange-50 dark:bg-orange-900/10" />
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Управление персоналом
                  </CardTitle>
                  <Button size="sm" onClick={() => setAddStaffDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Добавить
                  </Button>
                </div>

                {/* Search */}
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по имени, роли, ID..."
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    className="pl-9 pr-8"
                  />
                  {staffSearch && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => setStaffSearch('')}
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Bulk Actions Bar */}
                {selectedStaffIds.size > 0 && (
                  <div className="flex items-center gap-2 p-2 mb-3 rounded-lg bg-primary/5 border border-primary/20 max-w-full overflow-hidden flex-wrap">
                    <span className="text-sm font-medium">Выбрано: {selectedStaffIds.size}</span>
                    <div className="flex-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setBulkDeactivateConfirmOpen(true)}
                    >
                      <EyeOff className="h-3 w-3 mr-1" />
                      Деактивировать
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setBulkDeleteConfirmOpen(true)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Удалить
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setSelectedStaffIds(new Set())}
                    >
                      Сбросить
                    </Button>
                  </div>
                )}

                {staffLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">
                      {staffSearch ? 'Ничего не найдено' : 'Нет добавленных сотрудников'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {staffSearch ? 'Попробуйте другой запрос' : 'Добавьте сотрудников для управления заказами'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredStaff.map((member) => (
                      <div
                        key={member.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border bg-card transition-all duration-200',
                          'hover:bg-accent/50 hover:shadow-sm',
                          selectedStaffIds.has(member.id) && 'ring-2 ring-primary/30 bg-primary/5'
                        )}
                      >
                        <Checkbox
                          checked={selectedStaffIds.has(member.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedStaffIds);
                            if (checked) next.add(member.id);
                            else next.delete(member.id);
                            setSelectedStaffIds(next);
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn('font-medium', !member.isActive && 'text-muted-foreground line-through')}>
                              {member.name || 'Без имени'}
                            </span>
                            <Badge
                              variant="secondary"
                              className={cn(
                                member.role === 'admin'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              )}
                            >
                              {member.role === 'admin' ? 'Админ' : 'Сборщик'}
                            </Badge>
                            {!member.isActive && (
                              <Badge variant="outline" className="text-muted-foreground">
                                Неактивен
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            ID: {member.telegramId}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditStaff(member)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setStaffToDelete(member);
                              setDeleteStaffConfirmOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══════════════════ App Settings Tab ═══════════════════ */}
        {activeTab === 'app' && isAdmin && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Store className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Настройки приложения</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Управление параметрами вашего магазина
            </p>

            <AppSettingCard
              icon={Store}
              label="Название магазина"
              description="Отображается в каталоге и уведомлениях"
              value={appSettings.storeName}
              saving={savingSetting === 'storeName'}
              onSave={(v) => handleSaveAppSetting('storeName', v)}
              placeholder="СУХ[pay]"
            />

            <AppSettingCard
              icon={FileText}
              label="Описание магазина"
              description="Краткое описание для клиентов"
              value={appSettings.storeDescription}
              saving={savingSetting === 'storeDescription'}
              onSave={(v) => handleSaveAppSetting('storeDescription', v)}
              placeholder="Доставка продуктов"
              multiline
            />

            <AppSettingCard
              icon={Truck}
              label="Стоимость доставки"
              description="Базовая стоимость доставки (₽)"
              value={appSettings.deliveryFee}
              saving={savingSetting === 'deliveryFee'}
              onSave={(v) => handleSaveAppSetting('deliveryFee', v)}
              placeholder="150"
              type="number"
            />

            <AppSettingCard
              icon={ShoppingCart}
              label="Минимум для бесплатной доставки"
              description="Сумма заказа (₽), при которой доставка бесплатна"
              value={appSettings.freeDeliveryMin}
              saving={savingSetting === 'freeDeliveryMin'}
              onSave={(v) => handleSaveAppSetting('freeDeliveryMin', v)}
              placeholder="1000"
              type="number"
            />

            <AppSettingCard
              icon={Phone}
              label="Контактный телефон"
              description="Телефон для связи с магазином"
              value={appSettings.contactPhone}
              saving={savingSetting === 'contactPhone'}
              onSave={(v) => handleSaveAppSetting('contactPhone', v)}
              placeholder="+7 (999) 123-45-67"
            />

            <AppSettingCard
              icon={MessageSquare}
              label="Telegram поддержки"
              description="Username бота или группы поддержки"
              value={appSettings.supportTelegram}
              saving={savingSetting === 'supportTelegram'}
              onSave={(v) => handleSaveAppSetting('supportTelegram', v)}
              placeholder="Suhpaybot"
            />
          </>
        )}

        {/* ═══════════════════ Bot Tab ═══════════════════ */}
        {activeTab === 'bot' && isAdmin && (
          <BotManager embedded />
        )}

        {/* ═══════════════════ About Tab ═══════════════════ */}
        {activeTab === 'about' && (
          <>
            {/* App Info Card */}
            <Card className="overflow-hidden">
              <div className="h-24 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center shadow-lg">
                  <span className="text-3xl">🏪</span>
                </div>
              </div>
              <CardContent className="pt-4 text-center">
                <h2 className="text-xl font-bold">СУХ[pay]</h2>
                <p className="text-sm text-muted-foreground mt-1">Доставка продуктов</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Версия {config?.version || '—'}
                </p>
              </CardContent>
            </Card>

            {/* Changelog */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-green-500" />
                  Последние обновления
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ChangelogItem version="2.0" date="Мар 2025" changes={[
                  'Обновлённая админ-панель',
                  'Аналитика с трендами и тепловыми картами',
                  'Управление категориями с массовыми операциями',
                  'Мониторинг системы и здоровье сервера',
                ]} />
                <ChangelogItem version="1.5" date="Фев 2025" changes={[
                  'Тёмная тема',
                  'Улучшенный профиль пользователя',
                  'Быстрые действия в корзине',
                ]} />
                <ChangelogItem version="1.0" date="Янв 2025" changes={[
                  'Первый релиз СУХ[pay]',
                  'Каталог товаров и корзина',
                  'Интеграция с Telegram',
                ]} />
              </CardContent>
            </Card>

            {/* Tech Stack */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-blue-500" />
                  Технологии
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <TechStackItem icon={Globe} name="Next.js 16" desc="React 19 + App Router" color="text-black dark:text-white" />
                <TechStackItem icon={Code2} name="TypeScript 5" desc="Строгая типизация" color="text-blue-500" />
                <TechStackItem icon={Layers} name="Tailwind CSS 4" desc="Utility-first стили" color="text-cyan-500" />
                <TechStackItem icon={Smartphone} name="Telegram Mini App" desc="Платформа запуска" color="text-sky-500" />
                <TechStackItem icon={Database} name="Prisma ORM" desc={`${config?.config?.database?.type?.toUpperCase() || 'SQLite'} база данных`} color="text-purple-500" />
                <TechStackItem icon={Bot} name="Telegram Bot API" desc="Уведомления и бот" color="text-emerald-500" />
              </CardContent>
            </Card>

            {/* Support & Links */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Поддержка и ссылки</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="https://t.me/Suhpaybot" target="_blank" rel="noopener noreferrer">
                    <Bot className="h-4 w-4 mr-2" />
                    Telegram поддержка
                    <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="https://github.com/frist-ai/SUHpay.online" target="_blank" rel="noopener noreferrer">
                    <GitBranch className="h-4 w-4 mr-2" />
                    GitHub репозиторий
                    <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* License */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Лицензия
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  СУХ[pay] — проект с закрытым исходным кодом.
                  Все права защищены &copy; {new Date().getFullYear()}.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Сделано с <Heart className="h-3 w-3 inline text-red-500" /> в России
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ─── Add Staff Dialog ─── */}
      <Dialog open={addStaffDialogOpen} onOpenChange={setAddStaffDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Добавить сотрудника</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="staffTelegramId">Telegram ID *</Label>
              <Input
                id="staffTelegramId"
                value={newStaffTelegramId}
                onChange={(e) => setNewStaffTelegramId(e.target.value)}
                placeholder="123456789"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Числовой ID пользователя в Telegram
              </p>
            </div>
            <div>
              <Label htmlFor="staffName">Имя (опционально)</Label>
              <Input
                id="staffName"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="Иван Иванов"
              />
            </div>
            <div>
              <Label>Роль</Label>
              <Select value={newStaffRole} onValueChange={setNewStaffRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Админ</SelectItem>
                  <SelectItem value="collector">Сборщик</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddStaffDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleAddStaff} disabled={addStaffSaving}>
              {addStaffSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
              ) : (
                'Добавить'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Staff Dialog ─── */}
      <Dialog open={editStaffDialogOpen} onOpenChange={setEditStaffDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Редактировать сотрудника</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editStaffName">Имя</Label>
              <Input
                id="editStaffName"
                value={editStaffName}
                onChange={(e) => setEditStaffName(e.target.value)}
                placeholder="Имя сотрудника"
              />
            </div>
            <div>
              <Label>Роль</Label>
              <Select value={editStaffRole} onValueChange={setEditStaffRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Админ</SelectItem>
                  <SelectItem value="collector">Сборщик</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="editStaffActive">Активен</Label>
              <Switch
                id="editStaffActive"
                checked={editStaffActive}
                onCheckedChange={setEditStaffActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStaffDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveEditStaff} disabled={editStaffSaving}>
              {editStaffSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
              ) : (
                'Сохранить'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Staff Confirmation ─── */}
      <AlertDialog open={deleteStaffConfirmOpen} onOpenChange={setDeleteStaffConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить сотрудника?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить {staffToDelete?.name || 'сотрудника'}?
              <br />
              <span className="font-mono text-xs">Telegram ID: {staffToDelete?.telegramId}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStaff}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Bulk Delete Confirmation ─── */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить выбранных сотрудников?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить {selectedStaffIds.size} сотрудников? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить все
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Bulk Deactivate Confirmation ─── */}
      <AlertDialog open={bulkDeactivateConfirmOpen} onOpenChange={setBulkDeactivateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Деактивировать выбранных?</AlertDialogTitle>
            <AlertDialogDescription>
              Деактивировать {selectedStaffIds.size} сотрудников? Они потеряют доступ к панели управления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeactivate}>
              Деактивировать
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function InfoTile({ label, value, mono, valueClass }: {
  label: string; value: string; mono?: boolean; valueClass?: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-muted/50">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-medium', mono && 'font-mono text-sm', valueClass)}>{value}</p>
    </div>
  );
}

function ActivityItem({ icon: Icon, label, value, color }: {
  icon: typeof Clock; label: string; value: string; color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn('p-2 rounded-lg', color.replace('text-', 'bg-').replace('500', '500/10'))}>
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium text-sm">{value}</p>
      </div>
    </div>
  );
}

function QuickLinkButton({ icon: Icon, label, onClick }: {
  icon: typeof ShoppingCart; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border bg-card hover:bg-accent/50 hover:shadow-sm transition-all duration-200 active:scale-[0.97]"
    >
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function HealthCheckCard({ icon: Icon, label, value, status }: {
  icon: typeof Database; label: string; value: string; status: 'ok' | 'error' | 'checking';
}) {
  return (
    <div className={cn(
      'p-3 rounded-xl text-center border transition-all duration-300',
      status === 'ok' && 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30',
      status === 'error' && 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30',
      status === 'checking' && 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30'
    )}>
      <div className="relative inline-block">
        <Icon className={cn(
          'h-5 w-5 mx-auto mb-1',
          status === 'ok' && 'text-green-600 dark:text-green-400',
          status === 'error' && 'text-red-600 dark:text-red-400',
          status === 'checking' && 'text-amber-600 dark:text-amber-400'
        )} />
        {status === 'ok' && (
          <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        )}
      </div>
      <p className="text-xs font-medium">{label}</p>
      <p className={cn(
        'text-xs',
        status === 'ok' && 'text-green-700 dark:text-green-400',
        status === 'error' && 'text-red-700 dark:text-red-400',
        status === 'checking' && 'text-amber-700 dark:text-amber-400'
      )}>
        {status === 'checking' ? 'Проверка...' : value}
      </p>
    </div>
  );
}

function EnvRow({ label, value, mono, badge }: {
  label: string; value: string; mono?: boolean; badge?: 'default' | 'secondary';
}) {
  return (
    <div className="flex justify-between items-center text-sm py-1">
      <span className="text-muted-foreground">{label}</span>
      {badge ? (
        <Badge variant={badge}>{value}</Badge>
      ) : (
        <span className={cn(mono && 'font-mono')}>{value}</span>
      )}
    </div>
  );
}

function ResourceBar({ label, status }: {
  label: string; status: 'ok' | 'error' | 'checking';
}) {
  const pct = status === 'ok' ? 100 : status === 'checking' ? 50 : 0;
  const color = status === 'ok' ? 'bg-green-500' : status === 'checking' ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <div className="flex items-center gap-1.5">
          <div className={cn('h-2 w-2 rounded-full', color, status === 'checking' && 'animate-pulse')} />
          <span className={cn(
            'text-xs font-medium',
            status === 'ok' && 'text-green-600 dark:text-green-400',
            status === 'error' && 'text-red-600 dark:text-red-400',
            status === 'checking' && 'text-amber-600 dark:text-amber-400'
          )}>
            {status === 'ok' ? 'Подключено' : status === 'checking' ? 'Проверка...' : 'Ошибка'}
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StaffStatCard({ label, value, icon: Icon, color, bg }: {
  label: string; value: number; icon: typeof Users; color: string; bg: string;
}) {
  return (
    <div className={cn('p-3 rounded-xl border text-center', bg)}>
      <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function AppSettingCard({ icon: Icon, label, description, value, saving, onSave, placeholder, multiline, type }: {
  icon: typeof Store;
  label: string;
  description: string;
  value: string;
  saving: boolean;
  onSave: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
}) {
  const [editValue, setEditValue] = useState(value);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  return (
    <Card className="overflow-hidden transition-all duration-200 hover:shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-2">
            {multiline ? (
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={placeholder}
                rows={3}
              />
            ) : (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={placeholder}
                type={type}
              />
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={handleCancel}>Отмена</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-primary-foreground" />
                ) : (
                  'Сохранить'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className={cn('text-sm', !value && 'text-muted-foreground italic')}>
              {value || placeholder || '—'}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3 w-3" />
              Изменить
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChangelogItem({ version, date, changes }: {
  version: string; date: string; changes: string[];
}) {
  const [expanded, setExpanded] = useState(version === '2.0');
  return (
    <div className="border-l-2 border-primary/30 pl-3">
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <Badge variant="secondary" className="text-xs">v{version}</Badge>
        <span className="text-xs text-muted-foreground">{date}</span>
      </button>
      {expanded && (
        <ul className="mt-2 space-y-1">
          {changes.map((c, i) => (
            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
              <span className="text-primary mt-0.5">&bull;</span>
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TechStackItem({ icon: Icon, name, desc, color }: {
  icon: typeof Globe; name: string; desc: string; color: string;
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className={cn('p-2 rounded-lg bg-muted/50', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatUptime(startTime: number): string {
  const diffMs = Date.now() - startTime;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'только что';
  if (diffMins < 60) return `${diffMins} мин`;
  const hours = Math.floor(diffMins / 60);
  if (hours < 24) return `${hours}ч ${diffMins % 60}м`;
  const days = Math.floor(hours / 24);
  return `${days}д ${hours % 24}ч`;
}
