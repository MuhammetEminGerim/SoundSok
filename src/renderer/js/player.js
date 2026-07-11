/* ════════════════════════════════════════════════════════════
   SoundSok — Player Controller
   Connects the AudioPlayer engine to the player bar UI.
   Manages progress updates, control actions, and visual state.
   ════════════════════════════════════════════════════════════ */

class PlayerController {
  constructor() {
    // DOM References (set during init)
    this.els = {
      soundName: null,
      currentTime: null,
      duration: null,
      progressInput: null,
      progressFill: null,
      progressContainer: null,
      btnPlayPause: null,
      iconPlay: null,
      iconPause: null,
      btnStop: null,
      btnPrev: null,
      btnNext: null,
      btnVolume: null,
      iconVolumeOn: null,
      iconVolumeMuted: null,
      volumeSlider: null,
      volumeFill: null,
      waveformBars: null
    };

    /** @type {number|null} rAF ID for progress updater */
    this._progressRAF = null;

    /** @type {boolean} */
    this._isSeekingProgress = false;

    /** @type {boolean} */
    this._isSeekingVolume = false;
  }

  /* ─────────────── Initialization ─────────────── */

  init() {
    // Grab DOM references
    this.els.soundName = document.getElementById('player-sound-name');
    this.els.currentTime = document.getElementById('player-current-time');
    this.els.duration = document.getElementById('player-duration');
    this.els.progressInput = document.getElementById('player-progress');
    this.els.progressFill = document.getElementById('player-progress-fill');
    this.els.progressContainer = document.getElementById('player-progress-container');
    this.els.btnPlayPause = document.getElementById('btn-play-pause');
    this.els.iconPlay = document.getElementById('icon-play');
    this.els.iconPause = document.getElementById('icon-pause');
    this.els.btnStop = document.getElementById('btn-stop');
    this.els.btnPrev = document.getElementById('btn-prev');
    this.els.btnNext = document.getElementById('btn-next');
    this.els.btnVolume = document.getElementById('btn-volume');
    this.els.iconVolumeOn = document.getElementById('icon-volume-on');
    this.els.iconVolumeMuted = document.getElementById('icon-volume-muted');
    this.els.volumeSlider = document.getElementById('volume-slider');
    this.els.volumeFill = document.getElementById('volume-fill');
    this.els.waveformBars = document.getElementById('waveform-bars');

    this._bindControlEvents();
    this._bindAudioPlayerCallbacks();
  }

  /* ─────────────── Event Binding ─────────────── */

  _bindControlEvents() {
    // Play / Pause
    this.els.btnPlayPause?.addEventListener('click', () => {
      if (!window.AudioPlayer.hasActiveSound()) return;
      window.AudioPlayer.togglePlayPause();
    });

    // Stop
    this.els.btnStop?.addEventListener('click', () => {
      window.AudioPlayer.stop();
      this.resetUI();
    });

    // Previous
    this.els.btnPrev?.addEventListener('click', () => {
      this._playPrev();
    });

    // Next
    this.els.btnNext?.addEventListener('click', () => {
      this._playNext();
    });

    // Progress Seek
    if (this.els.progressInput) {
      this.els.progressInput.addEventListener('mousedown', () => {
        this._isSeekingProgress = true;
      });

      this.els.progressInput.addEventListener('input', (e) => {
        const percent = parseFloat(e.target.value);
        this.updateProgress(percent);
      });

      this.els.progressInput.addEventListener('change', (e) => {
        const percent = parseFloat(e.target.value);
        window.AudioPlayer.seek(percent);
        this._isSeekingProgress = false;
      });

      this.els.progressInput.addEventListener('mouseup', () => {
        this._isSeekingProgress = false;
      });
    }

    // Volume
    if (this.els.volumeSlider) {
      this.els.volumeSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        this._handleVolumeChange(value);
      });
    }

    // Volume Mute Toggle
    this.els.btnVolume?.addEventListener('click', () => {
      window.AudioPlayer.toggleMute();
      this._updateVolumeIcon();
    });
  }

  _bindAudioPlayerCallbacks() {
    const ap = window.AudioPlayer;

    // Time update (from audio element)
    ap.onTimeUpdate = (data) => {
      if (!this._isSeekingProgress) {
        this.updateProgress(data.progress);
        this._updateTimeDisplay(data.currentTime, data.duration);
      }
    };

    // Metadata loaded
    ap.onLoaded = (data) => {
      if (this.els.duration) {
        this.els.duration.textContent = this._formatTime(data.duration);
      }
    };

    // State change (play, pause, stop)
    ap.onStateChange = (state) => {
      this.updatePlayState(state.isPlaying);

      if (!state.isPlaying && !state.isPaused) {
        // Stopped
        this.stopProgressUpdater();
        if (window.SoundList) {
          window.SoundList.clearPlayingState();
        }
      } else if (state.isPlaying) {
        this.startProgressUpdater();
        if (window.SoundList) {
          window.SoundList._updatePlayingState(state.soundId);
        }
      } else {
        // Paused
        this.stopProgressUpdater();
      }
    };

    // Ended
    ap.onEnded = (data) => {
      this.updatePlayState(false);
      this.stopProgressUpdater();

      // Auto-play next
      this._playNext();
    };

    // Error
    ap.onError = (data) => {
      console.error('[Player] Audio error for:', data.soundId, data.error);
      this.updatePlayState(false);
      this.stopProgressUpdater();
    };
  }

  /* ─────────────── UI Updates ─────────────── */

  /**
   * Update now-playing info in the player bar.
   * @param {Object} sound
   */
  updateNowPlaying(sound) {
    if (this.els.soundName) {
      this.els.soundName.textContent = sound.name || 'Bilinmeyen Ses';
      this.els.soundName.title = sound.name || '';
    }
    if (this.els.duration) {
      this.els.duration.textContent = this._formatTime(sound.duration || 0);
    }
    if (this.els.currentTime) {
      this.els.currentTime.textContent = '0:00';
    }

    this.updateProgress(0);
  }

  /**
   * Update progress bar visual.
   * @param {number} percent — 0 to 100
   */
  updateProgress(percent) {
    const clamped = Math.max(0, Math.min(100, percent));

    if (this.els.progressFill) {
      this.els.progressFill.style.width = `${clamped}%`;
    }
    if (this.els.progressInput && !this._isSeekingProgress) {
      this.els.progressInput.value = clamped;
    }
  }

  /**
   * Toggle play/pause button icon.
   * @param {boolean} isPlaying
   */
  updatePlayState(isPlaying) {
    if (this.els.iconPlay) {
      this.els.iconPlay.classList.toggle('hidden', isPlaying);
    }
    if (this.els.iconPause) {
      this.els.iconPause.classList.toggle('hidden', !isPlaying);
    }

    // Waveform animation
    if (this.els.waveformBars) {
      this.els.waveformBars.classList.toggle('active', isPlaying);
    }

    // Progress fill shimmer
    if (this.els.progressFill) {
      this.els.progressFill.classList.toggle('playing', isPlaying);
    }

    // Update button aria-label
    if (this.els.btnPlayPause) {
      this.els.btnPlayPause.setAttribute('aria-label', isPlaying ? 'Duraklat' : 'Oynat');
      this.els.btnPlayPause.setAttribute('title', isPlaying ? 'Duraklat' : 'Oynat');
    }
  }

  /**
   * Update the time display.
   * @param {number} current — seconds
   * @param {number} total   — seconds
   */
  _updateTimeDisplay(current, total) {
    if (this.els.currentTime) {
      this.els.currentTime.textContent = this._formatTime(current);
    }
    if (this.els.duration && total > 0) {
      this.els.duration.textContent = this._formatTime(total);
    }
  }

  /**
   * Handle volume slider change.
   * @param {number} value — 0 to 100
   */
  _handleVolumeChange(value) {
    const normalized = value / 100;
    window.AudioPlayer.setVolume(normalized);

    if (this.els.volumeFill) {
      this.els.volumeFill.style.width = `${value}%`;
    }

    this._updateVolumeIcon();
  }

  /**
   * Update volume icon based on mute state.
   */
  _updateVolumeIcon() {
    const isMuted = window.AudioPlayer.isMuted();

    if (this.els.iconVolumeOn) {
      this.els.iconVolumeOn.classList.toggle('hidden', isMuted);
    }
    if (this.els.iconVolumeMuted) {
      this.els.iconVolumeMuted.classList.toggle('hidden', !isMuted);
    }
  }

  /**
   * Reset the player UI to default state.
   */
  resetUI() {
    if (this.els.soundName) this.els.soundName.textContent = 'Ses seçilmedi';
    if (this.els.currentTime) this.els.currentTime.textContent = '0:00';
    if (this.els.duration) this.els.duration.textContent = '0:00';
    this.updateProgress(0);
    this.updatePlayState(false);

    if (window.SoundList) {
      window.SoundList.clearPlayingState();
    }
  }

  /* ─────────────── Progress Updater (rAF) ─────────────── */

  startProgressUpdater() {
    this.stopProgressUpdater();

    const update = () => {
      if (window.AudioPlayer.isPlaying && !this._isSeekingProgress) {
        const progress = window.AudioPlayer.getProgress();
        this.updateProgress(progress);
        this._updateTimeDisplay(
          window.AudioPlayer.getCurrentTime(),
          window.AudioPlayer.getDuration()
        );
      }
      this._progressRAF = requestAnimationFrame(update);
    };

    this._progressRAF = requestAnimationFrame(update);
  }

  stopProgressUpdater() {
    if (this._progressRAF !== null) {
      cancelAnimationFrame(this._progressRAF);
      this._progressRAF = null;
    }
  }

  /* ─────────────── Prev / Next ─────────────── */

  _playNext() {
    if (!window.SoundList || !window.AudioPlayer.currentSoundId) return;

    const next = window.SoundList.getNextSound(window.AudioPlayer.currentSoundId);
    if (next) {
      window.AudioPlayer.loadAndPlay(next.filePath, next.id);
      this.updateNowPlaying(next);
    }
  }

  _playPrev() {
    if (!window.SoundList || !window.AudioPlayer.currentSoundId) return;

    const prev = window.SoundList.getPrevSound(window.AudioPlayer.currentSoundId);
    if (prev) {
      window.AudioPlayer.loadAndPlay(prev.filePath, prev.id);
      this.updateNowPlaying(prev);
    }
  }

  /* ─────────────── Utility ─────────────── */

  /**
   * Format seconds to mm:ss.
   * @param {number} seconds
   * @returns {string}
   */
  _formatTime(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}


// ── Export Singleton ──
window.Player = new PlayerController();
