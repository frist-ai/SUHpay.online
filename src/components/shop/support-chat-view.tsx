'use client';

import { useState, useEffect, useRef } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Send,
  Loader2,
  Headphones,
  RefreshCw,
  Check,
  CheckCheck,
  AlertCircle,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticFeedback } from '@/lib/telegram';

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
  } | null;
}

interface ChatRoom {
  id: string;
  userId: string;
  status: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadByUser: number;
  unreadByAdmin: number;
  messages: ChatMessage[];
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    photoUrl: string | null;
  };
}

export function SupportChatView() {
  const { user, setCurrentView, isAdmin } = useShopStore();
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingChat, setDeletingChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Состояние анимации кнопки обновления
  const [refreshing, setRefreshing] = useState(false);

  // Fetch chat room
  const fetchRoom = async () => {
    if (!user?.id) return;

    try {
      const res = await fetch('/api/chat', {
        headers: {
          'x-user-id': user.id,
          'x-user-role': user.role,
        },
      });

      const data = await res.json();
      
      if (res.ok && data.room) {
        setRoom(data.room);
        setMessages(data.room.messages || []);
        setError(null);
      } else if (res.status === 503) {
        setError(data.error || 'Чат временно недоступен');
      }
    } catch (error) {
      console.error('Error fetching chat room:', error);
      setError('Ошибка загрузки чата');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoom();
    
    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchRoom, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSend = async () => {
    if (!message.trim() || sending || !user?.id) return;

    hapticFeedback('light');
    setSending(true);
    setError(null);
    
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
          'x-user-role': user.role,
        },
        body: JSON.stringify({ content: message.trim() }),
      });

      const data = await res.json();
      
      if (res.ok && data.message) {
        setMessages(prev => [...prev, data.message]);
        setMessage('');
        inputRef.current?.focus();
      } else {
        setError(data.error || 'Не удалось отправить сообщение');
        hapticFeedback('rigid');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Ошибка отправки сообщения');
      hapticFeedback('heavy');
    } finally {
      setSending(false);
    }
  };

  // Delete message
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
      } else {
        const data = await res.json();
        setError(data.error || 'Не удалось удалить сообщение');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      setError('Ошибка удаления сообщения');
    } finally {
      setDeletingId(null);
    }
  };

  // Delete entire chat
  const handleDeleteChat = async () => {
    if (!user?.id || deletingChat || messages.length === 0) return;

    hapticFeedback('light');
    setDeletingChat(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'DELETE',
        headers: {
          'x-user-id': user.id,
          'x-user-role': user.role,
        },
      });

      if (res.ok) {
        setRoom(null);
        setMessages([]);
      } else {
        const data = await res.json();
        setError(data.error || 'Не удалось удалить чат');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      setError('Ошибка удаления чата');
    } finally {
      setDeletingChat(false);
    }
  };

  // Format time
  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
    });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { date: string; messages: ChatMessage[] }[], msg) => {
    const date = formatDate(msg.createdAt);
    const existingGroup = groups.find(g => g.date === date);
    if (existingGroup) {
      existingGroup.messages.push(msg);
    } else {
      groups.push({ date, messages: [msg] });
    }
    return groups;
  }, []);

  // Get sender initials
  const getInitials = (msg: ChatMessage) => {
    const sender = msg.sender;
    if (!sender) {
      return msg.senderId === user?.id ? 'В' : 'А';
    }
    if (sender.firstName && sender.lastName) {
      return `${sender.firstName[0]}${sender.lastName[0]}`.toUpperCase();
    }
    if (sender.firstName) return sender.firstName[0].toUpperCase();
    return sender.role === 'admin' ? 'А' : 'П';
  };

  // Get sender name
  const getSenderName = (msg: ChatMessage) => {
    const sender = msg.sender;
    if (!sender) {
      return msg.senderId === user?.id ? 'Вы' : 'Администратор';
    }
    if (sender.firstName) {
      return [sender.firstName, sender.lastName].filter(Boolean).join(' ');
    }
    return sender.role === 'admin' ? 'Администратор' : 'Вы';
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0">
        <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentView('profile')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Поддержка</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCurrentView('profile')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 rounded-full bg-primary/10">
            <Headphones className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Поддержка</h1>
            <p className="text-xs text-muted-foreground">
              Обычно отвечаем в течение часа
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Обновить чат"
          onClick={async () => {
            hapticFeedback('light');
            setRefreshing(true);
            await fetchRoom();
            setTimeout(() => setRefreshing(false), 600);
          }}
        >
          <RefreshCw className={cn('h-5 w-5', refreshing && 'animate-spin')} />
        </Button>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Удалить чат"
            onClick={handleDeleteChat}
            disabled={deletingChat}
          >
            {deletingChat ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Trash2 className="h-5 w-5 text-muted-foreground" />
            )}
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Error message */}
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-xl p-3 flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {messages.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Headphones className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Добро пожаловать!</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Напишите нам, если у вас есть вопросы по заказам, доставке или работе магазина.
              Мы с радостью поможем!
            </p>
          </div>
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
              {group.messages.map((msg, index) => {
                const isOwn = msg.senderId === user?.id;
                const showAvatar = index === 0 || group.messages[index - 1]?.senderId !== msg.senderId;
                const sender = msg.sender; // Can be null
                const canDelete = isOwn || isAdmin;
                const isDeleting = deletingId === msg.id;
                
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'group flex items-end gap-2 mb-1',
                      isOwn ? 'flex-row-reverse' : 'flex-row'
                    )}
                  >
                    {/* Avatar */}
                    {showAvatar ? (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={sender?.photoUrl || undefined} />
                        <AvatarFallback className={cn(
                          'text-xs',
                          sender?.role === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        )}>
                          {sender ? getInitials(msg) : (isOwn ? 'В' : 'А')}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="w-8 flex-shrink-0" />
                    )}

                    {/* Message bubble */}
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-3 py-2 relative',
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-muted rounded-bl-sm'
                      )}
                    >
                      {!isOwn && showAvatar && sender && (
                        <p className="text-xs font-medium text-primary mb-1">
                          {getSenderName(msg)}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                      <div className={cn(
                        'flex items-center gap-1 justify-end mt-1',
                        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      )}>
                        <span className="text-[10px]">
                          {formatTime(msg.createdAt)}
                        </span>
                        {isOwn && (
                          msg.isRead ? (
                            <CheckCheck className="h-3 w-3" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )
                        )}
                      </div>
                      
                      {/* Delete button */}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity',
                            isDeleting && 'opacity-100'
                          )}
                          onClick={() => handleDeleteMessage(msg.id)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t p-4 bg-background safe-area-bottom mb-14">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Напишите сообщение..."
            disabled={sending}
            maxLength={500}
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!message.trim() || sending}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className={cn(
          'text-xs text-right mt-1 transition-colors',
          message.length > 450
            ? 'text-destructive font-medium'
            : 'text-muted-foreground'
        )}>
          {message.length}/500
        </p>
      </div>
    </div>
  );
}
