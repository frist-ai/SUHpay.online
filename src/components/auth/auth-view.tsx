'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Eye, EyeOff, Phone, Lock, User, ArrowRight, Loader2, ShoppingBag } from 'lucide-react';

interface AuthViewProps {
  onLogin: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onRegister: (data: { phone: string; password: string; firstName?: string }) => Promise<{ success: boolean; error?: string }>;
  onOpenTelegram: () => void;
}

export function AuthView({ onLogin, onRegister, onOpenTelegram }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const result = await onLogin(phone, password);
        if (!result.success) {
          setError(result.error || 'Ошибка входа');
        }
      } else {
        if (!firstName.trim()) {
          setError('Введите ваше имя');
          setLoading(false);
          return;
        }
        const result = await onRegister({ phone, password, firstName: firstName.trim() });
        if (!result.success) {
          setError(result.error || 'Ошибка регистрации');
        }
      }
    } catch {
      setError('Произошла ошибка. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '+';
    if (digits.startsWith('8')) return `+7${digits.slice(1)}`;
    if (digits.startsWith('7')) return `+${digits}`;
    return `+${digits}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <ShoppingBag className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">СУХ[pay]</h1>
          <p className="text-muted-foreground text-sm">Доставка продуктов и товаров</p>
        </div>

        {/* Auth Card */}
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">
              {mode === 'login' ? 'Вход в аккаунт' : 'Регистрация'}
            </CardTitle>
            <CardDescription className="text-xs">
              {mode === 'login' 
                ? 'Войдите, чтобы делать заказы и отслеживать их' 
                : 'Создайте аккаунт для быстрых заказов'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20">
                  {error}
                </div>
              )}

              {mode === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-xs font-medium">Ваше имя</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="firstName"
                      placeholder="Как к вам обращаться?"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pl-9 h-11"
                      autoComplete="given-name"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-medium">Номер телефона</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+79123456789"
                    value={phone}
                    onChange={handlePhoneChange}
                    className="pl-9 h-11"
                    autoComplete="tel"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">Пароль</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={mode === 'login' ? 'Введите пароль' : 'Придумайте пароль (мин. 6 символов)'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10 h-11"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 text-sm font-semibold"
                disabled={loading || !phone || phone.length < 12 || password.length < 6}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
              </Button>

              <div className="text-center text-sm">
                <span className="text-muted-foreground">
                  {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
                </span>{' '}
                <button
                  type="button"
                  onClick={switchMode}
                  className="text-primary font-medium hover:underline"
                >
                  {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Telegram option */}
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/30" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-muted-foreground">или</span>
            </div>
          </div>
          <Button
            variant="outline"
            className="mt-4 w-full h-11 text-sm"
            onClick={onOpenTelegram}
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
            </svg>
            Войти через Telegram
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground/60 mt-2">
          Нажимая кнопку, вы соглашаетесь с условиями использования
        </p>
      </div>
    </div>
  );
}
