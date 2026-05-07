'use client';

import { useState, useEffect } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { validatePhone, normalizePhone } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Phone,
  Settings,
  ChevronRight,
  Edit,
  Save,
  X,
  Calendar,
  Shield,
  Camera,
  Loader2,
  Mail,
  CheckCircle2,
  Gift,
  Copy,
  Check,
  ShoppingBag,
  Wallet,
  Star,
  Sparkles,
  Bell,
  Moon,
  Sun,
  FileText,
} from 'lucide-react';
import { NotificationBell } from '@/components/shared/notification-bell';
import { LoyaltyCard } from './loyalty-card';
import { cn, pluralize, formatDateGenitive } from '@/lib/utils';
import { ProductRequestForm } from './product-request-form';
import { hapticFeedback, showSuccessNotification } from '@/lib/telegram';
import { useUserChatNotifications } from '@/hooks/use-chat-notifications';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';

// ─── Animation variants ────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
};

// ─── Quick Action Button ────────────────────────────────────────

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}

function QuickActionButton({ icon, label, onClick, className }: QuickActionProps) {
  return (
    <motion.button
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-border/50 bg-card hover:bg-accent/50 active:bg-accent/80 transition-colors text-center min-h-[80px]",
        className
      )}
      onClick={onClick}
      whileTap={{ scale: 0.95 } as const}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-xs font-medium leading-tight text-muted-foreground">{label}</span>
    </motion.button>
  );
}

// ─── Main Profile View ─────────────────────────────────────────

export function ProfileView() {
  const { user, setUser, favorites, setCurrentView, isAdmin } = useShopStore();
  const { toast } = useToast();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => { setThemeMounted(true); }, []);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [appVersion, setAppVersion] = useState('...');
  const [buildTime, setBuildTime] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  });

  // Fetch unread chat notifications
  const { unreadCount: unreadChat } = useUserChatNotifications(user?.id);

  // Update form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        email: user.email || '',
      });
    }
  }, [user]);

  // Fetch app version
  useEffect(() => {
    fetch('/api/config', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setAppVersion(data.version || '?.?.?');
        setBuildTime(data.buildTime || null);
      })
      .catch(() => setAppVersion('?.?.?'));
  }, []);

  // Use Telegram SDK photo URL (most reliable) as primary source
  useEffect(() => {
    if (!user?.telegramId || user?.photoUrl) return;
    const cdnUrl = `https://t.me/i/userpic/${user.telegramId}`;
    const currentUser = useShopStore.getState().user;
    if (currentUser && !currentUser.photoUrl) {
      setUser({ ...currentUser, photoUrl: cdnUrl });
    }
  }, [user?.telegramId, user?.photoUrl]);

  const handleAvatarError = () => {
    if (user?.telegramId) {
      fetch(`/api/telegram/user-photo?user_id=${user.telegramId}&_t=${Date.now()}`)
        .then(res => res.json())
        .then(photoData => {
          if (photoData.hasPhoto && photoData.photoUrl) {
            const currentUser = useShopStore.getState().user;
            if (currentUser) {
              setUser({ ...currentUser, photoUrl: photoData.photoUrl });
            }
          }
        })
        .catch(() => {});
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    const errors: Record<string, string> = {};
    if (formData.phone.trim()) {
      const phoneError = validatePhone(formData.phone);
      if (phoneError) errors.phone = phoneError;
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }
    setProfileErrors({});

    hapticFeedback('medium');
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: user.telegramId || undefined,
          userId: user.telegramId ? undefined : user.id,
          firstName: formData.firstName || null,
          lastName: formData.lastName || null,
          phone: formData.phone.trim() ? normalizePhone(formData.phone) : null,
          email: formData.email || null,
        }),
      });

      if (res.ok) {
        const updatedUser = await res.json();

        setUser({
          id: updatedUser.id,
          telegramId: updatedUser.telegramId,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          username: updatedUser.username,
          phone: updatedUser.phone,
          email: updatedUser.email,
          photoUrl: updatedUser.photoUrl,
          languageCode: updatedUser.languageCode,
          role: updatedUser.role,
          loyaltyPoints: updatedUser.loyaltyPoints || 0,
          totalSpent: updatedUser.totalSpent || 0,
          ordersCount: updatedUser.ordersCount || 0,
          referralCode: updatedUser.referralCode,
          referredBy: updatedUser.referredBy,
          birthday: updatedUser.birthday?.toISOString() || null,
          lastVisitAt: updatedUser.lastVisitAt,
          createdAt: updatedUser.createdAt,
        });

        setEditing(false);
        setSaveSuccess(true);
        showSuccessNotification();

        toast({
          title: 'Сохранено',
          description: 'Данные профиля обновлены',
        });

        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось сохранить данные',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        email: user.email || '',
      });
    }
    setEditing(false);
  };

  const handlePhotoUpload = async () => {
    hapticFeedback('light');

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !user?.id) return;

      setUploadingPhoto(true);

      try {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('type', 'avatar');
        formDataUpload.append('userId', user.id);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formDataUpload,
        });

        if (uploadRes.ok) {
          const { url } = await uploadRes.json();

          const userRes = await fetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telegramId: user.telegramId,
              photoUrl: url,
            }),
          });

          if (userRes.ok) {
            const updatedUser = await userRes.json();
            setUser({
              id: updatedUser.id,
              telegramId: updatedUser.telegramId,
              firstName: updatedUser.firstName,
              lastName: updatedUser.lastName,
              username: updatedUser.username,
              phone: updatedUser.phone,
              email: updatedUser.email,
              photoUrl: updatedUser.photoUrl,
              languageCode: updatedUser.languageCode,
              role: updatedUser.role,
              loyaltyPoints: updatedUser.loyaltyPoints || 0,
              totalSpent: updatedUser.totalSpent || 0,
              ordersCount: updatedUser.ordersCount || 0,
              referralCode: updatedUser.referralCode,
              referredBy: updatedUser.referredBy,
              birthday: updatedUser.birthday?.toISOString() || null,
              lastVisitAt: updatedUser.lastVisitAt,
              createdAt: updatedUser.createdAt,
            });

            toast({
              title: 'Фото обновлено',
              description: 'Аватар успешно изменён',
            });
          }
        } else {
          throw new Error('Upload failed');
        }
      } catch (error) {
        console.error('Photo upload error:', error);
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: 'Не удалось загрузить фото',
        });
      } finally {
        setUploadingPhoto(false);
      }
    };

    input.click();
  };

  // Profile-specific menu items (orders/favorites/addresses/support moved to Quick Actions)
  const profileMenuItems = [
    {
      id: 'notifications',
      icon: Bell,
      label: 'Настройки уведомлений',
      description: 'Управление уведомлениями',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      chevronColor: 'text-orange-400',
      hoverGradient: 'hover:bg-gradient-to-r hover:from-orange-500/5 hover:to-transparent',
      onClick: () => {
        hapticFeedback('light');
        toast({ title: 'В разработке', description: 'Настройки уведомлений скоро появятся' });
      },
    },
    {
      id: 'privacy',
      icon: FileText,
      label: 'Политика конфиденциальности',
      description: 'Обработка персональных данных',
      color: 'text-slate-500',
      bgColor: 'bg-slate-500/10',
      chevronColor: 'text-slate-400',
      hoverGradient: 'hover:bg-gradient-to-r hover:from-slate-500/5 hover:to-transparent',
      onClick: () => {
        hapticFeedback('light');
        toast({ title: 'В разработке', description: 'Политика конфиденциальности скоро появится' });
      },
    },
  ];

  // Get user display name
  const getDisplayName = () => {
    const parts = [user?.firstName, user?.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : user?.username || 'Пользователь';
  };

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.firstName) return user.firstName[0].toUpperCase();
    if (user?.username) return user.username[0].toUpperCase();
    return 'U';
  };

  // Format registration date
  const formatRegDate = () => {
    if (!user?.createdAt) return null;
    return formatDateGenitive(user.createdAt);
  };

  // Calculate membership duration in months
  const getMembershipMonths = () => {
    if (!user?.createdAt) return null;
    const created = new Date(user.createdAt);
    const now = new Date();
    const months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
    return months;
  };

  // Check if form has changes
  const hasChanges = () => {
    return (
      formData.firstName !== (user?.firstName || '') ||
      formData.lastName !== (user?.lastName || '') ||
      formData.phone !== (user?.phone || '') ||
      formData.email !== (user?.email || '')
    );
  };

  // Quick stats data
  const ordersCount = user?.ordersCount || 0;
  const totalSpent = user?.totalSpent || 0;
  const loyaltyPoints = user?.loyaltyPoints || 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2 flex items-center justify-between">
        <h1 className="text-lg font-bold">Профиль</h1>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {saveSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 10 }}
                className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Сохранено</span>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Dark mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              hapticFeedback('medium');
              const current = resolvedTheme || theme;
              setTheme(current === 'dark' ? 'light' : 'dark');
            }}
            aria-label={resolvedTheme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
          >
            {(resolvedTheme === 'dark' || (!themeMounted && theme === 'dark'))
              ? <Sun className={cn('h-5 w-5', 'text-amber-400 hover:text-amber-300')} />
              : <Moon className={cn('h-5 w-5', 'text-violet-500 hover:text-violet-400')} />
            }
          </Button>
          <NotificationBell
            userId={user?.id}
            onViewChat={() => setCurrentView('support')}
            onViewOrder={() => setCurrentView('orders')}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-14 liquid-glass-scroll">
        <motion.div
          className="p-3 space-y-3"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ─── Enhanced User Info Card ───────────────────────── */}
          <motion.div variants={itemVariants}>
            <Card className="overflow-hidden relative">
              {/* Decorative gradient background pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-brand/[0.04] pointer-events-none" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-brand/10 to-transparent rounded-bl-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-primary/5 to-transparent rounded-tr-full pointer-events-none" />

              <CardContent className="p-3 relative">
                <div className="flex items-center gap-4">
                  {/* Avatar with gradient background */}
                  <div className="relative">
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/30 via-brand/20 to-purple-400/20 blur-[2px]" />
                    <Avatar className="w-16 h-16 border-2 border-white dark:border-gray-800 relative">
                      <AvatarImage
                        src={user?.photoUrl || undefined}
                        alt={getDisplayName()}
                        onError={handleAvatarError}
                      />
                      <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-primary/15 to-brand/15 text-primary">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                    {/* Photo upload button */}
                    <button
                      onClick={handlePhotoUpload}
                      disabled={uploadingPhoto}
                      aria-label="Загрузить фото"
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50 z-10"
                    >
                      {uploadingPhoto ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Camera className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <AnimatePresence mode="wait">
                      {editing ? (
                        <motion.div
                          key="editing"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="space-y-2"
                        >
                          <Input
                            placeholder="Имя"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            className="h-9"
                          />
                          <Input
                            placeholder="Фамилия"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            className="h-9"
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="viewing"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                        >
                          <h2 className="font-semibold text-lg truncate">
                            {getDisplayName()}
                          </h2>
                          {user?.username && (
                            <p className="text-sm text-muted-foreground">@{user.username}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {isAdmin && (
                              <Badge variant="secondary" className="text-xs">
                                <Shield className="w-3 h-3 mr-1" />
                                Администратор
                              </Badge>
                            )}
                            {user?.telegramId && (
                              <Badge variant="outline" className="text-xs font-mono">
                                ID: {user.telegramId}
                              </Badge>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <AnimatePresence mode="wait">
                    {editing ? (
                      <motion.div
                        key="edit-buttons"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex gap-1"
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Отменить"
                          onClick={handleCancelEdit}
                          className="h-9 w-9"
                          disabled={saving}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          aria-label="Сохранить"
                          onClick={handleSave}
                          disabled={saving || !hasChanges()}
                          className="h-9 w-9"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="edit-button"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Редактировать"
                          onClick={() => {
                            hapticFeedback('light');
                            setEditing(true);
                          }}
                          className="h-9 w-9"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Contact info - editable */}
                <AnimatePresence>
                  {editing && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 space-y-3 overflow-hidden"
                    >
                      <div>
                        <Label htmlFor="phone" className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          Телефон
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+7 (999) 123-45-67"
                          value={formData.phone}
                          onChange={(e) => {
                            setFormData({ ...formData, phone: e.target.value });
                            if (profileErrors.phone) setProfileErrors(prev => { const u = { ...prev }; delete u.phone; return u; });
                          }}
                          className={cn("h-9 mt-1", profileErrors.phone && "border-red-500")}
                        />
                        {profileErrors.phone && <p className="text-xs text-red-500 mt-1">{profileErrors.phone}</p>}
                      </div>
                      <div>
                        <Label htmlFor="email" className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="email@example.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="h-9 mt-1"
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleSave}
                        disabled={saving || !hasChanges()}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Сохранение...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Сохранить изменения
                          </>
                        )}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Contact info - view mode */}
                <AnimatePresence>
                  {!editing && (user?.phone || user?.email || formatRegDate()) && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-4 space-y-2 text-sm"
                    >
                      {user!.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4 flex-shrink-0" />
                          <span>{user!.phone}</span>
                        </div>
                      )}
                      {user!.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4 flex-shrink-0" />
                          <span>{user!.email}</span>
                        </div>
                      )}
                      {formatRegDate() && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 flex-shrink-0 text-brand" />
                          <span className="text-muted-foreground">С нами с {formatRegDate()}</span>
                          {getMembershipMonths() !== null && getMembershipMonths()! > 0 && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-brand/10 text-brand border-brand/20">
                              <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                              {getMembershipMonths()} {pluralize(getMembershipMonths()!, 'месяц', 'месяца', 'месяцев')}
                            </Badge>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Compact stats row with colored badges */}
                {!editing && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium">
                        <ShoppingBag className="h-3 w-3" />
                        {ordersCount} {pluralize(ordersCount, 'заказ', 'заказа', 'заказов')}
                      </span>
                      {totalSpent > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-medium">
                          <Wallet className="h-3 w-3" />
                          {totalSpent >= 1000 ? `${(totalSpent / 1000).toFixed(1)}к` : totalSpent} ₽
                        </span>
                      )}
                      {loyaltyPoints > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium">
                          <Star className="h-3 w-3" />
                          {loyaltyPoints} {pluralize(loyaltyPoints, 'балл', 'балла', 'баллов')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* ─── Subtle gradient separator ────────────────────── */}
          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {/* ─── Loyalty card ──────────────────────────────────── */}
          <motion.div variants={itemVariants}>
            <LoyaltyCard />
          </motion.div>

          {/* ─── Quick Actions ─────────────────────────────────── */}
          <motion.div variants={itemVariants}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-1">Быстрые действия</h3>
            <div className="grid grid-cols-2 gap-2">
              <QuickActionButton
                icon="📋"
                label="Повторить заказ"
                onClick={() => {
                  hapticFeedback('light');
                  setCurrentView('orders');
                }}
              />
              <QuickActionButton
                icon="❤️"
                label="Избранное"
                onClick={() => {
                  hapticFeedback('light');
                  setCurrentView('favorites');
                }}
              />
              <QuickActionButton
                icon="📍"
                label="Мой адрес"
                onClick={() => {
                  hapticFeedback('light');
                  setCurrentView('addresses');
                }}
              />
              <QuickActionButton
                icon="💬"
                label="Поддержка"
                onClick={() => {
                  hapticFeedback('light');
                  setCurrentView('support');
                }}
              />
            </div>
          </motion.div>

          {/* ─── Referral card with gift animation ─────────────── */}
          {user?.referralCode && (
            <motion.div variants={itemVariants}>
              <Card className="border-brand/30 bg-gradient-to-br from-brand/5 via-brand/8 to-pink-500/5 overflow-hidden relative">
                {/* Shimmer overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_3s_infinite] pointer-events-none" />
                {/* Decorative circles */}
                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-brand/10" />
                <div className="absolute -bottom-3 -left-3 w-16 h-16 rounded-full bg-pink-500/5" />

                <CardContent className="p-3 relative">
                  <div className="flex items-center gap-3 mb-3">
                    <motion.div
                      className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center"
                      animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 4,
                        ease: 'easeInOut',
                      }}
                    >
                      <Gift className="h-5 w-5 text-brand" />
                    </motion.div>
                    <div>
                      <h3 className="font-semibold text-sm">Пригласи друга</h3>
                      <p className="text-xs text-muted-foreground">Поделитесь промокодом и получите бонусы</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg px-3 py-2.5 font-mono text-sm font-bold text-brand border border-brand/20">
                      {user.referralCode}
                    </div>
                    <Button
                      size="sm"
                      variant={referralCopied ? "default" : "outline"}
                      className={cn(
                        "rounded-lg min-w-[100px]",
                        referralCopied ? "bg-brand hover:bg-brand/90 text-brand-foreground" : "border-brand/30 text-brand hover:bg-brand/10"
                      )}
                      onClick={() => {
                        navigator.clipboard.writeText(user.referralCode!).then(() => {
                          setReferralCopied(true);
                          hapticFeedback('light');
                          toast({ title: 'Промокод скопирован!', description: 'Отправьте его другу' });
                          setTimeout(() => setReferralCopied(false), 3000);
                        }).catch(() => {
                          toast({ title: 'Ошибка', description: 'Не удалось скопировать', variant: 'destructive' });
                        });
                      }}
                    >
                      {referralCopied ? (
                        <><Check className="h-4 w-4 mr-1" /> Скопировано</>
                      ) : (
                        <><Copy className="h-4 w-4 mr-1" /> Скопировать</>
                      )}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Друг получит скидку на первый заказ, а вы — бонусные баллы
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ─── Product Request Form ──────────────────────────── */}
          {user && (
            <motion.div variants={itemVariants}>
              <ProductRequestForm
                telegramId={user.telegramId}
                userId={user.id}
              />
            </motion.div>
          )}

          {/* ─── Profile Menu Items ───────────────────────────── */}
          <motion.div variants={itemVariants}>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {profileMenuItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.id}>
                      {index > 0 && (
                        <div className="mx-4">
                          <Separator className="opacity-50" />
                        </div>
                      )}
                      <motion.button
                        className={cn(
                          "w-full p-4 flex items-center gap-4 transition-all duration-200 text-left",
                          item.hoverGradient
                        )}
                        onClick={item.onClick}
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.995 } as const}
                      >
                        <div className={cn(
                          "p-2.5 rounded-xl transition-colors",
                          item.bgColor
                        )}>
                          <Icon className={cn("h-5 w-5", item.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{item.label}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <ChevronRight className={cn("h-5 w-5", item.chevronColor, "opacity-60")} />
                      </motion.button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          {/* ─── Admin access ──────────────────────────────────── */}
          {isAdmin && (
            <motion.div variants={itemVariants}>
              <Card className="border-primary/50 bg-primary/5 overflow-hidden">
                <CardContent className="p-0">
                  <motion.button
                    className="w-full p-4 flex items-center gap-4 hover:bg-gradient-to-r hover:from-primary/10 hover:to-transparent transition-all text-left"
                    onClick={() => {
                      hapticFeedback('medium');
                      setCurrentView('admin');
                    }}
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.995 } as const}
                  >
                    <div className="p-2.5 rounded-xl bg-primary/20">
                      <Settings className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Панель администратора</p>
                      <p className="text-sm text-muted-foreground">Управление магазином</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-primary/60" />
                  </motion.button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ─── Version ───────────────────────────────────────── */}
          <motion.div variants={itemVariants} className="text-center text-xs text-muted-foreground py-4">
            <p>СУХ[pay] v{appVersion} • Telegram Mini App</p>
            {buildTime && (
              <p className="mt-1 opacity-70">
                Сборка: {new Date(buildTime).toLocaleString('ru-RU')}
              </p>
            )}
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}
