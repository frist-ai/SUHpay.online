'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  Loader2,
  MessageSquare,
  RefreshCw,
  Check,
  CheckCheck,
  Phone,
  X,
  Trash2,
  Search,
  Filter,
  Zap,
  ShoppingBag,
  Star,
  Calendar,
  User,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { hapticFeedback } from '@/lib/telegram';
import { useToast } from '@/hooks/use-toast';

// ─── Quick Reply Templates ──────────────────────────────────────────────────

const quickReplies = [
  { label: 'Привет!', text: 'Здравствуйте! Чем можем помочь?' },
  { label: 'Скоро ответим', text: 'Спасибо за обращение! Мы скоро вам ответим.' },
  { label: 'Время доставки', text: 'Доставка обычно занимает 1-3 рабочих дня.' },
  { label: 'Возврат', text: 'Для оформления возврата напишите номер заказа и причину.' },
  { label: 'Оплата получена', text: 'Оплата получена, заказ передан в обработку.' },
  { label: 'Спасибо!', text: 'Спасибо за покупку! Будем рады видеть вас снова.' },
];

// ─── Filter Tabs ────────────────────────────────────────────────────────────

type ChatFilter = 'all' | 'unread';

const chatFilters: { key: ChatFilter; label: string }[] = [
  { key: 'all', label: 'Все чаты' },
  { key: 'unread', label: 'Непрочитанные' },
];

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  type: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  sender: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    photoUrl: string | null;
    role: string;
  };
}

interface ChatRoom {
  id: string;
  userId: string;
  status: string;
  subject: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadByUser: number;
  unreadByAdmin: number;
  createdAt: string;
  user: {
    id: string;
    telegramId: string;
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    photoUrl: string | null;
    phone: string | null;
  };
  messages?: ChatMessage[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

const formatLastMessageTime = (date: string | null) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return formatTime(date);
  if (days === 1) return 'Вчера';
  if (days < 7) return `${days} дн. назад`;
  return formatDate(date);
};

const getUserInitials = (room: ChatRoom) => {
  if (room.user.firstName && room.user.lastName) {
    return `${room.user.firstName[0]}${room.user.lastName[0]}`.toUpperCase();
  }
  if (room.user.firstName) return room.user.firstName[0].toUpperCase();
  if (room.user.username) return room.user.username[0].toUpperCase();
  return 'П';
};

const getUserName = (room: ChatRoom) => {
  if (room.user.firstName) {
    return [room.user.firstName, room.user.lastName].filter(Boolean).join(' ');
  }
  return room.user.username || `Пользователь ${room.user.telegramId}`;
};

const getInitials = (msg: ChatMessage) => {
  if (msg.sender.firstName && msg.sender.lastName) {
    return `${msg.sender.firstName[0]}${msg.sender.lastName[0]}`.toUpperCase();
  }
  if (msg.sender.firstName) return msg.sender.firstName[0].toUpperCase();
  return msg.sender.role === 'admin' ? 'А' : 'П';
};

const getSenderName = (msg: ChatMessage) => {
  if (msg.sender.firstName) {
    return [msg.sender.firstName, msg.sender.lastName].filter(Boolean).join(' ');
  }
  return msg.sender.role === 'admin' ? 'Администратор' : 'Клиент';
};

// ─── Unread Pulse Badge ─────────────────────────────────────────────────────

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="relative flex h-5 min-w-5 items-center justify-center">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-40" />
      <span className="relative inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 h-5 min-w-5">
        {count > 99 ? '99+' : count}
      </span>
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ChatManager() {
  const { user, setCurrentView } = useShopStore();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'chat'>('list');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [customerProfileOpen, setCustomerProfileOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevUnreadCount = useRef(-1);
  const { toast } = useToast();

  // ─── Data fetching ──────────────────────────────────────────────────────

  const [refreshing, setRefreshing] = useState(false);

  const fetchRooms = async () => {
    if (!user?.id || user.role !== 'admin') return;
    try {
      const res = await fetch('/api/admin/chat?status=all', {
        headers: { 'x-user-id': user.id, 'x-user-role': user.role },
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms);

        // Check for new unread messages and notify
        const newUnreadCount = data.rooms.filter((r: ChatRoom) => r.unreadByAdmin > 0).length;
        if (prevUnreadCount.current >= 0 && newUnreadCount > prevUnreadCount.current) {
          const diff = newUnreadCount - prevUnreadCount.current;
          toast({
            title: `💬 Новое сообщение${diff > 1 ? ` (${diff})` : ''}`,
            description: 'Клиент написал в поддержку',
          });

          // Also try browser notification if permission granted
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`Новое сообщение${diff > 1 ? ` (${diff})` : ''}`, {
                body: 'Клиент написал в поддержку',
              });
            } catch {
              // Ignore notification errors
            }
          }
        }
        prevUnreadCount.current = newUnreadCount;
      }
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoom = async (roomId: string) => {
    if (!user?.id || user.role !== 'admin') return;
    try {
      const res = await fetch(`/api/admin/chat/${roomId}`, {
        headers: { 'x-user-id': user.id, 'x-user-role': user.role },
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRoom(data.room);
        setMessages(data.room.messages || []);
      }
    } catch (error) {
      console.error('Error fetching room:', error);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Request browser notification permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {
        // Ignore permission request errors
      });
    }
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      const interval = setInterval(() => fetchRoom(selectedRoom.id), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedRoom?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Filtered rooms ─────────────────────────────────────────────────────

  const filteredRooms = useMemo(() => {
    let result = rooms;

    if (chatFilter === 'unread') {
      result = result.filter(r => r.unreadByAdmin > 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => {
        const name = getUserName(r).toLowerCase();
        const username = r.user.username?.toLowerCase() || '';
        return name.includes(q) || username.includes(q);
      });
    }

    return result;
  }, [rooms, chatFilter, searchQuery]);

  const unreadCount = rooms.filter(r => r.unreadByAdmin > 0).length;

  // ─── Group messages by date ─────────────────────────────────────────────

  const groupedMessages = useMemo(
    () =>
      messages.reduce((groups: { date: string; messages: ChatMessage[] }[], msg) => {
        const date = formatDate(msg.createdAt);
        const existingGroup = groups.find(g => g.date === date);
        if (existingGroup) {
          existingGroup.messages.push(msg);
        } else {
          groups.push({ date, messages: [msg] });
        }
        return groups;
      }, []),
    [messages]
  );

  // ─── Handlers ───────────────────────────────────────────────────────────

  const openRoom = async (room: ChatRoom) => {
    hapticFeedback('light');
    await fetchRoom(room.id);
    setActiveTab('chat');
  };

  const closeRoom = () => {
    setSelectedRoom(null);
    setMessages([]);
    setActiveTab('list');
    setShowQuickReplies(false);
    fetchRooms();
  };

  const handleSend = async () => {
    if (!message.trim() || sending || !user?.id || !selectedRoom) return;
    hapticFeedback('light');
    setSending(true);
    try {
      const res = await fetch(`/api/admin/chat/${selectedRoom.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-role': user.role,
        },
        body: JSON.stringify({ content: message.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
        setMessage('');
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = (text: string) => {
    setMessage(text);
    setShowQuickReplies(false);
    inputRef.current?.focus();
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!user?.id || deletingId) return;
    hapticFeedback('light');
    setDeletingId(messageId);
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-role': user.role,
        },
        body: JSON.stringify({ messageId }),
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!user?.id || deletingRoomId) return;
    hapticFeedback('light');
    setDeletingRoomId(roomId);
    try {
      const res = await fetch(`/api/admin/chat/${roomId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': user.id, 'x-user-role': user.role },
      });
      if (res.ok) {
        setRooms(prev => prev.filter(r => r.id !== roomId));
        if (selectedRoom?.id === roomId) closeRoom();
      }
    } catch (error) {
      console.error('Error deleting chat room:', error);
    } finally {
      setDeletingRoomId(null);
    }
  };

  // ─── Loading State ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-3 flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-6 w-36" />
        </div>
        {/* Search + Filter skeleton */}
        <div className="shrink-0 p-3 space-y-2 border-b">
          <Skeleton className="h-9 w-full rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </div>
        {/* Room list skeleton */}
        <div className="flex-1 overflow-y-auto">
          <div className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-full p-4 flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-3.5 w-full max-w-[220px]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (activeTab === 'chat' && selectedRoom) {
              closeRoom();
            } else {
              setCurrentView('admin');
            }
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">
            {activeTab === 'chat' && selectedRoom ? (
              <button
                className="hover:underline underline-offset-2"
                onClick={() => setCustomerProfileOpen(true)}
              >
                {getUserName(selectedRoom)}
              </button>
            ) : 'Чат с клиентами'}
          </h1>
          {activeTab === 'chat' && selectedRoom?.user.phone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {selectedRoom.user.phone}
            </p>
          )}
        </div>
        {activeTab === 'list' && unreadCount > 0 && (
          <UnreadBadge count={unreadCount} />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={async () => {
            hapticFeedback('light');
            setRefreshing(true);
            if (activeTab === 'chat' && selectedRoom) {
              await fetchRoom(selectedRoom.id);
            } else {
              await fetchRooms();
            }
            setTimeout(() => setRefreshing(false), 600);
          }}
        >
          <RefreshCw className={cn('h-5 w-5', refreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Chat List View */}
      {activeTab === 'list' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Search + Filter Bar */}
          <div className="shrink-0 p-3 space-y-2 border-b">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по имени..."
                className="pl-9 h-9"
              />
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              {chatFilters.map(f => (
                <Button
                  key={f.key}
                  variant={chatFilter === f.key ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    hapticFeedback('light');
                    setChatFilter(f.key);
                  }}
                >
                  {f.key === 'unread' && <Filter className="h-3 w-3" />}
                  {f.label}
                  {f.key === 'unread' && unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">
                      {unreadCount}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>

          {/* Room List */}
          <div className="flex-1 overflow-y-auto">
            {filteredRooms.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                className="flex flex-col items-center justify-center h-full text-center p-4"
              >
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                  <MessageSquare className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  {chatFilter === 'unread' ? 'Нет непрочитанных' : 'Нет сообщений'}
                </h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                  {chatFilter === 'unread'
                    ? 'Все сообщения прочитаны'
                    : 'Когда клиенты напишут в поддержку, их чаты появятся здесь'}
                </p>
              </motion.div>
            ) : (
              <div className="divide-y">
                <AnimatePresence mode="popLayout">
                  {filteredRooms.map((room, index) => {
                    const isDeletingRoom = deletingRoomId === room.id;
                    return (
                      <motion.div
                        key={room.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          type: 'spring' as const,
                          stiffness: 400,
                          damping: 30,
                          delay: index * 0.03,
                        }}
                        className={cn(
                          'group w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors',
                          room.unreadByAdmin > 0 && 'bg-primary/5'
                        )}
                      >
                        <button
                          onClick={() => openRoom(room)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={room.user.photoUrl || undefined} />
                              <AvatarFallback className="bg-muted">
                                {getUserInitials(room)}
                              </AvatarFallback>
                            </Avatar>
                            {room.unreadByAdmin > 0 && (
                              <span className="absolute -top-1 -right-1">
                                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-50" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                              </span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={cn('truncate', room.unreadByAdmin > 0 ? 'font-semibold' : 'font-medium')}>
                                {getUserName(room)}
                              </p>
                              <span className={cn(
                                'text-xs flex-shrink-0',
                                room.unreadByAdmin > 0 ? 'text-red-500 font-medium' : 'text-muted-foreground'
                              )}>
                                {formatLastMessageTime(room.lastMessageAt)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <p className={cn(
                                'text-sm truncate',
                                room.unreadByAdmin > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'
                              )}>
                                {room.lastMessage || 'Нет сообщений'}
                              </p>
                              {room.unreadByAdmin > 0 && (
                                <UnreadBadge count={room.unreadByAdmin} />
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'h-8 w-8 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
                            isDeletingRoom && 'opacity-100'
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoom(room.id);
                          }}
                          disabled={isDeletingRoom}
                        >
                          {isDeletingRoom ? (
                            <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                          )}
                        </Button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Detail View */}
      {activeTab === 'chat' && selectedRoom && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                className="flex flex-col items-center justify-center h-full text-center p-4"
              >
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Начните диалог с клиентом
                </p>
              </motion.div>
            ) : (
              groupedMessages.map(group => (
                <div key={group.date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4">
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {group.date}
                    </Badge>
                  </div>

                  {/* Messages */}
                  <AnimatePresence mode="popLayout">
                    {group.messages.map((msg, index) => {
                      const isOwn = msg.senderId === user?.id;
                      const showAvatar = index === 0 || group.messages[index - 1]?.senderId !== msg.senderId;
                      const isDeleting = deletingId === msg.id;

                      return (
                        <motion.div
                          key={msg.id}
                          layout
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
                          className={cn(
                            'group flex items-end gap-2 mb-1.5',
                            isOwn ? 'flex-row-reverse' : 'flex-row'
                          )}
                        >
                          {/* Avatar */}
                          {showAvatar ? (
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarImage src={msg.sender.photoUrl || undefined} />
                              <AvatarFallback
                                className={cn(
                                  'text-xs',
                                  msg.sender.role === 'admin'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                )}
                              >
                                {getInitials(msg)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="w-8 flex-shrink-0" />
                          )}

                          {/* Message bubble */}
                          <div
                            className={cn(
                              'max-w-[75%] rounded-2xl px-3.5 py-2.5 relative',
                              isOwn
                                ? 'bg-primary text-primary-foreground rounded-br-sm'
                                : 'bg-muted rounded-bl-sm'
                            )}
                          >
                            {!isOwn && showAvatar && (
                              <p className="text-xs font-medium text-primary mb-1">
                                {getSenderName(msg)}
                              </p>
                            )}
                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                              {msg.content}
                            </p>
                            <div
                              className={cn(
                                'flex items-center gap-1 justify-end mt-1',
                                isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                              )}
                            >
                              <span className="text-[10px]">{formatTime(msg.createdAt)}</span>
                              {isOwn &&
                                (msg.isRead ? (
                                  <CheckCheck className="h-3 w-3" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                ))}
                            </div>

                            {/* Delete button */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity',
                                isDeleting && 'opacity-100'
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMessage(msg.id);
                              }}
                              disabled={isDeleting}
                            >
                              {isDeleting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies Panel */}
          <AnimatePresence>
            {showQuickReplies && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
                className="overflow-hidden border-t"
              >
                <div className="p-3 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium text-muted-foreground">Быстрые ответы</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {quickReplies.map(qr => (
                      <Button
                        key={qr.label}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleQuickReply(qr.text)}
                      >
                        {qr.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          <div className="shrink-0 border-t p-3 pb-14 bg-background">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2 items-end"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={() => {
                  hapticFeedback('light');
                  setShowQuickReplies(prev => !prev);
                }}
              >
                <Zap className={cn('h-4 w-4', showQuickReplies && 'text-amber-500')} />
              </Button>
              <Input
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Напишите ответ..."
                disabled={sending}
                className="flex-1 h-9"
              />
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                disabled={!message.trim() || sending}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Customer Profile Dialog */}
      <Dialog open={customerProfileOpen} onOpenChange={setCustomerProfileOpen}>
        <DialogContent className="sm:max-w-md">
          {selectedRoom && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedRoom.user.photoUrl || undefined} />
                    <AvatarFallback className="text-base font-medium bg-muted">
                      {getUserInitials(selectedRoom)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle>{getUserName(selectedRoom)}</DialogTitle>
                    <DialogDescription>
                      {selectedRoom.user.username && `@${selectedRoom.user.username}`}
                      {selectedRoom.user.phone && ` · ${selectedRoom.user.phone}`}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Telegram ID</p>
                    <p className="text-sm font-mono font-medium mt-0.5">{selectedRoom.user.telegramId}</p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">Статус</p>
                    <p className="text-sm font-medium mt-0.5">{selectedRoom.status === 'open' ? 'Активен' : selectedRoom.status}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Создан: {new Date(selectedRoom.createdAt).toLocaleDateString('ru-RU')}</span>
                </div>
                {selectedRoom.user.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <a href={`tel:${selectedRoom.user.phone}`} className="text-primary underline">{selectedRoom.user.phone}</a>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}