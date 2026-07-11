/* ════════════════════════════════════════════════════════════
   SoundSok — Application Entry Point
   Orchestrates initialization, global event handlers,
   toolbar actions, keyboard shortcuts, and IPC bridges.
   ════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─────────────── Boot ─────────────── */

  document.addEventListener('DOMContentLoaded', async () => {
    console.log('%c🎧 SoundSok başlatıldı ✨', 'color: #8b5cf6; font-size: 14px; font-weight: bold;');

    // Initialize all managers
    initManagers();

    // Load data
    await loadInitialData();

    // Setup event handlers
    setupTitlebarButtons();
    setupToolbarActions();
    setupKeyboardShortcuts();
    setupContextMenu();
    setupDragDropImport();

    console.log('[App] Initialization complete');
  });


  /* ─────────────── Manager Init ─────────────── */

  function initManagers() {
    window.SoundList.init();
    window.Categories.init();
    window.Player.init();
    window.Search.init();
  }


  /* ─────────────── Data Loading ─────────────── */

  async function loadInitialData() {
    try {
      let sounds = [];

      if (window.soundsok && window.soundsok.sounds) {
        sounds = await window.soundsok.sounds.getAll();
      }

      window.SoundList.setSounds(sounds || []);
      window.Categories.updateCounts();

      console.log(`[App] Loaded ${(sounds || []).length} sounds`);
    } catch (err) {
      console.error('[App] Failed to load initial data:', err);
      window.SoundList.setSounds([]);
    }
  }


  /* ─────────────── Titlebar Buttons ─────────────── */

  function setupTitlebarButtons() {
    const btnMin = document.getElementById('btn-minimize');
    const btnMax = document.getElementById('btn-maximize');
    const btnClose = document.getElementById('btn-close');

    if (btnMin) {
      btnMin.addEventListener('click', () => {
        if (window.soundsok && window.soundsok.window) {
          window.soundsok.window.minimize();
        }
      });
    }

    if (btnMax) {
      btnMax.addEventListener('click', () => {
        if (window.soundsok && window.soundsok.window) {
          window.soundsok.window.maximize();
        }
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        if (window.soundsok && window.soundsok.window) {
          window.soundsok.window.close();
        }
      });
    }
  }


  /* ─────────────── Toolbar Actions ─────────────── */

  function setupToolbarActions() {
    // Add Sound button
    const btnAddSound = document.getElementById('btn-add-sound');
    if (btnAddSound) {
      btnAddSound.addEventListener('click', () => handleAddSound());
    }

    // View toggle
    const btnGrid = document.getElementById('btn-view-grid');
    const btnList = document.getElementById('btn-view-list');

    if (btnGrid) {
      btnGrid.addEventListener('click', () => {
        window.SoundList.setView('grid');
      });
    }

    if (btnList) {
      btnList.addEventListener('click', () => {
        window.SoundList.setView('list');
      });
    }

    // Sort dropdown
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        window.SoundList.setSort(e.target.value);
      });
    }
  }


  /* ─────────────── Add Sound Flow ─────────────── */

  async function handleAddSound() {
    try {
      if (!window.soundsok || !window.soundsok.dialog) {
        console.warn('[App] Dialog API not available');
        return;
      }

      // Open file dialog
      const result = await window.soundsok.dialog.openAudioFiles();

      if (!result || result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      await importFiles(result.filePaths);
    } catch (err) {
      console.error('[App] Add sound failed:', err);
    }
  }

  /**
   * Import an array of file paths into the sound library.
   * @param {string[]} filePaths
   */
  async function importFiles(filePaths) {
    for (const filePath of filePaths) {
      try {
        const fileName = extractFileName(filePath);
        const ext = extractExtension(filePath);

        // Check if supported
        const supported = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma', 'm4a', 'webm'];
        if (!supported.includes(ext)) {
          console.warn(`[App] Unsupported format: ${ext} (${fileName})`);
          continue;
        }

        const sound = {
          id: generateId(),
          name: fileName,
          filePath: filePath,
          duration: 0,
          categoryId: window.Categories.activeCategory,
          createdAt: new Date().toISOString()
        };

        // Try to get duration by loading audio metadata
        sound.duration = await getAudioDuration(filePath);

        // Save to database
        if (window.soundsok && window.soundsok.sounds) {
          const saved = await window.soundsok.sounds.add(sound);
          if (saved && saved.id) {
            sound.id = saved.id;
          }
        }

        // Add to UI
        window.SoundList.addSound(sound);
      } catch (err) {
        console.error(`[App] Failed to import: ${filePath}`, err);
      }
    }

    // Update category counts
    window.Categories.updateCounts();
  }

  /**
   * Get audio file duration by loading it into a temporary Audio element.
   * @param {string} filePath
   * @returns {Promise<number>} Duration in seconds
   */
  function getAudioDuration(filePath) {
    return new Promise((resolve) => {
      const audio = new Audio();

      // Normalize path
      let src = filePath;
      if (!src.startsWith('file://') && !src.startsWith('http')) {
        src = 'file:///' + src.replace(/\\/g, '/');
      }

      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration || 0);
        audio.src = ''; // Cleanup
      });

      audio.addEventListener('error', () => {
        resolve(0);
        audio.src = '';
      });

      // Timeout fallback
      setTimeout(() => resolve(0), 5000);

      audio.src = src;
    });
  }


  /* ─────────────── Keyboard Shortcuts ─────────────── */

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        return;
      }

      switch (e.key) {
        case ' ':
          // Space → Play / Pause
          e.preventDefault();
          if (window.AudioPlayer.hasActiveSound()) {
            window.AudioPlayer.togglePlayPause();
          }
          break;

        case 'Escape':
          // Escape → Stop
          window.AudioPlayer.stop();
          window.Player.resetUI();
          hideContextMenu();
          break;

        case 'ArrowRight':
          // Right Arrow → Seek forward 5s
          if (window.AudioPlayer.isPlaying) {
            const current = window.AudioPlayer.getCurrentTime();
            const duration = window.AudioPlayer.getDuration();
            if (duration > 0) {
              const newPercent = Math.min(100, ((current + 5) / duration) * 100);
              window.AudioPlayer.seek(newPercent);
            }
          }
          break;

        case 'ArrowLeft':
          // Left Arrow → Seek backward 5s
          if (window.AudioPlayer.isPlaying) {
            const current = window.AudioPlayer.getCurrentTime();
            const duration = window.AudioPlayer.getDuration();
            if (duration > 0) {
              const newPercent = Math.max(0, ((current - 5) / duration) * 100);
              window.AudioPlayer.seek(newPercent);
            }
          }
          break;

        case 'ArrowUp':
          // Up Arrow → Volume up
          e.preventDefault();
          adjustVolume(5);
          break;

        case 'ArrowDown':
          // Down Arrow → Volume down
          e.preventDefault();
          adjustVolume(-5);
          break;

        default:
          // Ctrl+F → Focus search
          if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            window.Search.focus();
          }
          break;
      }
    });
  }

  /**
   * Adjust volume by a step (in percentage units 0-100).
   * @param {number} step
   */
  function adjustVolume(step) {
    const current = window.AudioPlayer.getVolume() * 100;
    const next = Math.max(0, Math.min(100, current + step));
    window.AudioPlayer.setVolume(next / 100);

    // Update slider UI
    const slider = document.getElementById('volume-slider');
    const fill = document.getElementById('volume-fill');
    if (slider) slider.value = next;
    if (fill) fill.style.width = `${next}%`;
  }


  /* ─────────────── Context Menu ─────────────── */

  function setupContextMenu() {
    const menu = document.getElementById('context-menu');
    if (!menu) return;

    // Hide on click anywhere
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) {
        hideContextMenu();
      }
    });

    // Hide on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideContextMenu();
      }
    });

    // Handle menu item clicks
    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const action = item.dataset.action;
        const soundId = window.SoundList.contextSoundId;
        handleContextAction(action, soundId);
        hideContextMenu();
      });
    });

    // Prevent context menu on the context menu itself
    menu.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function hideContextMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) {
      menu.classList.add('hidden');
    }
  }

  /**
   * Handle a context menu action.
   * @param {string} action
   * @param {string} soundId
   */
  async function handleContextAction(action, soundId) {
    if (!soundId) return;

    const sound = window.SoundList.getSoundById(soundId);
    if (!sound) return;

    switch (action) {
      case 'play':
        window.AudioPlayer.loadAndPlay(sound.filePath, sound.id);
        window.Player.updateNowPlaying(sound);
        break;

      case 'edit':
        // Prompt for new name
        const newName = prompt('Yeni ses adı:', sound.name);
        if (newName && newName.trim()) {
          sound.name = newName.trim();
          window.SoundList.updateSound(sound.id, { name: sound.name });

          if (window.soundsok && window.soundsok.sounds) {
            await window.soundsok.sounds.update(sound.id, { name: sound.name });
          }

          window.SoundList.render();
        }
        break;

      case 'hotkey':
        // Prompt for hotkey
        const hotkey = prompt('Kısayol tuşu girin (örn: F1, Ctrl+1):');
        if (hotkey && hotkey.trim()) {
          window.SoundList.updateSound(sound.id, { hotkey: hotkey.trim() });

          if (window.soundsok && window.soundsok.sounds) {
            await window.soundsok.sounds.update(sound.id, { hotkey: hotkey.trim() });
          }
        }
        break;

      case 'category':
        // Simple category selection via prompt (will be replaced with a proper modal later)
        const categories = window.Categories.categories;
        if (categories.length === 0) {
          alert('Henüz kategori oluşturulmamış. Önce bir kategori ekleyin.');
          return;
        }

        const catList = categories.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
        const choice = prompt(`Kategori seçin:\n${catList}\n\nNumara girin:`);

        if (choice) {
          const idx = parseInt(choice, 10) - 1;
          if (idx >= 0 && idx < categories.length) {
            const targetCat = categories[idx];
            window.SoundList.updateSound(sound.id, { categoryId: targetCat.id });

            if (window.soundsok && window.soundsok.sounds) {
              await window.soundsok.sounds.update(sound.id, { categoryId: targetCat.id });
            }

            window.Categories.updateCounts();
          }
        }
        break;

      case 'delete':
        const confirmed = confirm(`"${sound.name}" silinsin mi?`);
        if (confirmed) {
          window.SoundList.removeSound(sound.id);

          if (window.soundsok && window.soundsok.sounds) {
            await window.soundsok.sounds.remove(sound.id);
          }

          // Stop if currently playing
          if (window.AudioPlayer.currentSoundId === sound.id) {
            window.AudioPlayer.stop();
            window.Player.resetUI();
          }

          window.Categories.updateCounts();
        }
        break;
    }
  }


  /* ─────────────── Drag & Drop Import ─────────────── */

  function setupDragDropImport() {
    window.addEventListener('soundsok:files-dropped', async (e) => {
      const files = e.detail.files;
      if (!files || files.length === 0) return;

      // Extract file paths from File objects
      const paths = files.map(f => f.path).filter(Boolean);

      if (paths.length > 0) {
        await importFiles(paths);
      }
    });
  }


  /* ─────────────── Utility Functions ─────────────── */

  /**
   * Extract filename without extension from a full path.
   * @param {string} filePath
   * @returns {string}
   */
  function extractFileName(filePath) {
    const parts = filePath.replace(/\\/g, '/').split('/');
    const fullName = parts[parts.length - 1] || 'Bilinmeyen';
    const dotIdx = fullName.lastIndexOf('.');
    return dotIdx > 0 ? fullName.substring(0, dotIdx) : fullName;
  }

  /**
   * Extract file extension from a path.
   * @param {string} filePath
   * @returns {string}
   */
  function extractExtension(filePath) {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  /**
   * Generate a unique ID.
   * @returns {string}
   */
  function generateId() {
    return 'snd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

})();
