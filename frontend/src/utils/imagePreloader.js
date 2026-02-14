// Image preloader for instant player transitions (1ms target)
class ImagePreloader {
  constructor() {
    this.cache = new Map();
    this.preloadQueue = [];
    this.maxConcurrent = 6; // Parallel loading
  }

  // Preload a single image with priority
  preload(url, priority = 'auto') {
    if (!url || this.cache.has(url)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      
      // Set priority for faster loading
      if (priority === 'high') {
        img.fetchPriority = 'high';
      }
      
      // Decode image immediately for instant display
      img.decode().then(() => {
        this.cache.set(url, img);
        resolve(img);
      }).catch(() => {
        // Fallback if decode not supported
        this.cache.set(url, img);
        resolve(img);
      });
      
      img.onload = () => {
        if (!this.cache.has(url)) {
          this.cache.set(url, img);
          resolve(img);
        }
      };
      
      img.onerror = () => {
        reject();
      };
      
      img.src = url;
    });
  }

  // Preload multiple images in parallel
  preloadBatch(urls, priority = 'auto') {
    const promises = urls
      .filter(url => url && !this.cache.has(url))
      .map(url => this.preload(url, priority));
    
    return Promise.all(promises);
  }

  // Aggressive preloading: next 5 players + all team logos
  preloadNextPlayers(players, currentIndex, count = 5) {
    const nextPlayers = players.slice(currentIndex + 1, currentIndex + 1 + count);
    const urls = nextPlayers
      .map(player => player.image)
      .filter(Boolean);
    
    // High priority for next player, auto for rest
    if (urls.length > 0) {
      this.preload(urls[0], 'high');
      if (urls.length > 1) {
        this.preloadBatch(urls.slice(1), 'auto');
      }
    }
  }

  // Preload all team logos at auction start
  preloadTeamLogos(teams) {
    const urls = teams
      .map(team => team.logo)
      .filter(Boolean);
    
    return this.preloadBatch(urls, 'high');
  }

  // Preload all player images at auction start (background)
  preloadAllPlayers(players) {
    const urls = players
      .map(player => player.image)
      .filter(Boolean);
    
    // Load in chunks to avoid blocking
    const chunkSize = this.maxConcurrent;
    let index = 0;
    
    const loadChunk = () => {
      const chunk = urls.slice(index, index + chunkSize);
      if (chunk.length === 0) return;
      
      this.preloadBatch(chunk).finally(() => {
        index += chunkSize;
        setTimeout(loadChunk, 100); // Small delay between chunks
      });
    };
    
    loadChunk();
  }

  // Get cached image for instant display
  getCached(url) {
    return this.cache.get(url);
  }

  // Clear cache
  clear() {
    this.cache.clear();
  }

  // Check if image is cached
  isCached(url) {
    return this.cache.has(url);
  }
}

// Singleton instance
export const imagePreloader = new ImagePreloader();

// Hook for Solid components
export function useImagePreloader() {
  return imagePreloader;
}
