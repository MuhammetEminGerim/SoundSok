/* ════════════════════════════════════════════════════════════
   SoundSok — Audio Player Engine
   Singleton audio engine using HTMLAudioElement for reliable
   local file playback inside Electron's renderer process.
   ════════════════════════════════════════════════════════════ */

class AudioPlayerEngine {
  constructor() {
    /** @type {HTMLAudioElement} Primary element for Speaker output */
    this.audioSpeakers = new Audio();

    /** @type {HTMLAudioElement} Secondary element for Microphone (Virtual Cable) output */
    this.audioMic = new Audio();

    /** @type {boolean} */
    this.isPlaying = false;

    /** @type {boolean} */
    this.isPaused = false;

    /** @type {string|null} */
    this.currentSoundId = null;

    /** @type {number} */
    this.duration = 0;

    /** @type {number} 0-1 */
    this._volume = parseFloat(localStorage.getItem('volume') || '0.8');

    /** @type {number} 0-1 */
    this._currentSoundVolume = 1.0;

    /** @type {boolean} */
    this._muted = false;

    /** @type {'speakers'|'microphone'|'both'} */
    this.playMode = localStorage.getItem('playMode') || 'speakers';

    /** @type {string} */
    this.speakerDeviceId = localStorage.getItem('speakerDeviceId') || 'default';

    /** @type {string} */
    this.micDeviceId = localStorage.getItem('micDeviceId') || '';

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

    // Apply initial volume
    this._updateActualVolumes();

    // Bind internal event listeners
    this._bindEvents();
  }

  /* ─────────────── Device Configuration ─────────────── */

  /**
   * Set the speaker output device.
   * @param {string} deviceId
   */
  async setSpeakerDevice(deviceId) {
    this.speakerDeviceId = deviceId || 'default';
    localStorage.setItem('speakerDeviceId', this.speakerDeviceId);
    
    if (this.audioSpeakers.setSinkId) {
      try {
        await this.audioSpeakers.setSinkId(this.speakerDeviceId);
        console.log('[AudioPlayer] Speaker output device set to:', deviceId);
      } catch (err) {
        console.error('[AudioPlayer] Failed to set speaker sink ID:', err);
      }
    }
  }

  /**
   * Set the microphone (virtual cable) output device.
   * @param {string} deviceId
   */
  async setMicDevice(deviceId) {
    this.micDeviceId = deviceId || '';
    localStorage.setItem('micDeviceId', this.micDeviceId);
    
    if (this.audioMic.setSinkId && this.micDeviceId) {
      try {
        await this.audioMic.setSinkId(this.micDeviceId);
        console.log('[AudioPlayer] Mic/Cable output device set to:', deviceId);
      } catch (err) {
        console.error('[AudioPlayer] Failed to set mic sink ID:', err);
      }
    }
  }

  /**
   * Set the active playback mode.
   * @param {'speakers'|'microphone'|'both'} mode
   */
  setPlayMode(mode) {
    if (['speakers', 'microphone', 'both'].includes(mode)) {
      this.playMode = mode;
      localStorage.setItem('playMode', mode);
      console.log('[AudioPlayer] Playback mode set to:', mode);
      this._emitStateChange();
    }
  }

  /* ─────────────── Internal Event Binding ─────────────── */

  /**
   * Get the primary Audio element driving the UI.
   * @returns {HTMLAudioElement}
   * @private
   */
  _getPrimaryAudio() {
    return this.playMode === 'microphone' ? this.audioMic : this.audioSpeakers;
  }

  _bindEvents() {
    // We bind metadata, time update, and ended listeners to both elements,
    // but only let the active primary element drive the UI updates.

    const setupListeners = (audioEl, name) => {
      audioEl.addEventListener('loadedmetadata', () => {
        if (audioEl !== this._getPrimaryAudio()) return;
        this.duration = audioEl.duration || 0;
        if (this.onLoaded) {
          this.onLoaded({
            duration: this.duration,
            soundId: this.currentSoundId
          });
        }
      });

      audioEl.addEventListener('play', () => {
        this._updateActualVolumes();
      });

      audioEl.addEventListener('playing', () => {
        this._updateActualVolumes();
      });

      audioEl.addEventListener('timeupdate', () => {
        if (audioEl !== this._getPrimaryAudio()) return;
        if (this.onTimeUpdate) {
          this.onTimeUpdate({
            currentTime: audioEl.currentTime,
            duration: this.duration,
            progress: this.getProgress()
          });
        }
      });

      audioEl.addEventListener('ended', () => {
        if (audioEl !== this._getPrimaryAudio()) return;
        this.isPlaying = false;
        this.isPaused = false;
        this._emitStateChange();

        if (this.onEnded) {
          this.onEnded({ soundId: this.currentSoundId });
        }
      });

      audioEl.addEventListener('error', (e) => {
        if (audioEl !== this._getPrimaryAudio()) return;
        console.error(`[AudioPlayer] Playback error on ${name}:`, e);
        this.isPlaying = false;
        this.isPaused = false;
        this._emitStateChange();

        if (this.onError) {
          this.onError({
            soundId: this.currentSoundId,
            error: audioEl.error
          });
        }
      });
    };

    setupListeners(this.audioSpeakers, 'Speakers');
    setupListeners(this.audioMic, 'Microphone');
  }

  _emitStateChange() {
    if (this.onStateChange) {
      this.onStateChange({
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        soundId: this.currentSoundId,
        playMode: this.playMode
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
      this.stop();

      this.currentSoundId = soundId;

      // Retrieve individual sound volume
      let soundVolume = 1.0;
      if (window.SoundList) {
        const soundItem = window.SoundList.getSoundById(soundId);
        if (soundItem && typeof soundItem.volume === 'number') {
          soundVolume = soundItem.volume;
        }
      }
      this._currentSoundVolume = soundVolume;
      this._updateActualVolumes();

      // Normalize path for Electron / file:// protocol
      let src = filePath;
      if (!src.startsWith('file://') && !src.startsWith('http')) {
        src = 'file:///' + src.replace(/\\/g, '/');
      }

      // Configure targets according to mode
      const playSpeakers = (this.playMode === 'speakers' || this.playMode === 'both');
      const playMic = (this.playMode === 'microphone' || this.playMode === 'both');

      const promises = [];

      if (playSpeakers) {
        this.audioSpeakers.src = src;
        this.audioSpeakers.load();
        if (this.audioSpeakers.setSinkId) {
          await this.audioSpeakers.setSinkId(this.speakerDeviceId);
        }
        this._updateActualVolumes();
        promises.push(this.audioSpeakers.play());
      }

      if (playMic && this.micDeviceId) {
        this.audioMic.src = src;
        this.audioMic.load();
        if (this.audioMic.setSinkId) {
          await this.audioMic.setSinkId(this.micDeviceId);
        }
        this._updateActualVolumes();
        promises.push(this.audioMic.play());
      }

      await Promise.all(promises);

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
   * Pause current playback.
   */
  pause() {
    if (!this.isPlaying || this.isPaused) return;

    this.audioSpeakers.pause();
    this.audioMic.pause();

    this.isPlaying = false;
    this.isPaused = true;
    this._emitStateChange();
  }

  /**
   * Resume paused playback.
   */
  resume() {
    if (!this.isPaused) return;

    const playSpeakers = (this.playMode === 'speakers' || this.playMode === 'both');
    const playMic = (this.playMode === 'microphone' || this.playMode === 'both');

    const promises = [];
    if (playSpeakers) promises.push(this.audioSpeakers.play());
    if (playMic && this.micDeviceId) promises.push(this.audioMic.play());

    Promise.all(promises).then(() => {
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
    this.audioSpeakers.pause();
    this.audioSpeakers.currentTime = 0;
    this.audioSpeakers.src = '';

    this.audioMic.pause();
    this.audioMic.currentTime = 0;
    this.audioMic.src = '';

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
    const targetTime = (clampedPercent / 100) * this.duration;

    const playSpeakers = (this.playMode === 'speakers' || this.playMode === 'both');
    const playMic = (this.playMode === 'microphone' || this.playMode === 'both');

    if (playSpeakers) this.audioSpeakers.currentTime = targetTime;
    if (playMic && this.micDeviceId) this.audioMic.currentTime = targetTime;
  }

  _updateActualVolumes() {
    const soundVol = typeof this._currentSoundVolume === 'number' ? this._currentSoundVolume : 1.0;
    
    // Retrieve ratio values (default to 1.0)
    const speakerRatio = parseFloat(localStorage.getItem('speakerVolumeRatio') || '1.0');
    const micRatio = parseFloat(localStorage.getItem('micVolumeRatio') || '1.0');

    this.audioSpeakers.volume = this._volume * soundVol * speakerRatio;
    this.audioMic.volume = this._volume * soundVol * micRatio;
  }

  /**
   * Set volume (0 to 1).
   * @param {number} value — 0.0 to 1.0
   */
  setVolume(value) {
    this._volume = Math.max(0, Math.min(1, value));
    localStorage.setItem('volume', this._volume.toString());

    this._updateActualVolumes();

    if (this._muted && this._volume > 0) {
      this._muted = false;
      this.audioSpeakers.muted = false;
      this.audioMic.muted = false;
    }
  }

  /**
   * Get current volume (0 to 1).
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
    this.audioSpeakers.muted = this._muted;
    this.audioMic.muted = this._muted;
  }

  /**
   * Check if muted.
   * @returns {boolean}
   */
  isMuted() {
    return this._muted;
  }

  /**
   * Get current playback time in seconds.
   * @returns {number}
   */
  getCurrentTime() {
    const audio = this._getPrimaryAudio();
    return audio ? (audio.currentTime || 0) : 0;
  }

  /**
   * Get current progress as percentage (0–100).
   * @returns {number}
   */
  getProgress() {
    if (!this.duration || this.duration === 0) return 0;
    const audio = this._getPrimaryAudio();
    return audio ? ((audio.currentTime / this.duration) * 100) : 0;
  }

  /**
   * Get total duration in seconds.
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
