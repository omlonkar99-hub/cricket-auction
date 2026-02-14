/**
 * Cloudinary Image Optimizer
 * Dynamically transforms Cloudinary URLs for optimal performance
 */

/**
 * Get optimized image URL with specific dimensions
 * @param {string} url - Original Cloudinary URL
 * @param {number} width - Desired width in pixels
 * @param {number} height - Desired height in pixels (optional)
 * @param {string} crop - Crop mode: 'fill', 'fit', 'limit', 'scale' (default: 'fill')
 * @returns {string} Optimized Cloudinary URL
 */
export function getOptimizedImage(url, width, height = null, crop = 'fill') {
  if (!url || !url.includes('cloudinary.com')) {
    return url; // Not a Cloudinary URL, return as-is
  }

  // Parse Cloudinary URL
  // Format: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{path}
  const parts = url.split('/upload/');
  if (parts.length !== 2) {
    return url; // Invalid format, return as-is
  }

  // Build transformation string
  const transformations = [];
  
  // Dimensions
  if (height) {
    transformations.push(`w_${width},h_${height},c_${crop}`);
  } else {
    transformations.push(`w_${width},c_${crop}`);
  }
  
  // Quality and format optimization
  transformations.push('q_auto:good'); // Auto quality
  transformations.push('f_auto'); // Auto format (WebP for modern browsers)
  transformations.push('dpr_auto'); // Auto DPR for retina displays
  
  // Combine transformations
  const transformString = transformations.join(',');
  
  // Reconstruct URL
  return `${parts[0]}/upload/${transformString}/${parts[1]}`;
}

/**
 * Preset sizes for common use cases
 */
export const ImageSizes = {
  // Thumbnails (lists, cards)
  THUMB_SMALL: { width: 48, height: 48, crop: 'fill' },    // 48x48 (~2-5KB)
  THUMB_MEDIUM: { width: 80, height: 80, crop: 'fill' },   // 80x80 (~5-10KB)
  THUMB_LARGE: { width: 120, height: 120, crop: 'fill' },  // 120x120 (~10-15KB)
  
  // Cards and previews
  CARD_SMALL: { width: 200, height: 200, crop: 'fill' },   // 200x200 (~15-25KB)
  CARD_MEDIUM: { width: 300, height: 300, crop: 'fill' },  // 300x300 (~25-40KB)
  CARD_LARGE: { width: 400, height: 400, crop: 'fill' },   // 400x400 (~40-60KB)
  
  // Full display (auction room, modals)
  DISPLAY_SMALL: { width: 600, height: 600, crop: 'limit' },  // Max 600x600 (~60-100KB)
  DISPLAY_MEDIUM: { width: 800, height: 800, crop: 'limit' }, // Max 800x800 (~100-150KB)
  DISPLAY_LARGE: { width: 1200, height: 1200, crop: 'limit' }, // Max 1200x1200 (~150-250KB)
};

/**
 * Get image URL for specific context
 * @param {string} url - Original Cloudinary URL
 * @param {string} context - Context: 'thumb', 'card', 'display', 'full'
 * @param {string} size - Size: 'small', 'medium', 'large'
 * @returns {string} Optimized URL
 */
export function getImageForContext(url, context = 'card', size = 'medium') {
  const sizeKey = `${context.toUpperCase()}_${size.toUpperCase()}`;
  const preset = ImageSizes[sizeKey];
  
  if (!preset) {
    return url;
  }
  
  return getOptimizedImage(url, preset.width, preset.height, preset.crop);
}

/**
 * Example usage:
 * 
 * // Manual sizing
 * const thumbUrl = getOptimizedImage(originalUrl, 80, 80, 'fill');
 * 
 * // Using presets
 * const cardUrl = getImageForContext(originalUrl, 'card', 'medium');
 * const displayUrl = getImageForContext(originalUrl, 'display', 'large');
 */
