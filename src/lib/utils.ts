import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get Russian plural form for a number
 * @param number - The number
 * @param one - Form for 1 (товар)
 * @param few - Form for 2-4 (товара)
 * @param many - Form for 5-20, 25-30... (товаров)
 * @returns Correct plural form
 * 
 * Examples:
 * pluralize(1, 'товар', 'товара', 'товаров') -> 'товар'
 * pluralize(2, 'товар', 'товара', 'товаров') -> 'товара'
 * pluralize(5, 'товар', 'товара', 'товаров') -> 'товаров'
 * pluralize(21, 'товар', 'товара', 'товаров') -> 'товар'
 */
export function pluralize(number: number, one: string, few: string, many: string): string {
  const n = Math.abs(number);
  const n10 = n % 10;
  const n100 = n % 100;
  
  // 11-14 use "many" form (11 товаров, 12 товаров...)
  if (n10 === 1 && n100 !== 11) {
    return one;
  }
  
  // 2-4, 22-24, 32-34... use "few" form (2 товара, 22 товара...)
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) {
    return few;
  }
  
  // Everything else uses "many" form
  return many;
}

/**
 * Russian month names in genitive case (для дат "с января 2025 г.")
 */
const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

/**
 * Format date with month in genitive case
 * @param date - Date object or ISO string
 * @returns String like "марта 2025 г."
 */
export function formatDateGenitive(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = MONTHS_GENITIVE[d.getMonth()];
  const year = d.getFullYear();
  return `${month} ${year} г.`;
}

/**
 * Format full date with month in genitive case
 * @param date - Date object or ISO string
 * @returns String like "15 марта 2025 г."
 */
export function formatDateFullGenitive(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = d.getDate();
  const month = MONTHS_GENITIVE[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year} г.`;
}

/**
 * Format price in Russian locale
 * @param price - Number to format
 * @returns String like "1 250 ₽"
 */
export function formatPrice(price: number): string {
  return price.toLocaleString('ru-RU') + ' ₽';
}

/**
 * Format relative time ago in Russian
 * @param date - Date string or Date object
 * @returns String like "5 мин назад", "2 часа назад", "вчера"
 */
export function formatRelativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'только что';
  if (diffMin < 60) return `${diffMin} ${pluralize(diffMin, 'мин', 'мин', 'мин')} назад`;
  if (diffHour < 24) return `${diffHour} ${pluralize(diffHour, 'час', 'часа', 'часов')} назад`;
  if (diffDay === 1) return 'вчера';
  if (diffDay < 7) return `${diffDay} ${pluralize(diffDay, 'день', 'дня', 'дней')} назад`;
  return new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
