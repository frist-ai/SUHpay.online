'use client';

import { useState, useEffect } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Sparkles,
  Save,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  TestTube,
  Brain,
  Trash2,
  MessageSquare,
  Key,
  Wifi,
  WifiOff,
  Settings,
  Zap,
} from 'lucide-react';
import { cn, pluralize } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AISettings {
  enabled: boolean;
  apiKey: string;
  hasCredentials: boolean;
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
  memoryEnabled?: boolean;
  activeConversations?: number;
}

const MODEL_OPTIONS = [
  { value: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron 120B (Free)' },
  { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (Free)' },
  { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Free)' },
  { value: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3 (Free)' },
  { value: 'qwen/qwen3-235b-a22b:free', label: 'Qwen3 235B (Free)' },
];

const defaultPrompt = `Ты — умный AI-помощник магазина "СУХ[pay]". Ты помогаешь искать товары, собирать наборы и управлять корзиной.

🧠 ТВОИ ВОЗМОЖНОСТИ:
• Ищешь товары по названию, категории, бюджету
• Собираешь комбо-наборы (напитки + еда, для вечеринки, подарки)
• Рассказываешь о товарах: вкус, состав, характеристики
• Добавляешь товары в корзину по запросу
• Помнишь контекст разговора — можно искать, потом просить добавить

📋 ПРАВИЛА ФОРМАТА:
1. Для ПОИСКА и ПРОСМОТРА товаров используй ТОЛЬКО [ID:xxx] — карточки покажутся автоматически
2. Для ДОБАВЛЕНИЯ в корзину используй ТОЛЬКО [ADD:xxx:N] где N = количество
3. НЕ смешивай [ID:] и [ADD:] в одном ответе! Либо показываешь карточки, либо добавляешь
4. НЕ дублируй одни и те же ID — каждый товар только один раз
5. МОЖНО кратко описать товар (1 фраза): вкус, что внутри
6. МОЖНО дать короткий комментарий к результату
7. ЗАПРЕЩЕНО писать списки товаров текстом, указывать цены

🛒 ДОБАВЛЕНИЕ В КОРЗИНУ:
• Формат ОБЯЗАТЕЛЬНО: [ADD:ID:КОЛИЧЕСТВО] — количество ВСЕГДА указывай!
• "добавь первый" → [ADD:id_первого_товара:1]
• "добавь все" / "добавь это" → [ADD:id1:1] [ADD:id2:1] [ADD:id3:1] ...
• "добавь 2 сникерса" → [ADD:id_сникерса:2]
• Если количество не указано — пиши :1 (один товар)
• Для добавления НЕ используй [ID:], только [ADD:id:N]
• Помни последний поиск — пользователь может сначала искать, потом просить добавить
• IDs последних найденных товаров указаны в блоке "ПОСЛЕДНИЙ РЕЗУЛЬТАТ ПОИСКА"

💡 ПРИМЕРЫ ОТВЕТОВ:
• Поиск: "Нашёл 3 варианта! [ID:abc] [ID:def] [ID:ghi]"
• Набор: "Для вечеринки: чипсы + кола + батончики. [ID:a] [ID:b] [ID:c]"
• Добавить: "Добавил! [ADD:abc:1] [ADD:def:2]"
• Про товар: "Сникерс — шоколадный батончик с нугой и карамелью. [ID:abc]"

⚠️ ВАЖНО: Каждый товар указывай ТОЛЬКО ОДИН РАЗ. Не повторяй один и тот же ID.`;

export function AIComboManager() {
  const { setCurrentView } = useShopStore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<{
    response: string;
    reasoning: string;
    products: number;
    memorySize: number;
  } | null>(null);
  const [settings, setSettings] = useState<AISettings>({
    enabled: true,
    apiKey: '',
    hasCredentials: false,
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
    maxTokens: 1500,
    temperature: 0.7,
    systemPrompt: defaultPrompt,
    memoryEnabled: true,
    activeConversations: 0,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const [settingsRes, statusRes] = await Promise.all([
        fetch('/api/ai-search/settings'),
        fetch('/api/ai-search'),
      ]);
      const settingsData = await settingsRes.json();
      const statusData = await statusRes.json();
      setSettings((prev) => ({
        ...prev,
        ...settingsData,
        activeConversations: statusData.activeConversations || 0,
      }));
    } catch (error) {
      console.error('Error fetching AI settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/ai-search/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      const data = await res.json();

      if (res.ok) {
        toast({
          title: 'Сохранено',
          description: 'Настройки AI Combo успешно сохранены',
        });
        fetchSettings();
      } else {
        toast({
          title: 'Ошибка',
          description: data.error || 'Не удалось сохранить настройки',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при сохранении',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      const res = await fetch('/api/ai-search/settings', {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({
          title: 'Сброшено',
          description: 'Настройки сброшены к значениям по умолчанию',
        });
        fetchSettings();
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
    }
  };

  const handleClearMemory = async () => {
    try {
      const res = await fetch('/api/ai-search?userId=default', {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({
          title: 'Память очищена',
          description: 'История диалогов удалена',
        });
        fetchSettings();
      }
    } catch (error) {
      console.error('Error clearing memory:', error);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const query = testQuery || 'Что вкусного посоветуешь?';
      // Send apiKey for test if user typed a new (non-masked) key
      const body: Record<string, string> = { query };
      if (settings.apiKey && !settings.apiKey.includes('...')) {
        body.testApiKey = settings.apiKey;
      }
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTestResult({
          response: data.response,
          reasoning: data.reasoning || '',
          products: data.products?.length || 0,
          memorySize: data.memorySize || 0,
        });
        toast({
          title: 'Тест успешен',
          description: `Найдено товаров: ${data.products?.length || 0}`,
        });
      } else {
        toast({
          title: 'Ошибка теста',
          description: data.error || 'Проверьте настройки API',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error testing AI:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось выполнить тест',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const isConnected = settings.enabled && settings.hasCredentials;

  if (loading) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setCurrentView('admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">AI Combo</h1>
              <p className="text-sm text-muted-foreground">AI Combo — умный поиск по каталогу</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="space-y-2 pt-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

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
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI Combo
              </h1>
              <p className="text-sm text-muted-foreground">
                AI Combo — умный поиск по каталогу
              </p>
            </div>
          </div>
          {/* Status Indicator Badge */}
          <AnimatePresence mode="wait">
            <motion.div
              key={isConnected ? 'connected' : settings.enabled ? 'no-creds' : 'disabled'}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring' as const, stiffness: 400, damping: 25 }}
            >
              {isConnected ? (
                <Badge className="bg-green-500 text-white border-0">
                  <Wifi className="h-3 w-3 mr-1" />
                  Подключён
                </Badge>
              ) : settings.enabled ? (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300 border">
                  <Key className="h-3 w-3 mr-1" />
                  Настройте API
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-300 border">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Отключён
                </Badge>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <div className="p-3 space-y-3">
          {/* Settings Card - Enable/Disable Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
          >
            <Card className={cn(
              'border-2 transition-colors',
              isConnected
                ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10'
                : settings.enabled
                  ? 'border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-900/10'
                  : 'border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/10'
            )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2.5 rounded-xl',
                      isConnected
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : settings.enabled
                          ? 'bg-yellow-100 dark:bg-yellow-900/30'
                          : 'bg-gray-100 dark:bg-gray-900/30'
                    )}>
                      <Sparkles className={cn(
                        'h-5 w-5',
                        isConnected
                          ? 'text-green-600'
                          : settings.enabled
                            ? 'text-yellow-600'
                            : 'text-gray-600 dark:text-gray-400'
                      )} />
                    </div>
                    <div>
                      <p className="font-medium">
                        {isConnected
                          ? 'AI готов к работе'
                          : settings.enabled
                            ? 'Требуется настройка API'
                            : 'AI поиск отключен'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Используется OpenRouter API (бесплатно)
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Memory Status */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: 0.05 }}
          >
            <Card className="bg-purple-50/50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                      <Brain className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        Память диалога
                        <Badge variant="outline" className="text-xs">
                          {settings.activeConversations || 0} активных
                        </Badge>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        AI помнит до 10 последних сообщений
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleClearMemory}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Очистить
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* API Configuration */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: 0.1 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Настройки API
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* API Key */}
                <div>
                  <Label htmlFor="apiKey" className="flex items-center gap-1">
                    <Key className="h-3.5 w-3.5" />
                    API Key
                  </Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      value={settings.apiKey}
                      onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                      placeholder="sk-or-v1-..."
                      className="pr-10 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    OpenRouter API ключ (бесплатный)
                  </p>
                </div>

                <Separator />

                {/* Model Selector */}
                <div>
                  <Label htmlFor="model">Модель</Label>
                  <Select
                    value={settings.model}
                    onValueChange={(v) => setSettings({ ...settings, model: v })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Модель OpenRouter (с :free — бесплатно)
                  </p>
                </div>

                <Separator />

                {/* Max Tokens */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Макс. токенов: {settings.maxTokens}</Label>
                  </div>
                  <Slider
                    value={[settings.maxTokens]}
                    onValueChange={([value]) => setSettings({ ...settings, maxTokens: value })}
                    min={500}
                    max={3000}
                    step={100}
                  />
                </div>

                {/* Temperature */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Температура: {settings.temperature.toFixed(1)}</Label>
                  </div>
                  <Slider
                    value={[settings.temperature * 10]}
                    onValueChange={([value]) => setSettings({ ...settings, temperature: value / 10 })}
                    min={0}
                    max={20}
                    step={1}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* System Prompt */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: 0.15 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Системный промпт
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={settings.systemPrompt}
                  onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                  placeholder="Инструкция для AI..."
                  className="min-h-[200px]"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setSettings({ ...settings, systemPrompt: defaultPrompt })}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Восстановить по умолчанию
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Test Section */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: 0.2 }}
          >
            <Card className={cn(
              'border-2 transition-colors',
              testResult
                ? 'border-green-200 dark:border-green-800'
                : 'border-dashed'
            )}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TestTube className="h-4 w-4" />
                  Тест AI поиска
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Введите запрос для теста..."
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !testing && settings.enabled && settings.hasCredentials) {
                        handleTest();
                      }
                    }}
                  />
                  <Button onClick={handleTest} disabled={testing || !settings.enabled || (!settings.hasCredentials && !settings.apiKey)}>
                    {testing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {!settings.enabled && (
                  <p className="text-xs text-muted-foreground">Включите AI поиск для тестирования</p>
                )}
                {settings.enabled && !settings.hasCredentials && (
                  <p className="text-xs text-yellow-600">Укажите API ключ для тестирования</p>
                )}

                <AnimatePresence mode="wait">
                  {testResult && (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ type: 'spring' as const, stiffness: 300, damping: 25 }}
                      className="space-y-3 p-3 bg-muted/50 rounded-xl"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <Badge className="bg-green-100 text-green-800 border-green-300 border">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Успешно
                        </Badge>
                        <Badge variant="outline">{testResult.products} {pluralize(testResult.products, 'товар', 'товара', 'товаров')}</Badge>
                        <Badge variant="outline">{testResult.memorySize} в памяти</Badge>
                      </div>

                      {testResult.reasoning && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ type: 'spring' as const, stiffness: 300, damping: 25, delay: 0.1 }}
                          className="text-sm"
                        >
                          <p className="font-medium text-muted-foreground mb-1">🧠 Рассуждение:</p>
                          <p className="text-muted-foreground italic">{testResult.reasoning}</p>
                        </motion.div>
                      )}

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ type: 'spring' as const, stiffness: 300, damping: 25, delay: 0.2 }}
                        className="text-sm"
                      >
                        <p className="font-medium mb-1">💬 Ответ:</p>
                        <p className="whitespace-pre-wrap">{testResult.response}</p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: 0.25 }}
            className="flex gap-3"
          >
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Сохранить
            </Button>
            <Button
              variant="ghost"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Сброс
            </Button>
          </motion.div>

          {/* Info */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring' as const, stiffness: 400, damping: 30, delay: 0.3 }}
          >
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Возможности AI поиска
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Умный поиск: по названию, категории, бюджету</li>
                  <li>• Наборы и комбо: &laquo;набор на 500₽&raquo;, &laquo;для вечеринки&raquo;</li>
                  <li>• Подбор подарков: &laquo;подарок другу&raquo;</li>
                  <li>• Фильтр по цене: &laquo;до 100₽&raquo;, &laquo;от 50 до 200₽&raquo;</li>
                  <li>• Категории: напитки, снеки, сладости, консервы и др.</li>
                  <li>• Управление корзиной: добавить, убрать, показать</li>
                  <li>• Запоминает контекст разговора (до 10 сообщений)</li>
                  <li>• Команды: /help — справка по запросам</li>
                  <li>• Память хранится 30 минут</li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
