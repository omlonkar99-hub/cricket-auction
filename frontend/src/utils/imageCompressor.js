/**
 * Client-side Image Compression Utility
 * Compresses images before upload to improve performance
 */

/**
 * Compress an image file
 * @param {File} file - Original image file
 * @param {Object} options - Compression options
 * @returns {Promise<File>} Compressed image file
 */
export function compressImage(file, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      maxWidth = 800,
      maxHeight = 800,
      quality = 0.8,
      format = 'jpeg'
    } = options;

    // Create canvas and context
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas to Blob conversion failed'));
            return;
          }

          // Create new File object
          const compressedFile = new File([blob], file.name, {
            type: `image/${format}`,
            lastModified: Date.now()
          });

          resolve(compressedFile);
        },
        `image/${format}`,
        quality
      );
    };

    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Smart compression based on file size
 * @param {File} file - Original image file
 * @returns {Promise<File>} Compressed image file
 */
export function smartCompress(file) {
  const fileSizeMB = file.size / (1024 * 1024);
  
  // No compression needed for small files
  if (fileSizeMB < 0.5) {
    return Promise.resolve(file);
  }
  
  // Aggressive compression for large files
  if (fileSizeMB > 2) {
    return compressImage(file, {
      maxWidth: 600,
      maxHeight: 600,
      quality: 0.7,
      format: 'jpeg'
    });
  }
  
  // Moderate compression for medium files
  return compressImage(file, {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.8,
    format: 'jpeg'
  });
}

/**
 * Get file size info
 * @param {File} file - Image file
 * @returns {Object} Size information
 */
export function getFileSizeInfo(file) {
  const bytes = file.size;
  const kb = bytes / 1024;
  const mb = kb / 1024;
  
  return {
    bytes,
    kb: Math.round(kb * 100) / 100,
    mb: Math.round(mb * 100) / 100,
    formatted: mb > 1 ? `${Math.round(mb * 10) / 10}MB` : `${Math.round(kb)}KB`
  };
}