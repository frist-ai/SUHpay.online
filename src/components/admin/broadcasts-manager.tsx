'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useShopStore } from '@/stores/shop-store';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Loader2,
  Eye,
  FileEdit,
  Zap,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ─── Status Configuration ──────────────────────────────────────────────────

const statusConfig: Record<string, {
  label: string;
  icon: typeof Clock;
  color: string;
  dotColor: string;
}> = {
  draft: {
    label: 'Черновик',
    icon: FileEdit,
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    dotColor: 'bg-gray-400',
  },
  queued: {
    label: 'В очереди',
    icon: Clock,
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    dotColor: 'bg-amber-500',
  },
  sending: {
    label: 'Отправка',
    icon: Loader2,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    dotColor: 'bg-blue-500',
  },
  sent: {
    label: 'Отправлено',
    icon: CheckCircle2,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    dotColor: 'bg-green-500',
  },
  failed: {
    label: 'Ошибка',
    icon: XCircle,
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    dotColor: 'bg-red-500',
  },
};

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface Broadcast {
  id: string;
  title: string;
  message: string;
  imageUrl: string | null;
  linkUrl: string | null;
  targetType: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SubscriberStats {
  all: number;
  registered: number;
  buyers: number;
  newUsers: number;
}

const defaultForm = {
  title: '',
  message: '',
  imageUrl: '',
  linkUrl: '',
  targetType: 'all',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const getTargetLabel = (type: string) => {
  switch (type) {
    case 'all': return 'Все контакты';
    case 'registered': return 'Зарегистрированные';
    case 'buyers': return 'Покупатели';
    default: return type;
  }
};

const getTargetCount = (type: string, stats: SubscriberStats | null) => {
  if (!stats) return 0;
  switch (type) {
    case 'all': return stats.all;
    case 'registered': return stats.registered;
    case 'buyers': return stats.buyers;
    default: return 1;
  }
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

// ─── Status Badge Component ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.draft;
  const Icon = cfg.icon;
  return (
    <Badge className={cn('gap-1', cfg.color)}>
      <Icon className={cn('h-3 w-3', status === 'sending' && 'animate-spin')} />
      {cfg.label}
    </Badge>
  );
}

// ─── Delivery Stats Bar ─────────────────────────────────────────────────────

function DeliveryStats({ broadcast }: { broadcast: Broadcast }) {
  if (broadcast.status === 'draft' || broadcast.status === 'queued') return null;

  const total = broadcast.totalRecipients || broadcast.sentCount + broadcast.failedCount;
  const sentPct = total > 0 ? Math.round((broadcast.sentCount / total) * 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Доставка</span>
        <span className="font-medium">{sentPct}%</span>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
        <div
          className="bg-green-500 transition-all duration-500"
          style={{ width: `${sentPct}%` }}
        />
        {broadcast.failedCount > 0 && (
          <div
            className="bg-red-500 transition-all duration-500"
            style={{ width: `${total > 0 ? (broadcast.failedCount / total) * 100 : 0}%` }}
          />
        )}
      </div>
      <div className="flex gap-3 text-xs">
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-3 w-3" />
          {broadcast.sentCount}
        </span>
        {broadcast.failedCount > 0 && (
          <span className="flex items-center gap-1 text-red-500">
            <XCircle className="h-3 w-3" />
            {broadcast.failedCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Broadcast Preview ──────────────────────────────────────────────────────

function BroadcastPreview({ title, message }: { title: string; message: string }) {
  if (!title && !message) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
    >
      <Card className="overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-muted-foreground">Предпросмотр</span>
          </div>
          {title && <p className="font-semibold text-sm mb-1">{title}</p>}
          {message && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{message}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function BroadcastsManager() {
  const { setCurrentView } = useShopStore();
  const { toast } = useToast();
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [stats, setStats] = useState<SubscriberStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [broadcastToSend, setBroadcastToSend] = useState<Broadcast | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [broadcastsRes, statsRes] = await Promise.all([
        fetch('/api/broadcasts'),
        fetch('/api/subscribers/stats'),
      ]);

      const broadcastsData = await broadcastsRes.json();
      setBroadcasts(Array.isArray(broadcastsData) ? broadcastsData : []);
      setStats(await statsRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
      setBroadcasts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title || !form.message) {
      toast({ title: 'Заполните обязательные поля', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch('/api/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        toast({ title: 'Рассылка создана' });
        setIsCreating(false);
        setForm(defaultForm);
        fetchData();
      } else {
        toast({ title: 'Ошибка создания', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error creating broadcast:', error);
      toast({ title: 'Ошибка создания', variant: 'destructive' });
    }
  };

  const handleSendClick = (broadcast: Broadcast) => {
    setBroadcastToSend(broadcast);
    setSendConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!broadcastToSend) return;

    setSending(broadcastToSend.id);
    setSendConfirmOpen(false);

    try {
      const res = await fetch('/api/broadcasts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcastId: broadcastToSend.id }),
      });

      const data = await res.json();

      if (res.ok) {
        toast({
          title: 'Рассылка отправлена',
          description: `Отправлено: ${data.sentCount}, Ошибок: ${data.failedCount}`,
        });
        fetchData();
      } else {
        toast({ title: data.error || 'Ошибка отправки', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error sending broadcast:', error);
      toast({ title: 'Ошибка отправки', variant: 'destructive' });
    } finally {
      setSending(null);
      setBroadcastToSend(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/broadcasts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBroadcasts(prev => prev.filter(b => b.id !== id));
        toast({ title: 'Рассылка удалена' });
      }
    } catch (error) {
      console.error('Error deleting broadcast:', error);
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Separate active vs history ────────────────────────────────────────

  const activeBroadcasts = useMemo(
    () => broadcasts.filter(b => b.status === 'draft' || b.status === 'queued' || b.status === 'sending'),
    [broadcasts]
  );

  const historyBroadcasts = useMemo(
    () => broadcasts.filter(b => b.status === 'sent' || b.status === 'failed'),
    [broadcasts]
  );

  // ─── Render ─────────────────────────────────────────────────────────────

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
              <h1 className="text-xl font-bold">Рассылки</h1>
              <p className="text-sm text-muted-foreground">
                Уведомления для подписчиков
              </p>
            </div>
          </div>
          {!isCreating && (
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Создать
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <div className="p-3 space-y-3">
          {/* Stats Cards */}
          {stats && !isCreating && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              <Card>
                <CardContent className="p-3 text-center min-w-0">
                  <Users className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-2xl font-bold">{stats.all}</p>
                  <p className="text-xs text-muted-foreground truncate">Все контакты</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center min-w-0">
                  <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold">{stats.registered}</p>
                  <p className="text-xs text-muted-foreground truncate">Зарегистрированы</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center min-w-0">
                  <Eye className="h-5 w-5 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold">{stats.buyers}</p>
                  <p className="text-xs text-muted-foreground truncate">Покупатели</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center min-w-0">
                  <Clock className="h-5 w-5 mx-auto mb-2 text-amber-500" />
                  <p className="text-2xl font-bold">{stats.newUsers}</p>
                  <p className="text-xs text-muted-foreground truncate">За неделю</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Create Form */}
          <AnimatePresence mode="wait">
            {isCreating && (
              <motion.div
                key="create-form"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
              >
                <Card className="border-primary">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Новая рассылка</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Заголовок *</Label>
                      <Input
                        id="title"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="Заголовок сообщения"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Текст сообщения *</Label>
                      <Textarea
                        id="message"
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        placeholder="Текст рассылки..."
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="imageUrl">URL изображения</Label>
                        <Input
                          id="imageUrl"
                          value={form.imageUrl || ''}
                          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="linkUrl">Ссылка</Label>
                        <Input
                          id="linkUrl"
                          value={form.linkUrl || ''}
                          onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Получатели</Label>
                      <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            Все контакты ({stats?.all || 0})
                          </SelectItem>
                          <SelectItem value="registered">
                            Зарегистрированные ({stats?.registered || 0})
                          </SelectItem>
                          <SelectItem value="buyers">
                            Покупатели ({stats?.buyers || 0})
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Будет отправлено ~{getTargetCount(form.targetType, stats)} получателям
                      </p>
                    </div>

                    {/* Preview */}
                    <BroadcastPreview title={form.title} message={form.message} />

                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleCreate}>
                        Создать
                      </Button>
                      <Button variant="outline" onClick={() => { setIsCreating(false); setForm(defaultForm); }}>
                        Отмена
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Broadcasts List */}
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-xl border p-3 space-y-2">
                    <Skeleton className="h-5 w-5 mx-auto rounded" />
                    <Skeleton className="h-7 w-16 mx-auto" />
                    <Skeleton className="h-3 w-20 mx-auto" />
                  </div>
                ))}
              </div>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : !Array.isArray(broadcasts) || broadcasts.length === 0 ? (
            /* Empty State */
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
            >
              <Card>
                <CardContent className="py-8 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
                    <Send className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-base font-medium text-muted-foreground mb-1">Рассылок пока нет</p>
                  <p className="text-sm text-muted-foreground/70 mb-4">
                    Создайте первую рассылку, чтобы уведомить подписчиков
                  </p>
                  <Button onClick={() => setIsCreating(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Создать рассылку
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {/* Active Broadcasts */}
              {activeBroadcasts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-medium text-muted-foreground">Активные</h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {activeBroadcasts.length}
                    </Badge>
                  </div>
                  <AnimatePresence mode="popLayout">
                    {activeBroadcasts.map((broadcast, index) => (
                      <motion.div
                        key={broadcast.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          type: 'spring' as const,
                          stiffness: 400,
                          damping: 30,
                          delay: index * 0.05,
                        }}
                      >
                        <Card className="overflow-hidden">
                          <div className={cn('h-1', statusConfig[broadcast.status]?.dotColor || 'bg-gray-400')} />
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-medium truncate">{broadcast.title}</h3>
                                  <StatusBadge status={broadcast.status} />
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                  {broadcast.message}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {getTargetLabel(broadcast.targetType)} ({getTargetCount(broadcast.targetType, stats)})
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatDate(broadcast.createdAt)}
                                  </span>
                                </div>
                                <DeliveryStats broadcast={broadcast} />
                              </div>
                              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                                {broadcast.status === 'draft' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleSendClick(broadcast)}
                                    disabled={sending === broadcast.id}
                                  >
                                    {sending === broadcast.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Send className="h-4 w-4 mr-1" />
                                    )}
                                    Отправить
                                  </Button>
                                )}
                                {broadcast.status === 'draft' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleDelete(broadcast.id)}
                                    disabled={deletingId === broadcast.id}
                                  >
                                    {deletingId === broadcast.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* History Broadcasts */}
              {historyBroadcasts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-green-500" />
                    <h3 className="text-sm font-medium text-muted-foreground">История</h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {historyBroadcasts.length}
                    </Badge>
                  </div>
                  <AnimatePresence mode="popLayout">
                    {historyBroadcasts.map((broadcast, index) => (
                      <motion.div
                        key={broadcast.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          type: 'spring' as const,
                          stiffness: 400,
                          damping: 30,
                          delay: index * 0.05,
                        }}
                      >
                        <Card className={cn(
                          'overflow-hidden',
                          broadcast.status === 'failed' && 'border-red-200 dark:border-red-900/50'
                        )}>
                          <div className={cn('h-1', statusConfig[broadcast.status]?.dotColor || 'bg-gray-400')} />
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-medium truncate">{broadcast.title}</h3>
                                  <StatusBadge status={broadcast.status} />
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                  {broadcast.message}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {getTargetLabel(broadcast.targetType)}
                                  </span>
                                  {broadcast.sentAt && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatDate(broadcast.sentAt)}
                                    </span>
                                  )}
                                </div>
                                <DeliveryStats broadcast={broadcast} />
                                {broadcast.status === 'failed' && (
                                  <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>Не удалось доставить {broadcast.failedCount} из {broadcast.totalRecipients} сообщений</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отправить рассылку?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите отправить рассылку &quot;{broadcastToSend?.title}&quot; сейчас? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSend}>
              Отправить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
