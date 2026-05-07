/**
 * Строгая валидация телефонного номера (РФ).
 *
 * Поддерживаемые форматы:
 *   89113456789           — 11 цифр без знака +
 *   +79109006656          — 11 цифр со знаком +
 *   +7 (999) 999-99-99    — с пробелами, скобками и дефисами
 *   8 (999) 999-99-99     — то же, начинающееся с 8
 *   79999999999           — 11 цифр, начинающихся с 7
 *   +79999999999          — со знаком +
 *
 * Правила:
 *   - Допускаются символы: цифры, пробел, +, -, (, )
 *   - После очистки от форматирования остаётся 10 или 11 цифр
 *   - Первая цифра: 7 или 8 (если 11 цифр) или любая (если 10 цифр — районный)
 *   - Три цифры после кода страны (DEF) должны быть в диапазоне 900–999
 *   - Минимум 10 цифр (код без 8/7)
 *   - Максимум 11 цифр
 */
export function validatePhone(phone: string): string | null {
  const trimmed = (phone || '').trim();

  if (!trimmed) return 'Укажите номер телефона';

  // Только допустимые символы
  if (!/^[\d\s\-+()]+$/.test(trimmed)) {
    return 'Недопустимые символы в номере';
  }

  // Извлекаем чистые цифры
  const digits = trimmed.replace(/[^\d]/g, '');

  if (digits.length < 10) return 'Слишком короткий номер (мин. 10 цифр)';
  if (digits.length > 11) return 'Слишком длинный номер (макс. 11 цифр)';

  // 11 цифр — первая должна быть 7 или 8
  if (digits.length === 11 && !/^[78]/.test(digits)) {
    return 'Номер должен начинаться с 7 или 8';
  }

  // Определяем 10 цифр номера (без кода страны 7/8)
  const tenDigits = digits.length === 11 ? digits.slice(1) : digits;

  // DEF-код (первые 3 цифры после 7/8) должен быть 900–999
  const defCode = parseInt(tenDigits.slice(0, 3), 10);
  if (defCode < 900 || defCode > 999) {
    return 'Некорректный код оператора (должен быть 900–999)';
  }

  return null; // валидно
}

/**
 * Нормализация телефона к единому формату +7XXXXXXXXXX
 */
export function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/[^\d]/g, '');

  if (digits.length === 10) {
    return `+7${digits}`;
  }

  // 11 цифр: если начинается с 8 → заменить на +7
  if (digits.length === 11) {
    return `+7${digits.slice(1)}`;
  }

  return phone; // fallback: вернуть как есть
}

/**
 * Валидация полей адреса.
 * Возвращает объект { field: errorMessage } — пустой если всё ок.
 */
export function validateAddress(data: {
  city?: string;
  street?: string;
  house?: string;
  apartment?: string;
  entrance?: string;
  floor?: string;
  postalCode?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  const city = (data.city || '').trim();
  const street = (data.street || '').trim();
  const house = (data.house || '').trim();
  const apartment = (data.apartment || '').trim();
  const entrance = (data.entrance || '').trim();
  const floor = (data.floor || '').trim();
  const postalCode = (data.postalCode || '').trim();

  if (!city) {
    errors.city = 'Укажите город';
  } else if (!/^[А-ЯЁа-яёA-Za-z\s\-\.]+$/.test(city)) {
    errors.city = 'Некорректный город';
  } else if (city.length < 1) {
    errors.city = 'Слишком короткое название города';
  }

  if (!street) {
    errors.street = 'Укажите улицу';
  } else if (!/^[А-ЯЁа-яёA-Za-z0-9\s\-\.]+$/.test(street)) {
    errors.street = 'Некорректная улица';
  }

  if (!house) {
    errors.house = 'Укажите номер дома';
  } else if (!/^[А-ЯЁа-яёA-Za-z0-9\s\-\/]+$/.test(house)) {
    errors.house = 'Некорректный номер дома';
  }

  if (apartment && !/^[А-ЯЁа-яёA-Za-z0-9\s\-]+$/.test(apartment)) {
    errors.apartment = 'Некорректный номер квартиры';
  }

  if (entrance && !/^[А-ЯЁа-яёA-Za-z0-9\s\-]+$/.test(entrance)) {
    errors.entrance = 'Некорректный подъезд';
  }

  if (floor && !/^\d{1,3}$/.test(floor)) {
    errors.floor = 'Этаж должен быть числом (1–3 цифры)';
  }

  if (postalCode && !/^\d{6}$/.test(postalCode)) {
    errors.postalCode = 'Индекс должен содержать 6 цифр';
  }

  return errors;
}
