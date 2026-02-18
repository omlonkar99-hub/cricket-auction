// Sound Manager for Auction Events
class SoundManager {
  constructor() {
    this.sounds = {};
    this.enabled = this.loadSoundPreference();
  }

  // Load sound preference from localStorage
  loadSoundPreference() {
    const saved = localStorage.getItem('auction_sound_enabled');
    return saved === null ? true : saved === 'true';
  }

  // Save sound preference to localStorage
  saveSoundPreference(enabled) {
    localStorage.setItem('auction_sound_enabled', enabled.toString());
    this.enabled = enabled;
  }

  // Preload a sound file
  preload(name, path) {
    if (!this.sounds[name]) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      this.sounds[name] = audio;
    }
  }

  // Play a sound
  play(name) {
    if (!this.enabled || !this.sounds[name]) return;
    
    try {
      const audio = this.sounds[name];
      audio.currentTime = 0; // Reset to start
      audio.play().catch(() => {
        // Silent error - autoplay might be blocked
      });
    } catch (e) {
      // Silent error - sound playback failed
    }
  }

  // Toggle sound on/off
  toggle() {
    this.enabled = !this.enabled;
    this.saveSoundPreference(this.enabled);
    return this.enabled;
  }

  // Check if sound is enabled
  isEnabled() {
    return this.enabled;
  }
}

// Export singleton instance
export const soundManager = new SoundManager();
