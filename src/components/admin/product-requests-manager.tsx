'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useShopStore } from '@/stores/shop-store';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  PackagePlus,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  MessageSquare,
  Filter,
  ThumbsUp,
  Plus,
  Ban,
  Search,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface ProductRequest {
  id: string;
  telegramId: string;
  name: string;
  description: string | null;
  category: string | null;
  quantity: number | null;
  status: string;
  priority: number;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  byStatus: {
    new: number;
    reviewing: number;
    ordered: number;
    rejected: number;
  };
  popularRequests: ProductRequest[];
  recentRequests: ProductRequest[];
  topCategories: { name: string; count: number }[];
}

const STATUS_MAP: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  new: { label: 'Новый', color: 'text-blue-800', bgColor: 'bg-blue-100', borderColor: 'border-blue-300' },
  reviewing: { label: 'Рассмотренный', color: 'text-amber-800', bgColor: 'bg-amber-100', borderColor: 'border-amber-300' },
  ordered: { label: 'Добавленный', color: 'text-green-800', bgColor: 'bg-green-100', borderColor: 'border-green-300' },
  rejected: { label: 'Отклонённый', color: 'text-red-800', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
};

export function ProductRequestsManager() {
  const { setCurrentView } = useShopStore();
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState<ProductRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, requestsRes] = await Promise.all([
        fetch('/api/product-requests/stats'),
        fetch('/api/product-requests?limit=100'),
      ]);

      const statsData = await statsRes.json();
      const requestsData = await requestsRes.json();

      setStats(statsData);
      setRequests(Array.isArray(requestsData) ? requestsData : []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/product-requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        toast({ title: 'Статус обновлён' });
        fetchData();
      } else {
        toast({ title: 'Ошибка обновления', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({ title: 'Ошибка обновления', variant: 'destructive' });
    }
  };

  const handleSaveNote = async () => {
    if (!selectedRequest) return;

    try {
      const res = await fetch(`/api/product-requests/${selectedRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNote }),
      });

      if (res.ok) {
        toast({ title: 'Заметка сохранена' });
        fetchData();
      }
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const cfg = STATUS_MAP[status];
    if (!cfg) return <Badge variant="secondary">{status}</Badge>;
    return (
      <Badge className={cn(cfg.bgColor, cfg.color, cfg.borderColor, 'border hover:opacity-90')}>
        {cfg.label}
      </Badge>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <PackagePlus className="h-3 w-3" />;
      case 'reviewing': return <Eye className="h-3 w-3" />;
      case 'ordered': return <CheckCircle2 className="h-3 w-3" />;
      case 'rejected': return <Ban className="h-3 w-3" />;
      default: return null;
    }
  };

  const filteredRequests = activeTab === 'all'
    ? requests
    : requests.filter(r => r.status === activeTab);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => selectedRequest ? setSelectedRequest(null) : setCurrentView('admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Запросы товаров</h1>
              <p className="text-sm text-muted-foreground">
                {selectedRequest ? 'Детали запроса' : 'Популярные и последние запросы'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <div className="p-3 space-y-3">
          {loading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-xl border p-3 text-center space-y-2">
                    <Skeleton className="h-5 w-5 mx-auto rounded" />
                    <Skeleton className="h-7 w-12 mx-auto" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                ))}
              </div>
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ))}
            </div>
          ) : selectedRequest ? (
            /* Detail View */
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring' as const, stiffness: 300, damping: 30 }}
              className="space-y-4"
            >
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-lg">{selectedRequest.name}</h3>
                      {selectedRequest.category && (
                        <p className="text-sm text-muted-foreground">{selectedRequest.category}</p>
                      )}
                    </div>
                    {getStatusBadge(selectedRequest.status)}
                  </div>

                  {selectedRequest.description && (
                    <div>
                      <p className="text-sm font-medium mb-1">Описание:</p>
                      <p className="text-sm text-muted-foreground">{selectedRequest.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Количество:</span>{' '}
                      <span className="font-medium">{selectedRequest.quantity || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Приоритет:</span>{' '}
                      <span className="font-medium">{selectedRequest.priority}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Telegram ID:</span>{' '}
                      <span className="font-mono text-xs">{selectedRequest.telegramId}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Создан:</span>{' '}
                      <span>{new Date(selectedRequest.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    {selectedRequest.status === 'new' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(selectedRequest.id, 'reviewing')}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Рассмотрен
                      </Button>
                    )}
                    {(selectedRequest.status === 'new' || selectedRequest.status === 'reviewing') && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(selectedRequest.id, 'ordered')}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Добавить товар
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleStatusChange(selectedRequest.id, 'rejected')}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Отклонить
                        </Button>
                      </>
                    )}
                    {selectedRequest.status === 'rejected' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(selectedRequest.id, 'new')}
                      >
                        Вернуть в новые
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Изменить статус</Label>
                    <Select
                      value={selectedRequest.status}
                      onValueChange={(v) => handleStatusChange(selectedRequest.id, v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Новый</SelectItem>
                        <SelectItem value="reviewing">Рассмотренный</SelectItem>
                        <SelectItem value="ordered">Добавленный</SelectItem>
                        <SelectItem value="rejected">Отклонённый</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Заметка администратора</Label>
                    <Textarea
                      value={adminNote || selectedRequest.adminNote || ''}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Внутренняя заметка..."
                      rows={3}
                    />
                    <Button size="sm" onClick={handleSaveNote}>
                      Сохранить заметку
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <>
              {/* Stats Cards */}
              {stats?.byStatus && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: 0 }}
                  >
                    <Card>
                      <CardContent className="p-3 text-center min-w-0">
                        <MessageSquare className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-2xl font-bold">{stats.total}</p>
                        <p className="text-xs text-muted-foreground truncate">Всего</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: 0.05 }}
                  >
                    <Card className="border-blue-200 dark:border-blue-800">
                      <CardContent className="p-3 text-center min-w-0">
                        <PackagePlus className="h-5 w-5 mx-auto mb-2 text-blue-500" />
                        <p className="text-2xl font-bold">{stats.byStatus.new}</p>
                        <p className="text-xs text-muted-foreground truncate">Новых</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: 0.1 }}
                  >
                    <Card className="border-green-200 dark:border-green-800">
                      <CardContent className="p-3 text-center min-w-0">
                        <TrendingUp className="h-5 w-5 mx-auto mb-2 text-green-500" />
                        <p className="text-2xl font-bold">{stats.byStatus.ordered}</p>
                        <p className="text-xs text-muted-foreground truncate">Добавлено</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: 0.15 }}
                  >
                    <Card className="border-amber-200 dark:border-amber-800">
                      <CardContent className="p-3 text-center min-w-0">
                        <Clock className="h-5 w-5 mx-auto mb-2 text-amber-500" />
                        <p className="text-2xl font-bold">{stats.byStatus.reviewing}</p>
                        <p className="text-xs text-muted-foreground truncate">На проверке</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>
              )}

              {/* Popular Requests */}
              {stats?.popularRequests && stats.popularRequests.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring' as const, stiffness: 300, damping: 25, delay: 0.2 }}
                >
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Популярные запросы
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {stats.popularRequests.map((req, idx) => (
                          <motion.div
                            key={req.id}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: idx * 0.06 }}
                            className="flex items-center justify-between p-2 rounded-xl bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => {
                              setSelectedRequest(req);
                              setAdminNote(req.adminNote || '');
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-muted-foreground">#{idx + 1}</span>
                              <div>
                                <p className="font-medium text-sm">{req.name}</p>
                                {req.category && (
                                  <p className="text-xs text-muted-foreground">{req.category}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono">
                                <ThumbsUp className="h-3 w-3 mr-1" />
                                {req.priority}
                              </Badge>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Filter Tabs + Request List */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring' as const, stiffness: 300, damping: 25, delay: 0.3 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Последние запросы
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">
                        {filteredRequests.length} из {requests.length}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="w-full grid grid-cols-5 mb-4">
                        <TabsTrigger value="all" className="text-xs">
                          Все
                        </TabsTrigger>
                        <TabsTrigger value="new" className="text-xs flex items-center gap-1">
                          <PackagePlus className="h-3 w-3" />
                          Новые
                        </TabsTrigger>
                        <TabsTrigger value="reviewing" className="text-xs flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          Рассмотр.
                        </TabsTrigger>
                        <TabsTrigger value="ordered" className="text-xs flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Добавл.
                        </TabsTrigger>
                        <TabsTrigger value="rejected" className="text-xs flex items-center gap-1">
                          <Ban className="h-3 w-3" />
                          Отклон.
                        </TabsTrigger>
                      </TabsList>

                      {filteredRequests.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <PackagePlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Нет запросов</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <AnimatePresence mode="popLayout">
                            {filteredRequests.map((req, index) => (
                              <motion.div
                                key={req.id}
                                layout
                                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: index * 0.03 }}
                                className="flex items-center justify-between p-3 rounded-xl border cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => {
                                  setSelectedRequest(req);
                                  setAdminNote(req.adminNote || '');
                                }}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium truncate">{req.name}</p>
                                    {req.priority > 1 && (
                                      <span className="text-amber-500 flex items-center" title={`Приоритет: ${req.priority}`}>
                                        <ThumbsUp className="h-3 w-3" />
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                    {req.category && <span>{req.category}</span>}
                                    <span>{new Date(req.createdAt).toLocaleDateString('ru-RU')}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {/* Quick action icon buttons */}
                                  {req.status === 'new' && (
                                    <button
                                      className="p-1.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStatusChange(req.id, 'reviewing');
                                      }}
                                      title="Рассмотрен"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {(req.status === 'new' || req.status === 'reviewing') && (
                                    <>
                                      <button
                                        className="p-1.5 rounded-md hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusChange(req.id, 'ordered');
                                        }}
                                        title="Добавить"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStatusChange(req.id, 'rejected');
                                        }}
                                        title="Отклонить"
                                      >
                                        <Ban className="h-3.5 w-3.5" />
                                      </button>
                                    </>
                                  )}
                                  {/* Status dot */}
                                  <span className={cn(
                                    'h-2.5 w-2.5 rounded-full shrink-0',
                                    req.status === 'new' && 'bg-blue-500',
                                    req.status === 'reviewing' && 'bg-amber-500',
                                    req.status === 'ordered' && 'bg-green-500',
                                    req.status === 'rejected' && 'bg-red-500',
                                  )} title={STATUS_MAP[req.status]?.label || req.status} />
                                  {/* Priority star */}
                                  {req.priority > 1 && (
                                    <span className="text-amber-500" title={`Приоритет: ${req.priority}`}>
                                      <ThumbsUp className="h-3 w-3" />
                                    </span>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </Tabs>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Top Categories */}
              {stats?.topCategories && stats.topCategories.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring' as const, stiffness: 300, damping: 25, delay: 0.4 }}
                >
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Популярные категории
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {stats.topCategories.map((cat) => (
                          <Badge key={cat.name} variant="secondary" className="text-sm">
                            {cat.name} ({cat.count})
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
