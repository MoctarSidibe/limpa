import { BASE_URL } from './api';

export const PRODUCT_IMAGES: Record<string, any> = {
  croissant: require('@/assets/images/croissant.png'),
  baguette:  require('@/assets/images/baguette.png'),
  bread:     require('@/assets/images/bread.png'),
  eclair:    require('@/assets/images/eclair.png'),
  tarte:     require('@/assets/images/tarte.png'),
  palmier:   require('@/assets/images/palmier.png'),
  sandwich:  require('@/assets/images/sandwich.png'),
};

/**
 * Returns the image source for a product.
 * - URL starting with /uploads/ → served from our server
 * - URL starting with http → absolute external URL
 * - Anything else → legacy key lookup in bundled assets
 */
export function getProductImage(imageKey: string | null | undefined): any {
  if (!imageKey) return PRODUCT_IMAGES.croissant;
  if (imageKey.startsWith('/uploads/')) return { uri: `${BASE_URL}${imageKey}` };
  if (imageKey.startsWith('http')) return { uri: imageKey };
  return PRODUCT_IMAGES[imageKey] ?? PRODUCT_IMAGES.croissant;
}
