// Telegram WebApp API utilities
// https://core.telegram.org/bots/webapps

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            photo_url?: string;
          };
          query_id?: string;
          auth_date?: number;
          hash?: string;
          start_param?: string;
        };
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        bottomBarColor: string;
        isClosingConfirmationEnabled: boolean;
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          setParams: (params: {
            text?: string;
            color?: string;
            textColor?: string;
            isActive?: boolean;
          }) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        CloudStorage: {
          setItem: (key: string, value: string, callback?: (error: Error | null) => void) => void;
          getItem: (key: string, callback: (error: Error | null, value: string | null) => void) => void;
          getItems: (keys: string[], callback: (error: Error | null, values: (string | null)[]) => void) => void;
          removeItem: (key: string, callback?: (error: Error | null) => void) => void;
          removeItems: (keys: string[], callback?: (error: Error | null) => void) => void;
          getKeys: (callback: (error: Error | null, keys: string[]) => void) => void;
        };
        openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
        openTelegramLink: (url: string) => void;
        openInvoice: (url: string, callback: (status: 'paid' | 'cancelled' | 'failed' | string) => void) => void;
        showPopup: (params: {
          title?: string;
          message: string;
          buttons?: Array<{
            id?: string;
            type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
            text?: string;
          }>;
        }, callback?: (buttonId: string) => void) => void;
        showAlert: (message: string, callback?: () => void) => void;
        showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
        showScanQrPopup: (params: { text?: string }, callback?: (qr: string) => boolean) => void;
        closeScanQrPopup: () => void;
        readTextFromClipboard: (callback: (text: string) => void) => void;
        ready: () => void;
        expand: () => void;
        close: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        enableClosingConfirmation: () => void;
        disableClosingConfirmation: () => void;
        onEvent: (eventType: string, callback: () => void) => void;
        offEvent: (eventType: string, callback: () => void) => void;
      };
    };
  }
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export function getTelegramUser(): TelegramUser | null {
  if (typeof window === 'undefined') return null;
  
  // Check if Telegram WebApp is available
  const wa = window.Telegram?.WebApp;
  if (!wa) {
    // Telegram WebApp not available (not in Telegram app)
    return null;
  }
  
  // Telegram WebApp detected
  
  // Get user from initDataUnsafe
  const user = wa.initDataUnsafe?.user;
  if (user) {
    return user;
  }
  
  // No user data in initDataUnsafe
  return null;
}

export function getTelegramInitData(): string | null {
  if (typeof window === 'undefined' || !window.Telegram?.WebApp) return null;
  const data = window.Telegram.WebApp.initData;
  if (typeof data === 'string' && data.length > 0) return data;
  return null;
}

// Alias for convenience
export const getInitData = getTelegramInitData;

export function getTelegramAuthDate(): number | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.auth_date) {
    return window.Telegram.WebApp.initDataUnsafe.auth_date;
  }
  return null;
}

export function getStartParam(): string | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.start_param) {
    return window.Telegram.WebApp.initDataUnsafe.start_param;
  }
  return null;
}

/** Проверяет, что приложение открыто внутри Telegram (Mini App). */
export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  const wa = window.Telegram?.WebApp;
  if (!wa) return false;
  
  // Check if we have any indication of Telegram environment
  const hasInitData = typeof wa.initData === 'string';
  const hasUser = !!wa.initDataUnsafe?.user;
  const hasPlatform = !!wa.platform;
  
  // Even if initData is empty string, we might still have user data
  const isTelegram = hasInitData || hasUser || hasPlatform;
  
  if (isTelegram) {
    // Telegram WebApp detected
  }
  
  return isTelegram;
}

export function initTelegramWebApp() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  }
}

export function showMainButton(text: string, onClick: () => void) {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.MainButton) {
    window.Telegram.WebApp.MainButton.setText(text);
    window.Telegram.WebApp.MainButton.show();
    window.Telegram.WebApp.MainButton.onClick(onClick);
  }
}

export function hideMainButton() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.MainButton) {
    window.Telegram.WebApp.MainButton.hide();
  }
}

export function showBackButton(onClick: () => void) {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.BackButton) {
    window.Telegram.WebApp.BackButton.show();
    window.Telegram.WebApp.BackButton.onClick(onClick);
  }
}

export function hideBackButton() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.BackButton) {
    window.Telegram.WebApp.BackButton.hide();
  }
}

export function hapticFeedback(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
  }
}

export function showSuccessNotification() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
  }
}

export function showErrorNotification() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
  }
}

export function showTelegramAlert(message: string) {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.showAlert) {
    window.Telegram.WebApp.showAlert(message);
  }
}

export function showTelegramConfirm(message: string, callback: (confirmed: boolean) => void) {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.showConfirm) {
    window.Telegram.WebApp.showConfirm(message, callback);
  }
}

export function getThemeParams() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.themeParams) {
    return window.Telegram.WebApp.themeParams;
  }
  return null;
}

export function openTelegramLink(url: string) {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
    window.Telegram.WebApp.openTelegramLink(url);
  }
}

// Share product via Telegram - opens chat selection
export function shareProduct(productId: string, productName: string, price: number) {
  const botUsername = 'Suhpaybot';
  const shareUrl = `https://t.me/${botUsername}?startapp=product_${productId}`;
  const text = `📦 ${productName}\n💰 ${price.toLocaleString('ru-RU')} ₽\n\nСмотреть в магазине:`;
  
  // Use Telegram's share link - opens chat selection dialog
  const shareLink = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
  
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
    window.Telegram.WebApp.openTelegramLink(shareLink);
  } else if (typeof navigator !== 'undefined' && navigator.share) {
    // Fallback to native share if available
    navigator.share({
      title: productName,
      text: `${productName} - ${price.toLocaleString('ru-RU')} ₽`,
      url: shareUrl,
    }).catch(() => {
      // User cancelled or error
    });
  }
}

// Share store link
export function shareStore(customMessage?: string) {
  const botUsername = 'Suhpaybot';
  const shareUrl = `https://t.me/${botUsername}?startapp=open`;
  const text = customMessage || '🛒 СУХ[pay] - магазин продуктов с доставкой!\n\nЗаказывайте здесь:';
  
  const shareLink = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
  
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
    window.Telegram.WebApp.openTelegramLink(shareLink);
  }
}
