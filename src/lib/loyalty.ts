import { db } from '@/lib/db';

interface LoyaltySettings {
  pointsPerRub: number;
  pointsToRub: number;
  welcomeBonus: number;
  birthdayBonus: number;
  bronzeThreshold: number;
  bronzeMultiplier: number;
  silverThreshold: number;
  silverMultiplier: number;
  goldThreshold: number;
  goldMultiplier: number;
  platinumThreshold: number;
  platinumMultiplier: number;
  maxPointsPayment: number;
}

const defaultSettings: LoyaltySettings = {
  pointsPerRub: 1,
  pointsToRub: 0.01,
  welcomeBonus: 100,
  birthdayBonus: 500,
  bronzeThreshold: 0,
  bronzeMultiplier: 1,
  silverThreshold: 500,
  silverMultiplier: 1.5,
  goldThreshold: 2000,
  goldMultiplier: 2,
  platinumThreshold: 10000,
  platinumMultiplier: 3,
  maxPointsPayment: 50,
};

// Get loyalty settings from database
export async function getLoyaltySettings(): Promise<LoyaltySettings> {
  try {
    const setting = await db.setting.findUnique({
      where: { key: 'loyalty' },
    });
    return setting ? { ...defaultSettings, ...JSON.parse(setting.value) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

// Get user's loyalty level and multiplier
export async function getUserLoyaltyLevel(userId: string): Promise<{ level: string; multiplier: number }> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { totalSpent: true },
    });

    const settings = await getLoyaltySettings();
    const totalSpent = user?.totalSpent || 0;

    if (totalSpent >= (settings.platinumThreshold || 10000)) {
      return { level: 'platinum', multiplier: settings.platinumMultiplier || 3 };
    }
    if (totalSpent >= (settings.goldThreshold || 2000)) {
      return { level: 'gold', multiplier: settings.goldMultiplier || 2 };
    }
    if (totalSpent >= (settings.silverThreshold || 500)) {
      return { level: 'silver', multiplier: settings.silverMultiplier || 1.5 };
    }
    return { level: 'bronze', multiplier: settings.bronzeMultiplier || 1 };
  } catch {
    return { level: 'bronze', multiplier: 1 };
  }
}

// Add loyalty points to user
export async function addLoyaltyPoints(
  userId: string,
  amount: number,
  type: 'earn' | 'spend' | 'refund' | 'bonus' | 'birthday' | 'welcome',
  description: string,
  orderId?: string
): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { loyaltyPoints: true },
    });

    if (!user) return false;

    const newBalance = Math.max(0, user.loyaltyPoints + amount);

    // Create transaction record
    await db.loyaltyTransaction.create({
      data: {
        userId,
        type,
        amount,
        description,
        orderId,
        balance: newBalance,
      },
    });

    // Update user's points
    await db.user.update({
      where: { id: userId },
      data: { loyaltyPoints: newBalance },
    });

    return true;
  } catch (error) {
    console.error('Error adding loyalty points:', error);
    return false;
  }
}

// Calculate points earned from order
export async function calculateOrderPoints(userId: string, orderTotal: number): Promise<number> {
  const settings = await getLoyaltySettings();
  const { multiplier } = await getUserLoyaltyLevel(userId);
  
  // Points = orderTotal * pointsPerRub * multiplier
  return Math.floor(orderTotal * settings.pointsPerRub * multiplier);
}

// Calculate how much can be paid with points
export function calculatePointsDiscount(points: number, orderTotal: number, settings: LoyaltySettings): number {
  // Max discount is maxPointsPayment% of order total
  const maxDiscount = orderTotal * (settings.maxPointsPayment / 100);
  
  // Points value in rubles
  const pointsValue = points * settings.pointsToRub;
  
  // Return the smaller of the two
  return Math.min(maxDiscount, pointsValue);
}

// Award welcome bonus to new user
export async function awardWelcomeBonus(userId: string): Promise<boolean> {
  const settings = await getLoyaltySettings();
  
  if (settings.welcomeBonus > 0) {
    return addLoyaltyPoints(
      userId,
      settings.welcomeBonus,
      'welcome',
      'Приветственные бонусные баллы за регистрацию'
    );
  }
  return true;
}

// Award birthday bonus
export async function checkAndAwardBirthdayBonus(userId: string): Promise<boolean> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { birthday: true },
    });

    if (!user?.birthday) return false;

    const today = new Date();
    const birthday = new Date(user.birthday);
    
    // Check if today is user's birthday
    if (
      today.getMonth() === birthday.getMonth() &&
      today.getDate() === birthday.getDate()
    ) {
      // Check if already awarded this year
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const existingBonus = await db.loyaltyTransaction.findFirst({
        where: {
          userId,
          type: 'birthday',
          createdAt: { gte: startOfYear },
        },
      });

      if (!existingBonus) {
        const settings = await getLoyaltySettings();
        return addLoyaltyPoints(
          userId,
          settings.birthdayBonus,
          'birthday',
          `Подарок на день рождения! 🎂`
        );
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking birthday bonus:', error);
    return false;
  }
}

// Update user stats after order
export async function updateUserStatsAfterOrder(
  userId: string,
  orderTotal: number
): Promise<void> {
  try {
    await db.user.update({
      where: { id: userId },
      data: {
        totalSpent: { increment: orderTotal },
        ordersCount: { increment: 1 },
      },
    });
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
}
