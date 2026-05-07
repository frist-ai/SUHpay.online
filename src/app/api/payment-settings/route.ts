import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { defaultPaymentSettings, PaymentSettings } from '@/lib/payment-config';
import { verifyAdmin, verifyUser } from '@/lib/auth-helpers';

// Default settings ID
const SETTINGS_ID = 'payment-settings-main';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET payment settings - public flags only, secrets require admin auth
export async function GET(request: NextRequest) {
  try {
    // Check if user is admin to determine what data to return
    let isAdmin = false;
    try {
      const { user: adminUser } = await verifyAdmin(request);
      isAdmin = !!adminUser;
    } catch {
      // Not admin — will return public settings only
    }

    // Check if paymentSettings model exists
    const dbAny: any = db;
    if (!db || !dbAny.paymentSettings) {
      console.error('[PaymentSettings API] Model not available, returning defaults');
      return NextResponse.json(isAdmin ? defaultPaymentSettings : getPublicSettings(defaultPaymentSettings));
    }

    const settings = await dbAny.paymentSettings.findUnique({
      where: { id: SETTINGS_ID },
    });
    
    if (!settings) {
      // Create default settings
      await dbAny.paymentSettings.create({
        data: {
          id: SETTINGS_ID,
          cardEnabled: false,
          sbpEnabled: false,
          cryptoEnabled: false,
          starsEnabled: false,
          cashEnabled: true,
          cardTransferEnabled: false,
        }
      });
      return NextResponse.json(isAdmin ? defaultPaymentSettings : getPublicSettings(defaultPaymentSettings));
    }

    // Auto-rename legacy bank names
    const normalizeBankName = (name: string | null): string | null => {
      if (!name) return null;
      return name
        .replace(/Тинькофф\s*Банк/gi, 'Т-Банк')
        .replace(/Тинькофф\s*Касса/gi, 'Т-Касса')
        .replace(/Тинькофф/gi, 'Т-Банк');
    };

    // Transform database record to PaymentSettings format
    const s = settings as Record<string, unknown>;
    const result: PaymentSettings = {
      card: {
        enabled: s.cardEnabled as boolean,
        provider: s.cardProvider as PaymentSettings['card']['provider'],
        shopId: s.cardShopId as string | null,
        secretKey: s.cardSecretKey ? '••••••••' : null,
        commission: s.cardCommission as number,
        testMode: s.cardTestMode as boolean,
      },
      sbp: {
        enabled: s.sbpEnabled as boolean,
        phone: s.sbpPhone as string | null,
        bankName: normalizeBankName(s.sbpBankName as string | null),
        bankId: s.sbpBankId as string | null,
        autoReceipt: s.sbpAutoReceipt as boolean,
        selfEmployed: s.sbpSelfEmployed as boolean,
      },
      crypto: {
        enabled: s.cryptoEnabled as boolean,
        network: s.cryptoNetwork as PaymentSettings['crypto']['network'],
        walletAddress: s.cryptoWallet as string | null,
        rateType: s.cryptoRateType as PaymentSettings['crypto']['rateType'],
        fixedRate: s.cryptoFixedRate as number | null,
        networkFee: s.cryptoNetworkFee as number,
      },
      stars: {
        enabled: s.starsEnabled as boolean,
        botToken: s.starsBotToken ? '••••••••' : null,
        rate: s.starsRate as number,
        digitalOnly: s.starsDigitalOnly as boolean,
      },
      cash: {
        enabled: s.cashEnabled as boolean,
        instructions: s.cashInstructions as string | null,
      },
      cardTransfer: {
        enabled: s.cardTransferEnabled as boolean,
        cardNumber: s.cardTransferCardNumber as string | null,
        holderName: s.cardTransferHolderName as string | null,
        bankName: normalizeBankName(s.cardTransferBankName as string | null),
        phone: s.cardTransferPhone as string | null,
      },
    };

    // Return full settings for admin, public-only for others
    return NextResponse.json(isAdmin ? result : getPublicSettings(result));
  } catch (error) {
    console.error('Error fetching payment settings:', error);
    return NextResponse.json(defaultPaymentSettings);
  }
}

// Extract only public (non-sensitive) settings for regular users
function getPublicSettings(settings: PaymentSettings): Record<string, unknown> {
  return {
    card: { enabled: settings.card.enabled },
    sbp: { 
      enabled: settings.sbp.enabled,
      phone: settings.sbp.phone,
      bankName: settings.sbp.bankName,
    },
    crypto: { 
      enabled: settings.crypto.enabled,
      network: settings.crypto.network,
    },
    stars: { enabled: settings.stars.enabled },
    cash: { 
      enabled: settings.cash.enabled,
      instructions: settings.cash.instructions,
    },
    cardTransfer: { 
      enabled: settings.cardTransfer.enabled,
      cardNumber: maskCardNumber(settings.cardTransfer.cardNumber),
      holderName: settings.cardTransfer.holderName,
      bankName: settings.cardTransfer.bankName,
    },
  };
}

// Mask card number showing only last 4 digits
function maskCardNumber(cardNumber: string | null): string | null {
  if (!cardNumber) return null;
  const cleaned = cardNumber.replace(/\D/g, '');
  if (cleaned.length < 4) return '••••';
  return '•••• •••• •••• ' + cleaned.slice(-4);
}

// POST save payment settings
export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, error: authError } = await verifyAdmin(request);
    if (authError) return authError;
    if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await request.json();
    // Check if paymentSettings model exists
    const dbAny: any = db;
    if (!db || !dbAny.paymentSettings) {
      console.error('[PaymentSettings API] Model not available, cannot save');
      return NextResponse.json({ error: 'Database not available' }, { status: 503 });
    }

    // Check if settings exist
    const existing = await dbAny.paymentSettings.findUnique({
      where: { id: SETTINGS_ID },
    });

    // Prepare update data
    const updateData = {
      id: SETTINGS_ID,
      // Card
      cardEnabled: data.card?.enabled ?? false,
      cardProvider: data.card?.provider ?? null,
      cardShopId: data.card?.shopId ?? null,
      cardSecretKey: data.card?.secretKey && data.card.secretKey !== '••••••••' 
        ? data.card.secretKey 
        : (existing as Record<string, unknown>)?.cardSecretKey ?? null,
      cardCommission: data.card?.commission ?? 0,
      cardTestMode: data.card?.testMode ?? true,
      // SBP
      sbpEnabled: data.sbp?.enabled ?? false,
      sbpPhone: data.sbp?.phone ?? null,
      sbpBankName: data.sbp?.bankName ?? null,
      sbpBankId: data.sbp?.bankId ?? null,
      sbpAutoReceipt: data.sbp?.autoReceipt ?? false,
      sbpSelfEmployed: data.sbp?.selfEmployed ?? false,
      // Crypto
      cryptoEnabled: data.crypto?.enabled ?? false,
      cryptoNetwork: data.crypto?.network ?? null,
      cryptoWallet: data.crypto?.walletAddress ?? null,
      cryptoRateType: data.crypto?.rateType ?? 'auto',
      cryptoFixedRate: data.crypto?.fixedRate ?? null,
      cryptoNetworkFee: data.crypto?.networkFee ?? 0,
      // Stars
      starsEnabled: data.stars?.enabled ?? false,
      starsBotToken: data.stars?.botToken && data.stars.botToken !== '••••••••'
        ? data.stars.botToken
        : (existing as Record<string, unknown>)?.starsBotToken ?? null,
      starsRate: data.stars?.rate ?? 0.5,
      starsDigitalOnly: data.stars?.digitalOnly ?? true,
      // Cash
      cashEnabled: data.cash?.enabled ?? false,
      cashInstructions: data.cash?.instructions ?? null,
      // Card Transfer
      cardTransferEnabled: data.cardTransfer?.enabled ?? false,
      cardTransferCardNumber: data.cardTransfer?.cardNumber ?? null,
      cardTransferHolderName: data.cardTransfer?.holderName ?? null,
      cardTransferBankName: data.cardTransfer?.bankName ?? null,
      cardTransferPhone: data.cardTransfer?.phone ?? null,
    };

    const settings = await dbAny.paymentSettings.upsert({
      where: { id: SETTINGS_ID },
      update: updateData,
      create: updateData,
    });
    
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('[PaymentSettings API] Error saving:', error);
    return NextResponse.json(
      { error: 'Failed to save payment settings', details: String(error) },
      { status: 500 }
    );
  }
}
