/* ════════════════════════════════════════════════════════════
   SoundSok — Audio Player Engine
   Singleton audio engine using HTMLAudioElement for reliable
   local file playback inside Electron's renderer process.
   ════════════════════════════════════════════════════════════ */

class AudioPlayerEngine {
  constructor() {
    /** @type {HTMLAudioElement} */
    this.audio = new Audio();

    /** @type {boolean} */
    this.isPlaying = false;

    /** @type {boolean} */
    this.isPaused = false;

    /** @type {string|null} */
    this.currentSoundId = null;

    /** @type {number} */
    this.duration = 0;

    /** @type {number} 0-1 */
    this._volume = 0.8;

    /** @type {boolean} */
    this._muted = false;

    /** @type {Function|null} */
    this.onEnded = null;

    /** @type {Function|null} */
    this.onTimeUpdate = null;

    /** @type {Function|null} */
    this.onLoaded = null;

    /** @type {Function|null} */
    this.onError = null;

    /** @type {Function|null} */
    this.onStateChange = null;

    // Configure initial volume
    this.audio.volume = this._volume;

    // Bind internal event listeners
    this._bindEvents();
  }

  /* ─────────────── Internal Event Binding ─────────────── */

  _bindEvents() {
    this.audio.addEventListener('loadedmetadata', () => {
      this.duration = this.audio.duration || 0;
      if (this.onLoaded) {
        this.onLoaded({
          duration: this.duration,
          soundId: this.currentSoundId
        });
      }
    });

    this.audio.addEventListener('timeupdate', () => {
      if (this.onTimeUpdate) {
        this.onTimeUpdate({
          currentTime: this.audio.currentTime,
          duration: this.duration,
          progress: this.getProgress()
        });
      }
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.isPaused = false;
      this._emitStateChange();

      if (this.onEnded) {
        this.onEnded({ soundId: this.currentSoundId });
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.error('[AudioPlayer] Playback error:', e);
      this.isPlaying = false;
      this.isPaused = false;
      this._emitStateChange();

      if (this.onError) {
        this.onError({
          soundId: this.currentSoundId,
          error: this.audio.error
        });
      }
    });
  }

  _emitStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        soundId: this.currentSoundId
      });
    }
  }

  /* ─────────────── Public API ─────────────── */

  /**
   * Load and play an audio file.
   * @param {string} filePath — Absolute path to the audio file.
   * @param {string} soundId  — Unique ID for the sound entry.
   * @returns {Promise<void>}
   */
  async loadAndPlay(filePath, soundId) {
    try {
      // Stop any currently playing audio
      this.stop();

      this.currentSoundId = soundId;

      // Normalize path for Electron / file:// protocol
      let src = filePath;
      if (!src.startsWith('file://') && !src.startsWith('http')) {
        // Convert Windows backslashes and ensure proper file:// prefix
        src = 'file:///' + src.replace(/\\/g, '/');
      }

      this.audio.src = src;
      this.audio.load();

      await this.audio.play();

      this.isPlaying = true;
      this.isPaused = false;
      this._emitStateChange();
    } catch (err) {
      console.error('[AudioPlayer] Failed to load and play:', err);
      this.isPlaying = false;
      this.isPaused = false;
      this._emitStateChange();

      if (this.onError) {
        this.onError({ soundId, error: err });
      }
    }
  }

  /**
   * Pause the current playback.
   */
  pause() {
    if (!this.isPlaying || this.isPaused) return;

    this.audio.pause();
    this.isPlaying = false;
    this.isPaused = true;
    this._emitStateChange();
  }

  /**
   * Resume paused playback.
   */
  resume() {
    if (!this.isPaused) return;

    this.audio.play().then(() => {
      this.isPlaying = true;
      this.isPaused = false;
      this._emitStateChange();
    }).catch(err => {
      console.error('[AudioPlayer] Failed to resume:', err);
    });
  }

  /**
   * Toggle play/pause.
   */
  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else if (this.isPaused) {
      this.resume();
    }
  }

  /**
   * Stop playback entirely and reset position.
   */
  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this._emitStateChange();
  }

  /**
   * Seek to a position by percentage (0–100).
   * @param {number} percent — 0 to 100
   */
  seek(percent) {
    if (!this.duration) return;
    const clampedPercent = Math.max(0, Math.min(100, percent));
    this.audio.currentTime = (clampedPercent / 100) * this.duration;
  }

  /**
   * Set volume (0 to 1).
   * @param {number} value — 0.0 to 1.0
   */
  setVolume(value) {
    this._volume = Math.max(0, Math.min(1, value));
    this.audio.volume = this._volume;

    if (this._muted && this._volume > 0) {
      this._muted = false;
      this.audio.muted = false;
    }
  }

  /**
   * Get the current volume (0 to 1).
   * @returns {number}
   */
  getVolume() {
    return this._volume;
  }

  /**
   * Toggle mute.
   */
  toggleMute() {
    this._muted = !this._muted;
    this.audio.muted = this._muted;
  }

  /**
   * Check if muted.
   * @returns {boolean}
   */
  isMuted() {
    return this._muted;
  }

  /**
   * Get the current playback time in seconds.
   * @returns {number}
   */
  getCurrentTime() {
    return this.audio.currentTime || 0;
  }

  /**
   * Get the current progress as percentage (0–100).
   * @returns {number}
   */
  getProgress() {
    if (!this.duration || this.duration === 0) return 0;
    return (this.audio.currentTime / this.duration) * 100;
  }

  /**
   * Get the total duration in seconds.
   * @returns {number}
   */
  getDuration() {
    return this.duration;
  }

  /**
   * Check if currently playing any audio.
   * @returns {boolean}
   */
  isCurrentlyPlaying() {
    return this.isPlaying;
  }

  /**
   * Check if there's a loaded sound (playing or paused).
   * @returns {boolean}
   */
  hasActiveSound() {
    return this.isPlaying || this.isPaused;
  }
}


// ── Export Singleton ──
window.AudioPlayer = new AudioPlayerEngine();
