/**
 * Safely parse product images JSON string to array of URLs.
 * Returns empty array if parsing fails or input is invalid.
 */
export function parseProductImages(images: string | null | undefined): string[] {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter((url: string) => typeof url === 'string' && url.length > 0) : [];
  } catch {
    return [];
  }
}

/**
 * Get the first valid image URL from product images JSON.
 * Returns empty string if no valid image found.
 */
export function getProductImage(images: string | null | undefined): string {
  const parsed = parseProductImages(images);
  return parsed[0] || '';
}
