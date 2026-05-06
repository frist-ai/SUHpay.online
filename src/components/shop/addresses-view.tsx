'use client';

import { useState, useEffect } from 'react';
import { useShopStore } from '@/stores/shop-store';
import { validateAddress } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  MapPin,
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Home,
  Briefcase,
  Star,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Address {
  id: string;
  label: string | null;
  city: string;
  street: string;
  house: string;
  apartment: string | null;
  postalCode: string | null;
  entrance: string | null;
  floor: string | null;
  comment: string | null;
  isDefault: boolean;
}

const addressIcons: Record<string, typeof Home> = {
  home: Home,
  work: Briefcase,
  default: MapPin,
};

export function AddressesView() {
  const { user, setCurrentView } = useShopStore();
  const { toast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<Address | null>(null);
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    label: '',
    city: '',
    street: '',
    house: '',
    apartment: '',
    postalCode: '',
    entrance: '',
    floor: '',
    comment: '',
    isDefault: false,
  });

  useEffect(() => {
    fetchAddresses();
  }, [user?.id]);

  const fetchAddresses = async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        setAddresses([]);
        return;
      }
      const res = await fetch(`/api/addresses?userId=${user.id}`);
      const data = await res.json();
      setAddresses(data || []);
    } catch (error) {
      console.error('Error fetching addresses:', error);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      label: '',
      city: '',
      street: '',
      house: '',
      apartment: '',
      postalCode: '',
      entrance: '',
      floor: '',
      comment: '',
      isDefault: false,
    });
    setEditingAddress(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      label: address.label || '',
      city: address.city,
      street: address.street,
      house: address.house,
      apartment: address.apartment || '',
      postalCode: address.postalCode || '',
      entrance: address.entrance || '',
      floor: address.floor || '',
      comment: address.comment || '',
      isDefault: address.isDefault,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const errors = validateAddress(formData);

    if (Object.keys(errors).length > 0) {
      setAddressErrors(errors);
      // Показать тост с первой ошибкой
      const firstError = Object.values(errors)[0];
      toast({
        title: 'Ошибка',
        description: firstError,
        variant: 'destructive',
      });
      return;
    }
    setAddressErrors({});

    if (!user?.id) return;

    setSaving(true);
    try {
      const url = editingAddress ? `/api/addresses/${editingAddress.id}` : '/api/addresses';
      const method = editingAddress ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          userId: user.id,
          telegramId: user.telegramId,
        }),
      });

      if (res.ok) {
        toast({
          title: editingAddress ? 'Адрес обновлен' : 'Адрес добавлен',
          duration: 2000,
        });
        setDialogOpen(false);
        resetForm();
        fetchAddresses();
      }
    } catch (error) {
      console.error('Error saving address:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить адрес',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (address: Address) => {
    setAddressToDelete(address);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!addressToDelete) return;

    try {
      const res = await fetch(`/api/addresses/${addressToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast({
          title: 'Адрес удален',
          duration: 2000,
        });
        fetchAddresses();
      }
    } catch (error) {
      console.error('Error deleting address:', error);
    } finally {
      setDeleteConfirmOpen(false);
      setAddressToDelete(null);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      const res = await fetch(`/api/addresses/${addressId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });

      if (res.ok) {
        toast({
          title: 'Основной адрес изменен',
          duration: 2000,
        });
        fetchAddresses();
      }
    } catch (error) {
      console.error('Error setting default address:', error);
    }
  };

  const getAddressIcon = (label: string | null) => {
    if (!label) return MapPin;
    const l = label.toLowerCase();
    if (l.includes('дом') || l.includes('home')) return Home;
    if (l.includes('работ') || l.includes('work')) return Briefcase;
    return MapPin;
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Назад" onClick={() => setCurrentView('profile')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Адреса доставки</h1>
              <p className="text-sm text-muted-foreground">
                {addresses.length} {addresses.length === 1 ? 'адрес' : addresses.length >= 2 && addresses.length <= 4 ? 'адреса' : 'адресов'}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-1" />
            Добавить
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-14">
        <div className="p-3 space-y-2">
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
            ))
          ) : addresses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <MapPin className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Нет сохраненных адресов</h2>
              <p className="text-muted-foreground mb-6 max-w-xs">
                Добавьте адрес для быстрого оформления заказов
              </p>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить адрес
              </Button>
            </div>
          ) : (
            addresses.map((address) => {
              const Icon = getAddressIcon(address.label);
              return (
                <Card key={address.id} className={cn(
                  'relative overflow-hidden',
                  address.isDefault && 'border-primary border-2'
                )}>
                  {address.isDefault && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-bl-lg flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      Основной
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className="p-2 rounded-xl bg-muted h-fit">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {address.label && (
                          <p className="font-medium text-sm mb-1">{address.label}</p>
                        )}
                        <p className="text-sm">
                          {address.city}, {address.street}, {address.house}
                          {address.apartment && `, кв. ${address.apartment}`}
                        </p>
                        {(address.entrance || address.floor) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {address.entrance && `под. ${address.entrance}`}
                            {address.entrance && address.floor && ', '}
                            {address.floor && `эт. ${address.floor}`}
                          </p>
                        )}
                        {address.comment && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {address.comment}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      {!address.isDefault && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleSetDefault(address.id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Сделать основным
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(address)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(address)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? 'Редактировать адрес' : 'Новый адрес'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="label">Название</Label>
                <Input
                  id="label"
                  placeholder="Дом, Работа..."
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="postalCode">Индекс</Label>
                <Input
                  id="postalCode"
                  placeholder="123456"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="city">Город *</Label>
              <Input
                id="city"
                placeholder="Москва"
                value={formData.city}
                onChange={(e) => {
                  setFormData({ ...formData, city: e.target.value });
                  if (addressErrors.city) setAddressErrors(prev => { const u = { ...prev }; delete u.city; return u; });
                }}
                className={cn(addressErrors.city && 'border-red-500')}
              />
              {addressErrors.city && <p className="text-xs text-red-500 mt-1">{addressErrors.city}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="street">Улица *</Label>
                <Input
                  id="street"
                  placeholder="Ленина"
                  value={formData.street}
                  onChange={(e) => {
                    setFormData({ ...formData, street: e.target.value });
                    if (addressErrors.street) setAddressErrors(prev => { const u = { ...prev }; delete u.street; return u; });
                  }}
                  className={cn(addressErrors.street && 'border-red-500')}
                />
                {addressErrors.street && <p className="text-xs text-red-500 mt-1">{addressErrors.street}</p>}
              </div>
              <div>
                <Label htmlFor="house">Дом *</Label>
                <Input
                  id="house"
                  placeholder="1"
                  value={formData.house}
                  onChange={(e) => {
                    setFormData({ ...formData, house: e.target.value });
                    if (addressErrors.house) setAddressErrors(prev => { const u = { ...prev }; delete u.house; return u; });
                  }}
                  className={cn(addressErrors.house && 'border-red-500')}
                />
                {addressErrors.house && <p className="text-xs text-red-500 mt-1">{addressErrors.house}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="apartment">Квартира</Label>
                <Input
                  id="apartment"
                  placeholder="42"
                  value={formData.apartment}
                  onChange={(e) => {
                    setFormData({ ...formData, apartment: e.target.value });
                    if (addressErrors.apartment) setAddressErrors(prev => { const u = { ...prev }; delete u.apartment; return u; });
                  }}
                  className={cn(addressErrors.apartment && 'border-red-500')}
                />
                {addressErrors.apartment && <p className="text-xs text-red-500 mt-1">{addressErrors.apartment}</p>}
              </div>
              <div>
                <Label htmlFor="entrance">Подъезд</Label>
                <Input
                  id="entrance"
                  placeholder="1"
                  value={formData.entrance}
                  onChange={(e) => {
                    setFormData({ ...formData, entrance: e.target.value });
                    if (addressErrors.entrance) setAddressErrors(prev => { const u = { ...prev }; delete u.entrance; return u; });
                  }}
                  className={cn(addressErrors.entrance && 'border-red-500')}
                />
                {addressErrors.entrance && <p className="text-xs text-red-500 mt-1">{addressErrors.entrance}</p>}
              </div>
              <div>
                <Label htmlFor="floor">Этаж</Label>
                <Input
                  id="floor"
                  placeholder="5"
                  value={formData.floor}
                  onChange={(e) => {
                    setFormData({ ...formData, floor: e.target.value });
                    if (addressErrors.floor) setAddressErrors(prev => { const u = { ...prev }; delete u.floor; return u; });
                  }}
                  className={cn(addressErrors.floor && 'border-red-500')}
                />
                {addressErrors.floor && <p className="text-xs text-red-500 mt-1">{addressErrors.floor}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="comment">Комментарий</Label>
              <Input
                id="comment"
                placeholder="Код домофона, как найти..."
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить адрес?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить адрес "{addressToDelete?.label || addressToDelete?.city}"? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
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
