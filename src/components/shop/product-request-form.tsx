'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Send, 
  CheckCircle2, 
  Loader2,
  MessageSquarePlus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ProductRequestFormProps {
  telegramId: string;
  userId?: string;
  onSuccess?: () => void;
}

const categories = [
  'Электроника',
  'Одежда и обувь',
  'Продукты питания',
  'Бытовая химия',
  'Косметика',
  'Товары для дома',
  'Товары для детей',
  'Спорт и отдых',
  'Автотовары',
  'Книги и канцелярия',
  'Другое',
];

export function ProductRequestForm({ telegramId, userId, onSuccess }: ProductRequestFormProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    quantity: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      toast({ title: 'Укажите название товара', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/product-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId,
          userId,
          name: form.name,
          description: form.description || null,
          category: form.category || null,
          quantity: form.quantity ? parseInt(form.quantity) : null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        toast({ 
          title: data.isDuplicate ? 'Приоритет увеличен' : 'Запрос отправлен',
          description: data.message || 'Мы рассмотрим ваш запрос',
        });
        setForm({ name: '', description: '', category: '', quantity: '' });
        onSuccess?.();
        
        // Reset success state after a while
        setTimeout(() => {
          setSuccess(false);
          setIsOpen(false);
        }, 3000);
      } else {
        toast({ title: data.error || 'Ошибка отправки', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      toast({ title: 'Ошибка отправки', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="border-green-500">
        <CardContent className="py-6 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-3" />
          <h3 className="font-medium text-lg mb-1">Запрос принят!</h3>
          <p className="text-sm text-muted-foreground">
            Мы рассмотрим ваш запрос и добавим товар при возможности
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <CollapsibleTrigger asChild>
            <button className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left">
              <div className="p-2 rounded-xl bg-muted">
                <MessageSquarePlus className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">Запрос товаров</p>
                <p className="text-sm text-muted-foreground">Не нашли нужный товар?</p>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Separator />
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="productName">Название товара *</Label>
                <Input
                  id="productName"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Что вы ищете?"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Категория</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Дополнительная информация</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Бренд, размер, цвет, ссылки..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Требуемое количество</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  placeholder="1"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Отправка...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Отправить запрос
                  </>
                )}
              </Button>
            </form>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
