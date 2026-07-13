/* ════════════════════════════════════════════════════════════
   SoundSok — Sound List Manager
   Manages sound card rendering (grid/list), drag-and-drop,
   right-click context menus, and card interactions.
   ════════════════════════════════════════════════════════════ */

class SoundListManager {
  constructor() {
    /** @type {Array<Object>} */
    this.sounds = [];

    /** @type {Array<Object>} Filtered subset shown in UI */
    this.filteredSounds = [];

    /** @type {'grid'|'list'} */
    this.currentView = 'grid';

    /** @type {HTMLElement|null} */
    this.container = null;

    /** @type {HTMLElement|null} */
    this.emptyState = null;

    /** @type {string|null} Currently right-clicked sound ID */
    this.contextSoundId = null;

    /** @type {string} Current sort key */
    this.sortKey = 'name-asc';
  }

  /* ─────────────── Initialization ─────────────── */

  init() {
    this.container = document.getElementById('sound-list');
    this.emptyState = document.getElementById('empty-state');

    this.handleDragDrop();
  }

  /* ─────────────── Data Management ─────────────── */

  /**
   * Set the full sound list and re-render.
   * @param {Array<Object>} sounds
   */
  setSounds(sounds) {
    this.sounds = sounds || [];
    this.filteredSounds = [...this.sounds];
    this.applySorting();
    this.render();
  }

  /**
   * Add a single sound and re-render.
   * @param {Object} sound
   */
  addSound(sound) {
    this.sounds.push(sound);
    this.filteredSounds = [...this.sounds];
    this.applySorting();
    this.render();
  }

  /**
   * Remove a sound by ID and re-render.
   * @param {string} id
   */
  removeSound(id) {
    this.sounds = this.sounds.filter(s => String(s.id) !== String(id));
    this.filteredSounds = this.filteredSounds.filter(s => String(s.id) !== String(id));
    this.render();
  }

  /**
   * Update a sound's data.
   * @param {string} id
   * @param {Object} updates
   */
  updateSound(id, updates) {
    const idx = this.sounds.findIndex(s => String(s.id) === String(id));
    if (idx !== -1) {
      this.sounds[idx] = { ...this.sounds[idx], ...updates };
    }
    const fIdx = this.filteredSounds.findIndex(s => String(s.id) === String(id));
    if (fIdx !== -1) {
      this.filteredSounds[fIdx] = { ...this.filteredSounds[fIdx], ...updates };
    }
  }

  /**
   * Filter sounds by a search query (called by SearchEngine).
   * @param {string} query
   */
  filterByQuery(query) {
    if (!query || query.trim() === '') {
      this.filteredSounds = [...this.sounds];
    } else {
      const q = query.toLowerCase().trim();
      this.filteredSounds = this.sounds.filter(s =>
        s.name.toLowerCase().includes(q)
      );
    }
    this.applySorting();
    this.render();
  }

  /**
   * Filter sounds by category.
   * @param {string|null} categoryId — null for all
   */
  filterByCategory(categoryId) {
    if (!categoryId) {
      this.filteredSounds = [...this.sounds];
    } else {
      this.filteredSounds = this.sounds.filter(s => String(s.categoryId) === String(categoryId));
    }
    this.applySorting();
    this.render();
  }

  /**
   * Set sort key and re-sort.
   * @param {string} key
   */
  setSort(key) {
    this.sortKey = key;
    this.applySorting();
    this.render();
  }

  /**
   * Apply current sort to filteredSounds.
   */
  applySorting() {
    const [field, direction] = this.sortKey.split('-');
    const dir = direction === 'desc' ? -1 : 1;

    this.filteredSounds.sort((a, b) => {
      let valA, valB;

      switch (field) {
        case 'name':
          valA = (a.name || '').toLowerCase();
          valB = (b.name || '').toLowerCase();
          return valA.localeCompare(valB, 'tr') * dir;

        case 'date':
          valA = new Date(a.createdAt || 0).getTime();
          valB = new Date(b.createdAt || 0).getTime();
          return (valA - valB) * dir;

        case 'duration':
          valA = a.duration || 0;
          valB = b.duration || 0;
          return (valA - valB) * dir;

        default:
          return 0;
      }
    });
  }

  /* ─────────────── Rendering ─────────────── */

  /**
   * Render all filtered sound cards into the container.
   */
  render() {
    if (!this.container) return;

    // Clear container
    this.container.innerHTML = '';

    // Toggle view class
    this.container.className = this.currentView === 'grid'
      ? 'sound-grid'
      : 'sound-list-view';

    // Show/hide empty state
    if (this.filteredSounds.length === 0) {
      this.emptyState?.classList.remove('hidden');
    } else {
      this.emptyState?.classList.add('hidden');
    }

    // Create sound cards
    this.filteredSounds.forEach((sound, index) => {
      const card = this.createSoundCard(sound, index);
      this.container.appendChild(card);
    });
  }

  /**
   * Create a DOM element for a sound card.
   * @param {Object} sound
   * @param {number} index — for stagger animation
   * @returns {HTMLElement}
   */
  createSoundCard(sound, index) {
    const card = document.createElement('div');
    card.className = 'sound-card';
    card.dataset.soundId = sound.id;
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${sound.name} oynat`);
    card.setAttribute('draggable', 'true');

    // Drag start for Hotbar assignment
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(sound.id));
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });

    // Mark if currently playing
    if (window.AudioPlayer && window.AudioPlayer.currentSoundId === sound.id && window.AudioPlayer.isPlaying) {
      card.classList.add('playing');
    }

    // Set stagger delay for animation (beyond CSS nth-child limit)
    if (index >= 17) {
      card.style.animationDelay = `${Math.min(index * 30, 600)}ms`;
    }

    const ext = this.getFileExtension(sound.filePath || sound.name);
    const icon = this.getFileIcon(ext);
    const duration = this.formatDuration(sound.duration || 0);

    let hotkeyHtml = '';
    if (sound.hotkey) {
      hotkeyHtml = `<div class="hotkey-badge" title="Kısayol: ${sound.hotkey}">${sound.hotkey}</div>`;
    }

    card.innerHTML = `
      ${hotkeyHtml}
      <div class="sound-card-icon">${icon}</div>
      <span class="sound-card-name truncate" title="${this._escapeHtml(sound.name)}">${this._escapeHtml(sound.name)}</span>
      <div class="sound-card-meta">
        <span class="sound-card-badge">${ext.toUpperCase()}</span>
        <span class="sound-card-duration">${duration}</span>
      </div>
      <div class="sound-card-play-overlay">
        <div class="sound-card-play-btn">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M5 3L15 9L5 15V3z" fill="currentColor"/>
          </svg>
        </div>
      </div>
    `;

    // Click → Play
    card.addEventListener('click', (e) => {
      if (e.button !== 0) return;
      this._handleSoundPlay(sound);
    });

    // Enter key → Play
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this._handleSoundPlay(sound);
      }
    });

    // Right-click → Context menu
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.contextSoundId = sound.id;
      this.handleContextMenu(sound, e);
    });

    return card;
  }

  /**
   * Handle playing a sound from a card click.
   * @param {Object} sound
   */
  _handleSoundPlay(sound) {
    if (!sound.filePath) {
      console.warn('[SoundList] Sound has no file path:', sound.name);
      return;
    }

    // If clicking the currently playing or paused sound, toggle
    if (window.AudioPlayer.currentSoundId === sound.id && window.AudioPlayer.hasActiveSound()) {
      window.AudioPlayer.togglePlayPause();
      return;
    }

    // Play the new sound
    window.AudioPlayer.loadAndPlay(sound.filePath, sound.id);

    // Update the player bar
    if (window.Player) {
      window.Player.updateNowPlaying(sound);
    }

    // Re-render to update playing state
    this._updatePlayingState(sound.id);
  }

  /**
   * Update which card has the 'playing' class.
   * @param {string|null} soundId
   */
  _updatePlayingState(soundId) {
    if (!this.container) return;
    this.container.querySelectorAll('.sound-card').forEach(card => {
      if (card.dataset.soundId === soundId) {
        card.classList.add('playing');
      } else {
        card.classList.remove('playing');
      }
    });
  }

  /**
   * Clear all playing states.
   */
  clearPlayingState() {
    if (!this.container) return;
    this.container.querySelectorAll('.sound-card.playing').forEach(card => {
      card.classList.remove('playing');
    });
  }

  /* ─────────────── View Toggle ─────────────── */

  /**
   * Switch between grid and list view.
   * @param {'grid'|'list'} view
   */
  setView(view) {
    this.currentView = view;
    this.render();

    // Update toggle buttons
    document.getElementById('btn-view-grid')?.classList.toggle('active', view === 'grid');
    document.getElementById('btn-view-list')?.classList.toggle('active', view === 'list');
  }

  /* ─────────────── Context Menu ─────────────── */

  /**
   * Show context menu for a sound card.
   * @param {Object} sound
   * @param {MouseEvent} event
   */
  handleContextMenu(sound, event) {
    const menu = document.getElementById('context-menu');
    if (!menu) return;

    this.contextSoundId = sound.id;

    // Position menu
    const x = event.clientX;
    const y = event.clientY;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.remove('hidden');

    // Ensure menu stays in viewport
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menu.style.left = `${x - rect.width}px`;
      }
      if (rect.bottom > window.innerHeight) {
        menu.style.top = `${y - rect.height}px`;
      }
    });
  }

  /* ─────────────── Drag and Drop ─────────────── */

  handleDragDrop() {
    const overlay = document.getElementById('drag-overlay');
    const app = document.getElementById('app');
    if (!app || !overlay) return;

    let dragCounter = 0;

    app.addEventListener('dragenter', (e) => {
      e.preventDefault();
      // Only trigger overlay for actual files dragged from outside
      if (!e.dataTransfer.types.includes('Files')) return;
      dragCounter++;
      if (dragCounter === 1) {
        overlay.classList.remove('hidden');
      }
    });

    app.addEventListener('dragleave', (e) => {
      e.preventDefault();
      if (!e.dataTransfer.types.includes('Files')) return;
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        overlay.classList.add('hidden');
      }
    });

    app.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!e.dataTransfer.types.includes('Files')) return;
      e.dataTransfer.dropEffect = 'copy';
    });

    app.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!e.dataTransfer.types.includes('Files')) return;
      dragCounter = 0;
      overlay.classList.add('hidden');

      const files = Array.from(e.dataTransfer.files);
      const audioFiles = files.filter(f => this._isAudioFile(f.name));

      if (audioFiles.length > 0) {
        // Dispatch custom event for app.js to handle the import flow
        const event = new CustomEvent('soundsok:files-dropped', {
          detail: { files: audioFiles }
        });
        window.dispatchEvent(event);
      }
    });
  }

  /* ─────────────── Utility Methods ─────────────── */

  /**
   * Check if a filename is an audio file.
   * @param {string} filename
   * @returns {boolean}
   */
  _isAudioFile(filename) {
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma', 'm4a', 'webm'];
    const ext = this.getFileExtension(filename);
    return audioExts.includes(ext);
  }

  /**
   * Get file extension from a path or filename.
   * @param {string} filepath
   * @returns {string}
   */
  getFileExtension(filepath) {
    if (!filepath) return '?';
    const parts = filepath.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '?';
  }

  /**
   * Get an emoji icon based on file extension.
   * @param {string} ext
   * @returns {string}
   */
  getFileIcon(ext) {
    const icons = {
      'mp3': '🎵',
      'wav': '🔊',
      'ogg': '🎶',
      'flac': '💎',
      'aac': '🎧',
      'wma': '🎼',
      'm4a': '🎹',
      'webm': '🌐'
    };
    return icons[ext] || '🔉';
  }

  /**
   * Format seconds into mm:ss.
   * @param {number} seconds
   * @returns {string}
   */
  formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Escape HTML to prevent XSS.
   * @param {string} text
   * @returns {string}
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get a sound object by its ID.
   * @param {string} id
   * @returns {Object|undefined}
   */
  getSoundById(id) {
    return this.sounds.find(s => String(s.id) === String(id));
  }

  /**
   * Get the index of a sound in filteredSounds.
   * @param {string} id
   * @returns {number}
   */
  getSoundIndex(id) {
    return this.filteredSounds.findIndex(s => String(s.id) === String(id));
  }

  /**
   * Get the next sound after the given ID.
   * @param {string} currentId
   * @returns {Object|null}
   */
  getNextSound(currentId) {
    const idx = this.getSoundIndex(currentId);
    if (idx === -1 || idx >= this.filteredSounds.length - 1) return null;
    return this.filteredSounds[idx + 1];
  }

  /**
   * Get the previous sound before the given ID.
   * @param {string} currentId
   * @returns {Object|null}
   */
  getPrevSound(currentId) {
    const idx = this.getSoundIndex(currentId);
    if (idx <= 0) return null;
    return this.filteredSounds[idx - 1];
  }
}


// ── Export Singleton ──
window.SoundList = new SoundListManager();
