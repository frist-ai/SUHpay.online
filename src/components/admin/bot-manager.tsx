'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Bot,
  Settings,
  Link2,
  Terminal,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Send,
  Command,
  ArrowLeft,
  Users,
  UserPlus,
  Trash2,
  Shield,
} from 'lucide-react';
import { useShopStore } from '@/stores/shop-store';
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

interface BotInfo {
  configured: boolean;
  message?: string;
  error?: string;
  webhookSecretConfigured?: boolean;
  bot?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
    can_join_groups: boolean;
    can_read_all_group_messages: boolean;
    supports_inline_queries: boolean;
  };
  webhook?: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  };
  commands?: Array<{
    command: string;
    description: string;
  }>;
}

interface AdminIdsResponse {
  adminIds: string[];
  envAdminIds: string[];
  dbAdminIds: string[];
}

interface BotManagerProps {
  embedded?: boolean;
}

export function BotManager({ embedded = false }: BotManagerProps) {
  const { toast } = useToast();
  const { setCurrentView, user, initData } = useShopStore();
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [webAppUrl, setWebAppUrl] = useState('');
  const [testChatId, setTestChatId] = useState('');
  const [testMessage, setTestMessage] = useState('🛒 Добро пожаловать в магазин!');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteWebhookConfirmOpen, setDeleteWebhookConfirmOpen] = useState(false);
  
  // Admin management state
  const [adminIds, setAdminIds] = useState<AdminIdsResponse | null>(null);
  const [newAdminId, setNewAdminId] = useState('');
  const [removeAdminId, setRemoveAdminId] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    loadBotInfo();
    loadAdminIds();
  }, []);

  const loadBotInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/telegram-bot');
      const data = await res.json();
      setBotInfo(data);
      
      // Set default web app URL based on current location
      if (typeof window !== 'undefined') {
        const baseUrl = window.location.origin;
        setWebAppUrl(baseUrl);
      }
    } catch (error) {
      console.error('Error loading bot info:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminIds = async () => {
    if (!initData) return;
    
    try {
      const res = await fetch(`/api/admin-ids?initData=${encodeURIComponent(initData)}`);
      if (res.ok) {
        const data = await res.json();
        setAdminIds(data);
      }
    } catch (error) {
      console.error('Error loading admin IDs:', error);
    }
  };

  const handleAddAdmin = async () => {
    if (!initData || !newAdminId.trim()) return;
    
    // Validate numeric ID
    if (!/^\d+$/.test(newAdminId.trim())) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Telegram ID должен содержать только цифры',
      });
      return;
    }
    
    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin-ids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, newAdminId: newAdminId.trim() }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: 'Успешно',
          description: `ID ${newAdminId} добавлен в администраторы`,
        });
        setNewAdminId('');
        loadAdminIds();
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: data.error || 'Не удалось добавить администратора',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось добавить администратора',
      });
    } finally {
      setAdminLoading(false);
    }
  };

  const handleRemoveAdmin = async () => {
    if (!initData || !removeAdminId) return;
    
    setAdminLoading(true);
    try {
      const res = await fetch('/api/admin-ids', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, removeAdminId }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: 'Успешно',
          description: `ID ${removeAdminId} удалён из администраторов`,
        });
        setRemoveAdminId(null);
        loadAdminIds();
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: data.error || 'Не удалось удалить администратора',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось удалить администратора',
      });
    } finally {
      setAdminLoading(false);
    }
  };

  const handleSetCommands = async () => {
    setActionLoading('commands');
    try {
      const res = await fetch('/api/telegram-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setCommands' }),
      });
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: 'Успешно',
          description: 'Команды бота обновлены',
        });
        loadBotInfo();
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: data.message || data.error,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось обновить команды',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetWebhook = async () => {
    if (!webAppUrl) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Укажите URL для Web App',
      });
      return;
    }

    setActionLoading('webhook');
    try {
      const res = await fetch('/api/telegram-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'setWebhook',
          webAppUrl,
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: 'Успешно',
          description: data.message,
        });
        loadBotInfo();
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: data.message || data.error,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось установить webhook',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteWebhookClick = () => {
    setDeleteWebhookConfirmOpen(true);
  };

  const handleConfirmDeleteWebhook = async () => {
    setDeleteWebhookConfirmOpen(false);
    setActionLoading('deleteWebhook');
    try {
      const res = await fetch('/api/telegram-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteWebhook' }),
      });
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: 'Успешно',
          description: data.message,
        });
        loadBotInfo();
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: data.message || data.error,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось удалить webhook',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testChatId || !testMessage) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Укажите Chat ID и текст сообщения',
      });
      return;
    }

    setActionLoading('sendMessage');
    try {
      const res = await fetch('/api/telegram-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'sendMessage',
          chatId: testChatId,
          text: testMessage,
          webAppButton: {
            text: '🛒 Открыть магазин',
            url: webAppUrl,
          },
        }),
      });
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: 'Успешно',
          description: 'Сообщение отправлено',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Ошибка',
          description: data.message || data.error,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: 'Не удалось отправить сообщение',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Скопировано',
      description: 'Текст скопирован в буфер обмена',
    });
  };

  if (embedded && loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (embedded && !botInfo?.configured) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-yellow-100 rounded-xl">
              <Settings className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="font-semibold text-yellow-800">Бот не настроен</h3>
              <p className="text-sm text-yellow-700 mt-1">
                {botInfo?.message || 'Добавьте TELEGRAM_BOT_TOKEN в файл .env'}
              </p>
              <div className="mt-4 space-y-2">
                <p className="text-sm text-yellow-700 font-medium">Для настройки бота:</p>
                <ol className="text-sm text-yellow-700 list-decimal list-inside space-y-1">
                  <li>Откройте @BotFather в Telegram</li>
                  <li>Отправьте /newbot и следуйте инструкциям</li>
                  <li>Скопируйте полученный токен</li>
                  <li>Добавьте токен в файл .env: TELEGRAM_BOT_TOKEN=ваш_токен</li>
                  <li>Перезапустите сервер</li>
                </ol>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setCurrentView('admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Telegram Бот</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!botInfo?.configured) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setCurrentView('admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Telegram Бот</h1>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-yellow-100 rounded-xl">
                  <Settings className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-yellow-800">Бот не настроен</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    {botInfo?.message || 'Добавьте TELEGRAM_BOT_TOKEN в файл .env'}
                  </p>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm text-yellow-700 font-medium">Для настройки бота:</p>
                    <ol className="text-sm text-yellow-700 list-decimal list-inside space-y-1">
                      <li>Откройте @BotFather в Telegram</li>
                      <li>Отправьте /newbot и следуйте инструкциям</li>
                      <li>Скопируйте полученный токен</li>
                      <li>Добавьте токен в файл .env: TELEGRAM_BOT_TOKEN=ваш_токен</li>
                      <li>Перезапустите сервер</li>
                    </ol>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const cardsContent = (
    <>
          {/* Admin IDs Management */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Администраторы
              </CardTitle>
              <CardDescription>
                Управление Telegram ID с доступом к админ-панели. Доступ только из Telegram.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current admins list */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Текущие администраторы:</Label>
                <div className="flex flex-wrap gap-2">
                  {adminIds?.adminIds.map((id) => (
                    <div key={id} className="flex items-center gap-1">
                      <Badge 
                        variant={adminIds.envAdminIds.includes(id) ? 'default' : 'secondary'}
                        className="flex items-center gap-1"
                      >
                        <Users className="h-3 w-3" />
                        {id}
                        {adminIds.envAdminIds.includes(id) && (
                          <span className="text-xs opacity-70">(env)</span>
                        )}
                      </Badge>
                      {!adminIds.envAdminIds.includes(id) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => setRemoveAdminId(id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {(!adminIds || adminIds.adminIds.length === 0) && (
                    <span className="text-sm text-muted-foreground">Нет администраторов</span>
                  )}
                </div>
              </div>
              
              <Separator />
              
              {/* Add new admin */}
              <div className="space-y-2">
                <Label htmlFor="newAdminId">Добавить администратора по Telegram ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="newAdminId"
                    value={newAdminId}
                    onChange={(e) => setNewAdminId(e.target.value.replace(/\D/g, ''))}
                    placeholder="Например: 123456789"
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleAddAdmin} 
                    disabled={adminLoading || !newAdminId.trim()}
                    size="icon"
                  >
                    {adminLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Узнайте Telegram ID у @userinfobot
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Bot Info */}
      {botInfo.bot && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    @{botInfo.bot.username}
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Активен
                    </Badge>
                  </CardTitle>
                  <CardDescription>{botInfo.bot.first_name}</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://t.me/${botInfo.bot!.username}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Открыть
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">ID</p>
                <p className="font-mono">{botInfo.bot.id}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Группы</p>
                <p>{botInfo.bot.can_join_groups ? 'Да' : 'Нет'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Читать все сообщения</p>
                <p>{botInfo.bot.can_read_all_group_messages ? 'Да' : 'Нет'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Inline запросы</p>
                <p>{botInfo.bot.supports_inline_queries ? 'Да' : 'Нет'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Web App URL Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Web App URL
          </CardTitle>
          <CardDescription>
            URL вашего Telegram Mini App. Это адрес, который будет открываться при запуске приложения.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={webAppUrl}
              onChange={(e) => setWebAppUrl(e.target.value)}
              placeholder="https://your-app.com"
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(webAppUrl)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard('https://t.me/Suhpaybot?startapp=open')}
            >
              <Copy className="h-4 w-4 mr-2" />
              Скопировать ссылку запуска
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Ссылка для запуска: <code className="bg-muted px-1 py-0.5 rounded">https://t.me/Suhpaybot?startapp=open</code>
          </p>
        </CardContent>
      </Card>

      {/* Bot Commands */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Command className="h-5 w-5" />
                Команды бота
              </CardTitle>
              <CardDescription>
                Команды, которые будут отображаться в меню бота
              </CardDescription>
            </div>
            <Button
              onClick={handleSetCommands}
              disabled={actionLoading === 'commands'}
              size="sm"
            >
              {actionLoading === 'commands' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Обновить команды
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {botInfo.commands && botInfo.commands.length > 0 ? (
            <div className="space-y-2">
              {botInfo.commands.map((cmd, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                  <code className="text-primary font-mono">/{cmd.command}</code>
                  <span className="text-muted-foreground">—</span>
                  <span>{cmd.description}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Команды не настроены</p>
          )}
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Webhook
          </CardTitle>
          <CardDescription>
            Настройка webhook для получения обновлений от Telegram
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {botInfo.webhook && botInfo.webhook.url ? (
            <div className="p-4 bg-muted rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">URL</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Активен
                </Badge>
              </div>
              <code className="text-xs break-all block">{botInfo.webhook.url}</code>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Ожидают: {botInfo.webhook.pending_update_count}</span>
              </div>
              {botInfo.webhook.last_error_message && (
                <p className="text-xs text-red-500">
                  Ошибка: {botInfo.webhook.last_error_message}
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 bg-muted rounded-xl">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Webhook не настроен</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSetWebhook}
              disabled={actionLoading === 'webhook'}
              variant="outline"
            >
              {actionLoading === 'webhook' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Установить webhook
            </Button>
            {botInfo.webhook?.url && (
              <Button
                onClick={handleDeleteWebhookClick}
                disabled={actionLoading === 'deleteWebhook'}
                variant="destructive"
              >
                {actionLoading === 'deleteWebhook' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                Удалить
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Webhook Secret */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Webhook Secret
          </CardTitle>
          <CardDescription>
            Секретный токен для верификации входящих запросов от Telegram. Защищает от поддельных webhook'ов.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Статус</span>
              {botInfo.webhookSecretConfigured ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Настроен
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  <XCircle className="h-3 w-3 mr-1" />
                  Не настроен
                </Badge>
              )}
            </div>

            {botInfo.webhookSecretConfigured ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Переменная <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">TELEGRAM_WEBHOOK_SECRET</code> задана.
                  Webhook-запросы проходят верификацию через заголовок <code className="bg-background px-1.5 py-0.5 rounded text-xs font-mono">X-Telegram-Bot-Api-Secret-Token</code>.
                </p>
                <p className="text-xs text-green-600">
                  ✓ Все входящие webhook-запросы проверяются. Поддельные запросы отклоняются.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-red-600 font-medium">
                  ⚠️ Webhook без защиты — любой может отправить поддельные запросы к вашему боту!
                </p>
                <p className="text-xs text-muted-foreground">
                  Для настройки задайте переменную окружения <code className="bg-background px-1.5 py-0.5 rounded font-mono">TELEGRAM_WEBHOOK_SECRET</code> на Vercel, затем переустановите webhook.
                </p>
                <div className="p-3 bg-background rounded-lg border text-xs space-y-1">
                  <p className="font-medium">Как настроить:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground">
                    <li>Vercel → Settings → Environment Variables</li>
                    <li>Добавьте: <code className="font-mono">TELEGRAM_WEBHOOK_SECRET</code> = ваш_случайный_токен</li>
                    <li>Redeploy (или подождите автоматического деплоя)</li>
                    <li>Нажмите «Установить webhook» ниже</li>
                  </ol>
                </div>
                <div className="p-3 bg-background rounded-lg border text-xs">
                  <p className="font-medium mb-1">Сгенерировать секрет:</p>
                  <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px]">
                    openssl rand -hex 32
                  </code>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSetWebhook}
              disabled={actionLoading === 'webhook'}
              variant="outline"
            >
              {actionLoading === 'webhook' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {botInfo.webhookSecretConfigured ? 'Переустановить webhook' : 'Установить webhook'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Message */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Тестовое сообщение
          </CardTitle>
          <CardDescription>
            Отправить тестовое сообщение с кнопкой открытия Web App
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="chatId">Chat ID</Label>
              <Input
                id="chatId"
                value={testChatId}
                onChange={(e) => setTestChatId(e.target.value)}
                placeholder="Введите ваш Telegram ID"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Узнайте свой ID у @userinfobot
              </p>
            </div>
            <div>
              <Label htmlFor="message">Сообщение</Label>
              <Input
                id="message"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Текст сообщения"
              />
            </div>
          </div>
          <Button
            onClick={handleSendTestMessage}
            disabled={actionLoading === 'sendMessage'}
          >
            {actionLoading === 'sendMessage' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Отправить сообщение
          </Button>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Инструкция по подключению</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              <strong>Создайте бота:</strong> Откройте @BotFather, отправьте /newbot
            </li>
            <li>
              <strong>Скопируйте токен:</strong> После создания бота скопируйте токен вида 123456:ABC-DEF...
            </li>
            <li>
              <strong>Добавьте токен в .env:</strong> TELEGRAM_BOT_TOKEN=ваш_токен
            </li>
            <li>
              <strong>Настройте Mini App в BotFather:</strong>
              <ul className="list-disc list-inside ml-4 mt-1 text-muted-foreground">
                <li>Отправьте /newapp</li>
                <li>Выберите вашего бота</li>
                <li>Введите название приложения</li>
                <li>Введите описание</li>
                <li>Укажите Web App URL: {webAppUrl}</li>
              </ul>
            </li>
            <li>
              <strong>Готово!</strong> Теперь при открытии бота будет отображаться кнопка для запуска Mini App
            </li>
          </ol>
        </CardContent>
      </Card>
    </>
  );

  if (embedded) {
    return <>{cardsContent}</>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView('admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Telegram Бот</h1>
            <p className="text-sm text-muted-foreground">Управление ботом, Mini App и администраторами</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <div className="p-4 space-y-4">
          {cardsContent}
        </div>
      </div>

      {/* Delete Webhook Confirmation Dialog */}
      <AlertDialog open={deleteWebhookConfirmOpen} onOpenChange={setDeleteWebhookConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить webhook? Бот перестанет получать обновления от Telegram.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteWebhook}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Remove Admin Confirmation Dialog */}
      <AlertDialog open={!!removeAdminId} onOpenChange={() => setRemoveAdminId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить администратора?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить ID {removeAdminId} из списка администраторов? 
              Этот пользователь потеряет доступ к админ-панели.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveAdmin}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
