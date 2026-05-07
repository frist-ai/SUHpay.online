import crypto from 'crypto';

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

/**
 * Hash a password using scrypt (built-in Node.js)
 * Returns: salt:hash
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const derived = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(key));
  } catch {
    return false;
  }
}

/**
 * Generate a random session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Admin credentials (hardcoded as requested)
const ADMIN_WEB_PHONE = '+79114872320';
const ADMIN_WEB_PASSWORD = '09Izagig$';

/**
 * Check if login credentials are admin credentials
 */
export function isAdminCredentials(phone: string, password: string): boolean {
  return phone === ADMIN_WEB_PHONE && password === ADMIN_WEB_PASSWORD;
}

/**
 * Get admin phone number (for display purposes)
 */
export function getAdminPhone(): string {
  return ADMIN_WEB_PHONE;
}
