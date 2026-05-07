'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useShopStore } from '@/stores/shop-store';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Users,
  Clock,
  Plus,
  X,
  CheckCircle2,
  Loader2,
  Trash2,
  Vote,
  RotateCcw,
  Calendar,
  ToggleLeft,
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

interface PollOption {
  id: string;
  text: string;
  sortOrder: number;
  _count?: { responses: number };
}

interface Poll {
  id: string;
  question: string;
  targetType: string;
  status: string;
  duration: number;
  totalRecipients: number;
  totalVotes: number;
  closesAt: string | null;
  closedAt: string | null;
  createdAt: string;
  allowMultipleChoice?: boolean;
  options?: PollOption[];
}

interface PollStats {
  id: string;
  text: string;
  voteCount: number;
  percentage: number;
}

interface PollDetail extends Poll {
  options: (PollOption & { _count: { responses: number } })[];
}

interface SubscriberStats {
  all: number;
  registered: number;
  buyers: number;
}

const defaultForm = {
  question: '',
  targetType: 'all',
  duration: 24,
  options: ['', ''] as string[],
  allowMultipleChoice: false,
  closesAt: '',
};

export function PollsManager() {
  const { setCurrentView } = useShopStore();
  const { toast } = useToast();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [stats, setStats] = useState<SubscriberStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [selectedPoll, setSelectedPoll] = useState<PollDetail | null>(null);
  const [pollStats, setPollStats] = useState<PollStats[] | null>(null);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false);
  const [pollToSend, setPollToSend] = useState<Poll | null>(null);
  const [pollToClose, setPollToClose] = useState<Poll | null>(null);
  const [pollToReopen, setPollToReopen] = useState<Poll | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pollsRes, statsRes] = await Promise.all([
        fetch('/api/polls?includeStats=true'),
        fetch('/api/subscribers/stats'),
      ]);

      const pollsData = await pollsRes.json();
      setPolls(Array.isArray(pollsData) ? pollsData : []);
      setStats(await statsRes.json());
    } catch (error) {
      console.error('Error fetching data:', error);
      setPolls([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPollStats = async (pollId: string) => {
    try {
      const res = await fetch(`/api/polls/${pollId}/stats`);
      const data = await res.json();
      setPollStats(data.options);
    } catch (error) {
      console.error('Error fetching poll stats:', error);
    }
  };

  const handleCreate = async () => {
    if (!form.question || form.options.filter(o => o.trim()).length < 2) {
      toast({ title: 'Заполните вопрос и минимум 2 варианта', variant: 'destructive' });
      return;
    }

    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: form.question,
          targetType: form.targetType,
          duration: form.duration,
          options: form.options.filter(o => o.trim()),
          allowMultipleChoice: form.allowMultipleChoice,
          closesAt: form.closesAt || undefined,
        }),
      });

      if (res.ok) {
        toast({ title: 'Опрос создан' });
        setCreateDialogOpen(false);
        setForm(defaultForm);
        fetchData();
      } else {
        const data = await res.json();
        toast({ title: data.error || 'Ошибка создания', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error creating poll:', error);
      toast({ title: 'Ошибка создания', variant: 'destructive' });
    }
  };

  const handleSendClick = (poll: Poll) => {
    setPollToSend(poll);
    setSendConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!pollToSend) return;

    setSending(pollToSend.id);
    setSendConfirmOpen(false);

    try {
      const res = await fetch(`/api/polls/${pollToSend.id}/send`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        toast({
          title: 'Опрос отправлен',
          description: `Получателей: ${data.sentCount || data.totalRecipients}`,
        });
        fetchData();
      } else {
        toast({ title: data.error || 'Ошибка отправки', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error sending poll:', error);
      toast({ title: 'Ошибка отправки', variant: 'destructive' });
    } finally {
      setSending(null);
      setPollToSend(null);
    }
  };

  const handleCloseClick = (poll: Poll) => {
    setPollToClose(poll);
    setCloseConfirmOpen(true);
  };

  const handleConfirmClose = async () => {
    if (!pollToClose) return;

    try {
      const res = await fetch(`/api/polls/${pollToClose.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed', closedAt: new Date().toISOString() }),
      });

      if (res.ok) {
        toast({ title: 'Опрос закрыт' });
        if (selectedPoll?.id === pollToClose.id) {
          setSelectedPoll(null);
          setPollStats(null);
        }
        fetchData();
      }
    } catch (error) {
      console.error('Error closing poll:', error);
    } finally {
      setCloseConfirmOpen(false);
      setPollToClose(null);
    }
  };

  const handleReopenClick = (poll: Poll) => {
    setPollToReopen(poll);
    setReopenConfirmOpen(true);
  };

  const handleConfirmReopen = async () => {
    if (!pollToReopen) return;

    try {
      const res = await fetch(`/api/polls/${pollToReopen.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active', closedAt: null }),
      });

      if (res.ok) {
        toast({ title: 'Опрос возобновлён' });
        fetchData();
      }
    } catch (error) {
      console.error('Error reopening poll:', error);
    } finally {
      setReopenConfirmOpen(false);
      setPollToReopen(null);
    }
  };

  const getTargetLabel = (type: string) => {
    switch (type) {
      case 'all': return 'Все контакты';
      case 'registered': return 'Зарегистрированные';
      case 'buyers': return 'Покупатели';
      default: return type;
    }
  };

  const getDurationLabel = (hours: number) => {
    if (hours === 1) return '1 час';
    if (hours === 24) return '24 часа';
    return `${hours} часов`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100 border">
            <Clock className="h-3 w-3 mr-1" />
            Черновик
          </Badge>
        );
      case 'active':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300 hover:bg-green-100 border">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Активен
          </Badge>
        );
      case 'closed':
        return (
          <Badge className="bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-100 border">
            <X className="h-3 w-3 mr-1" />
            Закрыт
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTimeRemaining = (closesAt: string | null) => {
    if (!closesAt) return null;
    const diff = new Date(closesAt).getTime() - Date.now();
    if (diff <= 0) return 'Завершён';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}ч ${minutes}м`;
  };

  const addOption = () => {
    setForm({ ...form, options: [...form.options, ''] });
  };

  const removeOption = (index: number) => {
    if (form.options.length <= 2) {
      toast({ title: 'Минимум 2 варианта', variant: 'destructive' });
      return;
    }
    setForm({ ...form, options: form.options.filter((_, i) => i !== index) });
  };

  const updateOption = (index: number, value: string) => {
    const newOpts = [...form.options];
    newOpts[index] = value;
    setForm({ ...form, options: newOpts });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => selectedPoll ? (setSelectedPoll(null), setPollStats(null)) : setCurrentView('admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Опросы</h1>
              <p className="text-sm text-muted-foreground">
                {selectedPoll ? 'Результаты опроса' : 'Опросы для подписчиков'}
              </p>
            </div>
          </div>
          {!selectedPoll && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Создать
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <div className="p-3 space-y-3">
          {/* Poll Detail View */}
          <AnimatePresence mode="wait">
            {selectedPoll && pollStats ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
                className="space-y-4"
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">{selectedPoll.question}</CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                          {getStatusBadge(selectedPoll.status)}
                          {selectedPoll.allowMultipleChoice && (
                            <Badge variant="outline" className="text-xs">
                              <ToggleLeft className="h-3 w-3 mr-1" />
                              Множественный выбор
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Bar chart results */}
                    <div className="space-y-3">
                      {pollStats.map((opt, idx) => (
                        <motion.div
                          key={opt.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: 'spring' as const, stiffness: 300, damping: 25, delay: idx * 0.08 }}
                        >
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{opt.text}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {opt.voteCount} голосов ({opt.percentage}%)
                            </span>
                          </div>
                          <div className="h-8 bg-muted rounded-lg overflow-hidden relative">
                            <motion.div
                              className={cn(
                                'h-full rounded-lg flex items-center justify-end pr-2',
                                opt.percentage >= 50
                                  ? 'bg-green-500'
                                  : opt.percentage >= 25
                                    ? 'bg-amber-500'
                                    : 'bg-gray-400'
                              )}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(opt.percentage, 2)}%` }}
                              transition={{ type: 'spring' as const, stiffness: 100, damping: 20, delay: idx * 0.1 + 0.2 }}
                            >
                              {opt.percentage >= 15 && (
                                <span className="text-xs font-bold text-white">{opt.percentage}%</span>
                              )}
                            </motion.div>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        Всего голосов: <span className="font-semibold text-foreground">{selectedPoll.totalVotes}</span>
                      </div>
                      <div className="flex gap-2">
                        {selectedPoll.status === 'active' && (
                          <Button variant="destructive" size="sm" onClick={() => handleCloseClick(selectedPoll)}>
                            <X className="h-4 w-4 mr-1" />
                            Закрыть
                          </Button>
                        )}
                        {selectedPoll.status === 'closed' && (
                          <Button variant="outline" size="sm" onClick={() => handleReopenClick(selectedPoll)}>
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Возобновить
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : !selectedPoll && (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
                className="space-y-4"
              >
                {/* Stats Cards */}
                {stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: 0 }}
                    >
                      <Card>
                        <CardContent className="p-3 text-center min-w-0">
                          <Users className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-2xl font-bold">{stats.all}</p>
                          <p className="text-xs text-muted-foreground truncate">Все контакты</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: 0.05 }}
                    >
                      <Card>
                        <CardContent className="p-3 text-center min-w-0">
                          <CheckCircle2 className="h-5 w-5 mx-auto mb-2 text-green-500" />
                          <p className="text-2xl font-bold">{stats.registered}</p>
                          <p className="text-xs text-muted-foreground truncate">Зарегистрированы</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: 0.1 }}
                    >
                      <Card>
                        <CardContent className="p-3 text-center min-w-0">
                          <BarChart3 className="h-5 w-5 mx-auto mb-2 text-blue-500" />
                          <p className="text-2xl font-bold">{stats.buyers}</p>
                          <p className="text-xs text-muted-foreground truncate">Покупатели</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: 0.15 }}
                    >
                      <Card>
                        <CardContent className="p-3 text-center min-w-0">
                          <Vote className="h-5 w-5 mx-auto mb-2 text-amber-500" />
                          <p className="text-2xl font-bold">{Array.isArray(polls) ? polls.filter(p => p.status === 'active').length : 0}</p>
                          <p className="text-xs text-muted-foreground truncate">Активных</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>
                )}

                {/* Polls List */}
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="rounded-xl border p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <div className="space-y-2">
                          {[...Array(3)].map((_, j) => (
                            <div key={j} className="flex items-center gap-2">
                              <Skeleton className="h-4 w-4 rounded-full" />
                              <Skeleton className="h-4 w-32" />
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : polls.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                  >
                    <Card>
                      <CardContent className="py-12 text-center">
                        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Опросов пока нет</p>
                        <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Создать опрос
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {polls.map((poll, index) => (
                        <motion.div
                          key={poll.id}
                          layout
                          initial={{ opacity: 0, y: 12, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: index * 0.05 }}
                        >
                          <Card className={cn(
                            'transition-all',
                            poll.status === 'closed' && 'opacity-60',
                            poll.status === 'active' && 'border-green-200 dark:border-green-800',
                            poll.status === 'draft' && 'border-amber-200 dark:border-amber-800',
                          )}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div
                                  className="flex-1 min-w-0 cursor-pointer"
                                  onClick={async () => {
                                    setSelectedPoll(poll as PollDetail);
                                    await fetchPollStats(poll.id);
                                  }}
                                >
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h3 className="font-medium">{poll.question}</h3>
                                    {getStatusBadge(poll.status)}
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {getTargetLabel(poll.targetType)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {getDurationLabel(poll.duration)}
                                    </span>
                                    {poll.status === 'active' && poll.closesAt && (
                                      <span className="flex items-center gap-1 text-green-600">
                                        <Calendar className="h-3 w-3" />
                                        Осталось: {getTimeRemaining(poll.closesAt)}
                                      </span>
                                    )}
                                    {poll.totalVotes > 0 && (
                                      <span className="flex items-center gap-1">
                                        <Vote className="h-3 w-3" />
                                        Голосов: {poll.totalVotes}
                                      </span>
                                    )}
                                    {poll.allowMultipleChoice && (
                                      <span className="flex items-center gap-1">
                                        <ToggleLeft className="h-3 w-3" />
                                        Множ. выбор
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                                  {poll.status === 'draft' && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleSendClick(poll)}
                                      disabled={sending === poll.id}
                                    >
                                      {sending === poll.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        'Отправить'
                                      )}
                                    </Button>
                                  )}
                                  {poll.status === 'active' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                          setSelectedPoll(poll as PollDetail);
                                          await fetchPollStats(poll.id);
                                        }}
                                      >
                                        <BarChart3 className="h-4 w-4 mr-1" />
                                        Результаты
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => handleCloseClick(poll)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
                                  {poll.status === 'closed' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                          setSelectedPoll(poll as PollDetail);
                                          await fetchPollStats(poll.id);
                                        }}
                                      >
                                        <BarChart3 className="h-4 w-4 mr-1" />
                                        Результаты
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleReopenClick(poll)}
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                      </Button>
                                    </>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Create Poll Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          setForm(defaultForm);
        }
      }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новый опрос</DialogTitle>
            <DialogDescription>
              Создайте опрос для подписчиков
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="poll-question">Вопрос *</Label>
              <Input
                id="poll-question"
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="Ваш вопрос..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Варианты ответов *</Label>
                <Button variant="ghost" size="sm" onClick={addOption}>
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить
                </Button>
              </div>
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {form.options.map((opt, idx) => (
                    <motion.div
                      key={idx}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
                      className="flex items-center gap-2"
                    >
                      <Input
                        value={opt}
                        onChange={(e) => updateOption(idx, e.target.value)}
                        placeholder={`Вариант ${idx + 1}`}
                        className="flex-1"
                      />
                      {form.options.length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => removeOption(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Множественный выбор</p>
                  <p className="text-xs text-muted-foreground">Разрешить выбор нескольких вариантов</p>
                </div>
              </div>
              <Switch
                checked={form.allowMultipleChoice}
                onCheckedChange={(checked) => setForm({ ...form, allowMultipleChoice: checked })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Получатели</Label>
                <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все контакты ({stats?.all || 0})</SelectItem>
                    <SelectItem value="registered">Зарегистрированные ({stats?.registered || 0})</SelectItem>
                    <SelectItem value="buyers">Покупатели ({stats?.buyers || 0})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Длительность</Label>
                <Select value={form.duration.toString()} onValueChange={(v) => setForm({ ...form, duration: parseInt(v) })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 час</SelectItem>
                    <SelectItem value="24">24 часа</SelectItem>
                    <SelectItem value="48">48 часов</SelectItem>
                    <SelectItem value="72">72 часа (3 дня)</SelectItem>
                    <SelectItem value="168">168 часов (неделя)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="poll-closesAt" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Дата закрытия (необязательно)
              </Label>
              <Input
                id="poll-closesAt"
                type="datetime-local"
                value={form.closesAt}
                onChange={(e) => setForm({ ...form, closesAt: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); setForm(defaultForm); }}>
              Отмена
            </Button>
            <Button onClick={handleCreate} disabled={!form.question || form.options.filter(o => o.trim()).length < 2}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отправить опрос?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите отправить опрос &laquo;{pollToSend?.question}&raquo; сейчас? Это действие нельзя отменить.
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

      {/* Close Confirmation Dialog */}
      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Закрыть опрос?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите закрыть опрос &laquo;{pollToClose?.question}&raquo;? Голосование будет остановлено.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose}>
              Закрыть
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reopen Confirmation Dialog */}
      <AlertDialog open={reopenConfirmOpen} onOpenChange={setReopenConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Возобновить опрос?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите возобновить опрос &laquo;{pollToReopen?.question}&raquo;? Голосование снова станет доступным.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReopen}>
              Возобновить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
