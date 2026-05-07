'use client';

import { useState, useEffect, useCallback } from 'react';

interface CourierSettings {
  enabled: boolean;
  basePrice: number;
  freeFrom: number;
  minHours: number;
  maxHours: number;
  description: string;
}

interface PickupSettings {
  enabled: boolean;
  address: string;
  city: string;
  phone: string;
  workHours: string;
  description: string;
}

interface FreeDeliverySettings {
  enabled: boolean;
  minOrderAmount: number;
  excludeCategories: string[];
  description: string;
}

export interface DeliverySlot {
  id: string;
  startTime: string; // "18:00"
  endTime: string;   // "20:00"
  isActive: boolean;
}

export interface DeliverySettings {
  courier: CourierSettings;
  pickup: PickupSettings;
  freeDelivery: FreeDeliverySettings;
  deliverySlots: DeliverySlot[];
}

const defaultSettings: DeliverySettings = {
  courier: {
    enabled: true,
    basePrice: 300,
    freeFrom: 3000,
    minHours: 1,
    maxHours: 3,
    description: 'Доставка курьером до двери',
  },
  pickup: {
    enabled: true,
    address: '',
    city: '',
    phone: '',
    workHours: 'Пн-Пт: 9:00-21:00, Сб-Вс: 10:00-18:00',
    description: 'Самовывоз из нашего магазина',
  },
  freeDelivery: {
    enabled: true,
    minOrderAmount: 1000,
    excludeCategories: [],
    description: 'Бесплатная доставка при заказе от определенной суммы',
  },
  deliverySlots: [],
};

export function useDeliverySettings() {
  const [settings, setSettings] = useState<DeliverySettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings?keys=delivery_settings');
      const data = await response.json();
      
      if (data.delivery_settings) {
        const parsed = JSON.parse(data.delivery_settings);
        // Deep merge to preserve nested settings like freeDelivery.minOrderAmount
        setSettings({
          ...defaultSettings,
          ...parsed,
          courier: { ...defaultSettings.courier, ...(parsed.courier || {}) },
          pickup: { ...defaultSettings.pickup, ...(parsed.pickup || {}) },
          freeDelivery: { ...defaultSettings.freeDelivery, ...(parsed.freeDelivery || {}) },
          deliverySlots: Array.isArray(parsed.deliverySlots) ? parsed.deliverySlots : defaultSettings.deliverySlots,
        });
      }
    } catch (error) {
      console.error('Error fetching delivery settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Calculate delivery cost based on cart total
  const getDeliveryCost = useCallback((cartTotal: number, method: 'courier' | 'pickup' = 'courier'): number => {
    if (method === 'pickup') return 0; // Pickup is always free
    
    // Check free delivery
    if (settings.freeDelivery.enabled && cartTotal >= settings.freeDelivery.minOrderAmount) {
      return 0;
    }
    
    // Check courier free from
    if (settings.courier.enabled && cartTotal >= settings.courier.freeFrom) {
      return 0;
    }
    
    return settings.courier.basePrice;
  }, [settings]);

  // Get remaining amount for free delivery
  const getRemainingForFreeDelivery = useCallback((cartTotal: number): number => {
    if (!settings.freeDelivery.enabled) return 0;
    const remaining = settings.freeDelivery.minOrderAmount - cartTotal;
    return remaining > 0 ? remaining : 0;
  }, [settings]);

  // Check if free delivery is available
  const isFreeDeliveryAvailable = useCallback((cartTotal: number): boolean => {
    if (!settings.freeDelivery.enabled) return false;
    return cartTotal >= settings.freeDelivery.minOrderAmount;
  }, [settings]);

  // Get available delivery methods
  const getAvailableDeliveryMethods = useCallback((): Array<{ id: string; name: string; description: string; basePrice: number; freeFrom: number; address?: string; city?: string; phone?: string; workHours?: string }> => {
    const methods: Array<{ id: string; name: string; description: string; basePrice: number; freeFrom: number; address?: string; city?: string; phone?: string; workHours?: string }> = [];
    
    if (settings.courier.enabled) {
      methods.push({
        id: 'courier',
        name: 'Курьер',
        description: `${settings.courier.minHours}-${settings.courier.maxHours} часов`,
        basePrice: settings.courier.basePrice,
        freeFrom: settings.courier.freeFrom,
      });
    }
    
    if (settings.pickup.enabled) {
      methods.push({
        id: 'pickup',
        name: 'Самовывоз',
        description: settings.pickup.address || 'Из нашего магазина',
        basePrice: 0,
        freeFrom: 0,
        address: settings.pickup.address,
        city: settings.pickup.city,
        phone: settings.pickup.phone,
        workHours: settings.pickup.workHours,
      });
    }
    
    return methods;
  }, [settings]);

  // Get active delivery time slots
  const getActiveDeliverySlots = useCallback(() => {
    return settings.deliverySlots
      .filter(slot => slot.isActive)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [settings]);

  return {
    settings,
    loading,
    getDeliveryCost,
    getRemainingForFreeDelivery,
    isFreeDeliveryAvailable,
    getAvailableDeliveryMethods,
    getActiveDeliverySlots,
    refetch: fetchSettings,
  };
}
