// Payment method types
export type PaymentMethodId = 'card' | 'sbp' | 'crypto' | 'stars' | 'cash' | 'cardTransfer';

export interface CardPaymentSettings {
  enabled: boolean;
  provider: 'yookassa' | 'prodamus' | 'tinkoff' | null;
  shopId: string | null;
  secretKey: string | null;
  commission: number;
  testMode: boolean;
}

export interface SBPPaymentSettings {
  enabled: boolean;
  phone: string | null;
  bankName: string | null;
  bankId: string | null;
  autoReceipt: boolean;
  selfEmployed: boolean;
}

export interface CryptoPaymentSettings {
  enabled: boolean;
  network: 'TRC-20' | 'ERC-20' | 'BSC' | null;
  walletAddress: string | null;
  rateType: 'auto' | 'fixed' | null;
  fixedRate: number | null;
  networkFee: number;
}

export interface StarsPaymentSettings {
  enabled: boolean;
  botToken: string | null;
  rate: number;
  digitalOnly: boolean;
}

export interface CashPaymentSettings {
  enabled: boolean;
  instructions: string | null;
}

export interface CardTransferPaymentSettings {
  enabled: boolean;
  cardNumber: string | null;
  holderName: string | null;
  bankName: string | null;
  phone: string | null;
}

export interface PaymentSettings {
  card: CardPaymentSettings;
  sbp: SBPPaymentSettings;
  crypto: CryptoPaymentSettings;
  stars: StarsPaymentSettings;
  cash: CashPaymentSettings;
  cardTransfer: CardTransferPaymentSettings;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  paymentMethod: PaymentMethodId;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  transactionId: string | null;
  paymentData: string | null;
  cryptoAmount: number | null;
  cryptoTxHash: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Default payment settings
export const defaultPaymentSettings: PaymentSettings = {
  card: {
    enabled: false,
    provider: null,
    shopId: null,
    secretKey: null,
    commission: 0,
    testMode: true,
  },
  sbp: {
    enabled: false,
    phone: null,
    bankName: null,
    bankId: null,
    autoReceipt: false,
    selfEmployed: false,
  },
  crypto: {
    enabled: false,
    network: null,
    walletAddress: null,
    rateType: 'auto',
    fixedRate: null,
    networkFee: 0,
  },
  stars: {
    enabled: false,
    botToken: null,
    rate: 0.5,
    digitalOnly: true,
  },
  cash: {
    enabled: true,
    instructions: 'Оплата наличными или картой при получении заказа',
  },
  cardTransfer: {
    enabled: false,
    cardNumber: null,
    holderName: null,
    bankName: null,
    phone: null,
  },
};

// Payment method display info
export const paymentMethodsInfo: Record<PaymentMethodId, {
  name: string;
  icon: string;
  description: string;
}> = {
  card: {
    name: 'Банковская карта',
    icon: '💳',
    description: 'Безопасная оплата картой Visa, Mastercard, Мир',
  },
  sbp: {
    name: 'СБП',
    icon: '📱',
    description: 'Моментальный перевод по номеру телефона',
  },
  crypto: {
    name: 'Криптовалюта',
    icon: '₮',
    description: 'USDT TRC-20, ERC-20, BSC',
  },
  stars: {
    name: 'Telegram Stars',
    icon: '⭐',
    description: 'Оплата звёздами Telegram (цифровые товары)',
  },
  cash: {
    name: 'Оплата при встрече',
    icon: '💵',
    description: 'Наличными или картой при получении',
  },
  cardTransfer: {
    name: 'Перевод на карту',
    icon: '💳',
    description: 'Перевод на банковскую карту',
  },
};

// Banks for SBP
export const sbpBanks = [
  { id: 'tinkoff', name: 'Т-Банк', bankId: '100000000111' },
  { id: 'sber', name: 'СберБанк', bankId: '100000000004' },
  { id: 'alfa', name: 'Альфа-Банк', bankId: '100000000008' },
  { id: 'vtb', name: 'ВТБ', bankId: '100000000016' },
  { id: 'raiffeisen', name: 'Райффайзен Банк', bankId: '100000000020' },
  { id: 'gazprombank', name: 'Газпромбанк', bankId: '100000000023' },
  { id: 'otkritie', name: 'Открытие', bankId: '100000000027' },
  { id: 'moscow_credit', name: 'МКБ', bankId: '100000000038' },
  { id: 'rosbank', name: 'Росбанк', bankId: '100000000042' },
  { id: 'qiwi', name: 'QIWI Банк', bankId: '100000000066' },
];

// Card payment providers
export const cardProviders = [
  { id: 'yookassa', name: 'ЮKassa', description: 'Популярный платёжный шлюз' },
  { id: 'prodamus', name: 'Prodamus', description: 'Для самозанятых и малого бизнеса' },
  { id: 'tinkoff', name: 'Т-Касса', description: 'Для бизнеса в Т-Банк' },
];

// Crypto networks
export const cryptoNetworks = [
  { id: 'TRC-20', name: 'TRC-20 (Tron)', description: 'Низкая комиссия, рекомендуется' },
  { id: 'ERC-20', name: 'ERC-20 (Ethereum)', description: 'Высокая комиссия' },
  { id: 'BSC', name: 'BSC (Binance Smart Chain)', description: 'Средняя комиссия' },
];

// Generate QR data for SBP
export function generateSBPQRData(phone: string, amount: number, orderNumber: string, bankId?: string): string {
  // SBP QR format (simplified)
  const cleanPhone = phone.replace(/\D/g, '');
  // This is a simplified version - real implementation would use SBP specification
  const qrData = `https://qr.nspk.ru/${bankId || '100000000111'}?receiver=${cleanPhone}&sum=${Math.round(amount * 100)}&order=${orderNumber}`;
  return qrData;
}

// Format phone for display
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
  }
  return phone;
}

// Calculate crypto amount
export function calculateCryptoAmount(rubAmount: number, usdtRate: number = 95): number {
  return Math.round((rubAmount / usdtRate) * 100) / 100;
}

// Calculate stars amount
export function calculateStarsAmount(rubAmount: number, rate: number = 0.5): number {
  return Math.round(rubAmount / rate);
}
