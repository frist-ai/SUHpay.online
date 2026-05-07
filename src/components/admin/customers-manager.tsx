'use client';

import { useState, useEffect, useMemo } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import {
  Users,
  UserCheck,
  ShoppingCart,
  UserX,
  ArrowLeft,
  Search,
  Phone,
  Calendar,
  Banknote,
  Package,
  Ban,
  MessageCircle,
  Send,
  RefreshCw,
  Star,
  UserPlus,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Customer {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  photoUrl: string | null;
  role: string;
  loyaltyPoints: number;
  isActive: boolean;
  blockedAt: string | null;
  lastVisitAt: string | null;
  createdAt: string;
  ordersCount: number;
  totalSpent: number;
}

interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  items: { productName: string; quantity: number; price: number }[];
}


type FilterType = 'all' | 'new' | 'withOrders' | 'noOrders';

const filterTabs: { key: FilterType; label: string; icon: typeof Users; color: string }[] = [
  { key: 'all', label: 'Все', icon: Users, color: 'text-blue-500' },
  { key: 'new', label: 'Новые', icon: UserPlus, color: 'text-green-500' },
  { key: 'withOrders', label: 'С заказами', icon: ShoppingCart, color: 'text-purple-500' },
  { key: 'noOrders', label: 'Без заказов', icon: UserX, color: 'text-gray-500' },
];

export function CustomersManager() {
  const { setCurrentView } = useShopStore();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [checkingBlocked, setCheckingBlocked] = useState(false);
  // Sort removed — default ordering by date

  // Customer detail dialog
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Debounced search
  const [searchDebounced, setSearchDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchCustomers();
  }, [activeFilter, searchDebounced]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('filter', 'all');
      params.set('limit', '200');
      if (searchDebounced) params.set('search', searchDebounced);

      const res = await fetch(`/api/customers?${params}`);
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Apply client-side filters and sorting
  const filteredCustomers = useMemo(() => {
    let list = [...customers];

    // Apply filter
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (activeFilter === 'new') {
      list = list.filter(c => new Date(c.createdAt) >= sevenDaysAgo);
    } else if (activeFilter === 'withOrders') {
      list = list.filter(c => c.ordersCount > 0);
    } else if (activeFilter === 'noOrders') {
      list = list.filter(c => c.ordersCount === 0);
    }

    // Apply search (double-check, since API also filters)
    if (searchDebounced) {
      const q = searchDebounced.toLowerCase();
      list = list.filter(c =>
        (c.firstName?.toLowerCase().includes(q)) ||
        (c.lastName?.toLowerCase().includes(q)) ||
        (c.username?.toLowerCase().includes(q)) ||
        (c.phone?.includes(searchDebounced))
      );
    }

    // Sort by date (default)
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return list;
  }, [customers, activeFilter, searchDebounced]);

  // Filter counts
  const filterCounts = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      all: customers.length,
      new: customers.filter(c => new Date(c.createdAt) >= sevenDaysAgo).length,
      withOrders: customers.filter(c => c.ordersCount > 0).length,
      noOrders: customers.filter(c => c.ordersCount === 0).length,
    };
  }, [customers]);

  const getDisplayName = (customer: Customer) => {
    const parts = [customer.firstName, customer.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : customer.username || 'Без имени';
  };

  const getInitials = (customer: Customer) => {
    if (customer.firstName && customer.lastName) {
      return `${customer.firstName[0]}${customer.lastName[0]}`.toUpperCase();
    }
    if (customer.firstName) return customer.firstName[0].toUpperCase();
    if (customer.username) return customer.username[0].toUpperCase();
    return '?';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatMoney = (amount: number) => {
    return amount.toLocaleString('ru-RU') + ' ₽';
  };

  const openTelegramChat = (customer: Customer) => {
    if (customer.username) {
      window.open(`https://t.me/${customer.username}`, '_blank');
    } else if (customer.telegramId) {
      window.open(`tg://openmessage?user_id=${customer.telegramId}`, '_blank');
    }
  };

  const [checkingSingle, setCheckingSingle] = useState<string | null>(null);

  const checkBlockedStatus = async (customer: Customer) => {
    setCheckingSingle(customer.id);
    try {
      const res = await fetch(`/api/customers/check-blocked`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: customer.telegramId }),
      });

      const data = await res.json();

      if (data.blocked) {
        toast({
          title: 'Пользователь заблокировал бота',
          description: getDisplayName(customer),
          variant: 'destructive',
        });
        fetchCustomers();
      } else {
        if (customer.blockedAt) {
          toast({
            title: 'Пользователь разблокировал бота! ✓',
            description: `${getDisplayName(customer)} снова активен`,
          });
        } else {
          toast({
            title: 'Пользователь активен',
            description: getDisplayName(customer),
          });
        }
        fetchCustomers();
      }
      setCheckingSingle(null);

      return data;
    } catch (error) {
      console.error('Error checking blocked status:', error);
      toast({
        title: 'Ошибка проверки',
        description: 'Не удалось проверить статус',
        variant: 'destructive',
      });
      setCheckingSingle(null);
    }
  };

  const checkAllBlocked = async () => {
    setCheckingBlocked(true);
    try {
      const res = await fetch('/api/customers/check-blocked', {
        method: 'GET',
      });
      const data = await res.json();
      toast({
        title: 'Проверка завершена',
        description: `Проверено: ${data.checked}, Заблокировали: ${data.blocked}`,
      });
      fetchCustomers();
    } catch (error) {
      console.error('Error in bulk check:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось выполнить проверку',
        variant: 'destructive',
      });
    } finally {
      setCheckingBlocked(false);
    }
  };

  // Open customer detail dialog
  const openCustomerDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setDialogOpen(true);
    setLoadingOrders(true);
    try {
      // Fetch orders for this customer
      const initData = useShopStore.getState().initData;
      const headers: Record<string, string> = {};
      if (initData) headers['X-Telegram-Init-Data'] = initData;

      const res = await fetch(`/api/orders?userId=${customer.id}&limit=50`, { headers });
      const data = await res.json();
      setCustomerOrders(data.orders || []);
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      setCustomerOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const statusLabels: Record<string, string> = {
    pending: 'Ожидает',
    processing: 'В обработке',
    confirmed: 'Подтверждён',
    shipped: 'Отправлен',
    delivered: 'Доставлен',
    completed: 'Выполнен',
    cancelled: 'Отменён',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-3">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView('admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Клиенты</h1>
            <p className="text-sm text-muted-foreground">
              Управление клиентской базой
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={checkAllBlocked}
            disabled={checkingBlocked}
            title="Проверить кто заблокировал бота"
          >
            {checkingBlocked ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Проверить</span>
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени, username или телефону..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="shrink-0 px-4 py-2 border-b overflow-x-auto">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-2 flex-1 min-w-0">
            {filterTabs.map((tab) => {
              const Icon = tab.icon;
              const count = filterCounts[tab.key];
              const isActive = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  <Icon className={cn('h-4 w-4', !isActive && tab.color)} />
                  {tab.label}
                  <span className={cn(
                    'ml-1 text-xs px-1.5 py-0.5 rounded-full',
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted-foreground/10 text-muted-foreground'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* Customer List */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <div className="p-3 pt-2 space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              {activeFilter === 'new' ? (
                <>
                  <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                  <p className="text-muted-foreground font-medium">Нет новых клиентов</p>
                  <p className="text-xs text-muted-foreground mt-1">За последние 7 дней никто не зарегистрировался</p>
                </>
              ) : activeFilter === 'withOrders' ? (
                <>
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                  <p className="text-muted-foreground font-medium">Нет клиентов с заказами</p>
                  <p className="text-xs text-muted-foreground mt-1">Ещё никто не делал заказы</p>
                </>
              ) : activeFilter === 'noOrders' ? (
                <>
                  <UserX className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                  <p className="text-muted-foreground font-medium">Нет клиентов без заказов</p>
                  <p className="text-xs text-muted-foreground mt-1">У всех клиентов есть хотя бы один заказ</p>
                </>
              ) : searchDebounced ? (
                <>
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                  <p className="text-muted-foreground font-medium">Клиенты не найдены</p>
                  <p className="text-xs text-muted-foreground mt-1">Попробуйте другой запрос</p>
                </>
              ) : (
                <>
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                  <p className="text-muted-foreground font-medium">Нет клиентов</p>
                  <p className="text-xs text-muted-foreground mt-1">Клиенты появятся после первой регистрации</p>
                </>
              )}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredCustomers.map((customer) => (
                <motion.div
                  key={customer.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring' as const, stiffness: 500, damping: 35 }}
                >
                  <div
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer hover:bg-muted/50 border-b last:border-b-0',
                      customer.blockedAt && 'opacity-60'
                    )}
                    onClick={() => openCustomerDetail(customer)}
                  >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={customer.photoUrl || undefined} />
                          <AvatarFallback className="text-sm font-medium bg-muted">
                            {getInitials(customer)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">
                              {getDisplayName(customer)}
                            </p>
                            {customer.blockedAt && (
                              <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                                <Ban className="h-3 w-3 mr-0.5" />
                                Заблокирован
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            {customer.username && (
                              <span>@{customer.username}</span>
                            )}
                            {customer.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {customer.phone}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {formatDate(customer.createdAt)}
                            </span>
                            {customer.ordersCount > 0 && (
                              <Badge className="text-[10px] py-0 px-1.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                <ShoppingCart className="h-3 w-3 mr-0.5" />
                                {customer.ordersCount}
                              </Badge>
                            )}
                            {customer.totalSpent > 0 && (
                              <Badge className="text-[10px] py-0 px-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <Banknote className="h-3 w-3 mr-0.5" />
                                {formatMoney(customer.totalSpent)}
                              </Badge>
                            )}
                            {customer.loyaltyPoints > 0 && (
                              <Badge className="text-[10px] py-0 px-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                <Star className="h-3 w-3 mr-0.5" />
                                {customer.loyaltyPoints}
                              </Badge>
                            )}
                          </div>
                        </div>


                      </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Customer Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedCustomer && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedCustomer.photoUrl || undefined} />
                    <AvatarFallback className="text-base font-medium bg-muted">
                      {getInitials(selectedCustomer)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle>{getDisplayName(selectedCustomer)}</DialogTitle>
                    <DialogDescription>
                      {selectedCustomer.username && `@${selectedCustomer.username}`}
                      {selectedCustomer.username && selectedCustomer.phone && ' · '}
                      {selectedCustomer.phone}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4">
                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold">{selectedCustomer.ordersCount}</p>
                    <p className="text-[10px] text-muted-foreground">Заказов</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold">{formatMoney(selectedCustomer.totalSpent)}</p>
                    <p className="text-[10px] text-muted-foreground">Потрачено</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-lg font-bold flex items-center justify-center gap-1">
                      <Star className="h-4 w-4 text-amber-500" />
                      {selectedCustomer.loyaltyPoints}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Бонусов</p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Регистрация
                    </span>
                    <span className="font-medium">{formatDate(selectedCustomer.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Последний визит
                    </span>
                    <span className="font-medium">{formatDate(selectedCustomer.lastVisitAt)}</span>
                  </div>
                  {selectedCustomer.phone && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" />
                        Телефон
                      </span>
                      <span className="font-medium">{selectedCustomer.phone}</span>
                    </div>
                  )}
                  {selectedCustomer.telegramId && (
                    <div className="flex items-center justify-between py-1.5 border-b">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Send className="h-3.5 w-3.5" />
                        Telegram ID
                      </span>
                      <span className="font-medium font-mono text-xs">{selectedCustomer.telegramId}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-1.5 border-b">
                    <span className="text-muted-foreground">Роль</span>
                    <Badge variant="secondary" className="text-xs">{selectedCustomer.role}</Badge>
                  </div>
                  {selectedCustomer.blockedAt && (
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-muted-foreground">Заблокирован</span>
                      <Badge variant="destructive" className="text-xs">
                        <Ban className="h-3 w-3 mr-1" />
                        {formatDate(selectedCustomer.blockedAt)}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => openTelegramChat(selectedCustomer)}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Написать
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => checkBlockedStatus(selectedCustomer)}
                    disabled={checkingSingle === selectedCustomer.id}
                  >
                    <RefreshCw className={cn('h-4 w-4 mr-2', checkingSingle === selectedCustomer.id && 'animate-spin')} />
                    Проверить
                  </Button>
                </div>

                {/* Order History */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Package className="h-4 w-4" />
                    История заказов
                  </h3>
                  {loadingOrders ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-16 rounded-lg" />
                      ))}
                    </div>
                  ) : customerOrders.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Нет заказов</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {customerOrders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">#{order.orderNumber}</span>
                              <Badge className={cn('text-[10px] py-0 px-1.5', statusColors[order.status] || 'bg-gray-100 text-gray-800')}>
                                {statusLabels[order.status] || order.status}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground mt-0.5">
                              {formatDate(order.createdAt)} · {order.items?.length || 0} товар(ов)
                            </p>
                          </div>
                          <span className="font-semibold whitespace-nowrap ml-2">
                            {formatMoney(order.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
