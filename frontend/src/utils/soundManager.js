// Sound Manager for Auction Events
class SoundManager {
  constructor() {
    this.sounds = {};
    this.enabled = this.loadSoundPreference();
    this.unlocked = false; // Track if audio context is unlocked
    this.pendingSounds = []; // Queue sounds until unlocked
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

  // Unlock audio on first user interaction
  unlock() {
    if (this.unlocked) return;
    
    // Try to play a silent sound to unlock audio context
    Object.values(this.sounds).forEach(audio => {
      if (audio) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            audio.pause();
            audio.currentTime = 0;
          }).catch(() => {
            // Autoplay still blocked
          });
        }
      }
    });
    
    this.unlocked = true;
  }

  // Preload a sound file
  preload(name, path) {
    if (!this.sounds[name]) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = 0.7; // Set default volume to 70%
      
      // Load the audio file
      audio.load();
      
      this.sounds[name] = audio;
    }
  }

  // Play a sound
  play(name) {
    if (!this.enabled || !this.sounds[name]) return;
    
    // Unlock audio on first play attempt
    if (!this.unlocked) {
      this.unlock();
    }
    
    try {
      const audio = this.sounds[name];
      
      // Clone the audio for overlapping sounds
      const soundClone = audio.cloneNode();
      soundClone.volume = audio.volume;
      
      soundClone.currentTime = 0;
      const playPromise = soundClone.play();
      
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          // Autoplay blocked - try to unlock on next user interaction
          if (error.name === 'NotAllowedError') {
            this.unlocked = false;
            
            // Add one-time click listener to unlock
            const unlockHandler = () => {
              this.unlock();
              document.removeEventListener('click', unlockHandler);
              document.removeEventListener('touchstart', unlockHandler);
            };
            
            document.addEventListener('click', unlockHandler, { once: true });
            document.addEventListener('touchstart', unlockHandler, { once: true });
          }
        });
      }
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
  
  // Set volume for all sounds (0.0 to 1.0)
  setVolume(volume) {
    Object.values(this.sounds).forEach(audio => {
      if (audio) {
        audio.volume = Math.max(0, Math.min(1, volume));
      }
    });
  }
}

// Export singleton instance
export const soundManager = new SoundManager();

// Auto-unlock on first user interaction
if (typeof document !== 'undefined') {
  const unlockAudio = () => {
    soundManager.unlock();
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
  };
  
  document.addEventListener('click', unlockAudio, { once: true });
  document.addEventListener('touchstart', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });
}

