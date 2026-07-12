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
    setupModals();
    setupGlobalListeners();
    setupHotbar();
    setupCategoryModals();
    await loadAudioDevices();

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
        const res = await window.soundsok.sounds.list();
        if (res && res.success && res.sounds) {
          sounds = res.sounds;
        }
      }

      window.SoundList.setSounds(sounds || []);
      window.Categories.updateCounts();
      renderHotbar();

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
      const result = await window.soundsok.dialog.openFiles();

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
          const res = await window.soundsok.sounds.add(filePath);
          if (res && res.success && res.sound) {
            // Update the locally created sound object with the DB ID
            sound.id = res.sound.id;
            sound.name = res.sound.name;
          } else {
            console.warn('[App] Add sound failed:', res?.error);
            continue; // Skip if failed (e.g. duplicate)
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

        case 'F4':
          // F4 → Toggle playback mode
          e.preventDefault();
          if (window.Player) {
            window.Player.togglePlaybackMode();
          }
          break;

        default:
          // Alt + 1-0 for Hotbar
          if (e.altKey && !isNaN(e.key) && e.key !== ' ') {
            e.preventDefault();
            const slotNum = e.key === '0' ? 10 : parseInt(e.key, 10);
            if (slotNum >= 1 && slotNum <= 10) {
              const slot = document.querySelector(`.hotbar-slot[data-slot="${slotNum}"]`);
              if (slot) {
                const soundId = slot.dataset.soundId;
                if (soundId) {
                  const sound = window.SoundList.getSoundById(soundId);
                  if (sound) {
                    window.AudioPlayer.loadAndPlay(sound.filePath, sound.id);
                    window.Player.updateNowPlaying(sound);
                  }
                }
              }
            }
            return;
          }
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
        openHotkeyModal(sound);
        break;

      case 'volume':
        try {
          console.log('[App] Opening volume prompt for:', sound.name);
          const currentVol = typeof sound.volume === 'number' ? Math.round(sound.volume * 100) : 80;
          const inputVol = prompt(`"${sound.name}" sesinin çalma seviyesini girin (0 - 100):`, String(currentVol));
          console.log('[App] Volume prompt response:', inputVol);
          if (inputVol !== null) {
            const val = parseInt(inputVol, 10);
            if (!isNaN(val) && val >= 0 && val <= 100) {
              const normalizedVol = val / 100;
              sound.volume = normalizedVol;
              window.SoundList.updateSound(sound.id, { volume: normalizedVol });
              if (window.soundsok && window.soundsok.sounds) {
                await window.soundsok.sounds.update(sound.id, { volume: normalizedVol });
              }
              console.log('[App] Sound volume updated to:', normalizedVol);
            }
          }
        } catch (err) {
          console.error('[App] Error during volume change prompt:', err);
        }
        break;

      case 'category':
        openCategoryMoveModal(sound);
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


  /* ─────────────── Modals & Settings ─────────────── */

  let currentHotkeySound = null;
  let recordedHotkey = '';

  function setupModals() {
    // Settings
    const btnSettings = document.getElementById('btn-settings');
    const settingsModal = document.getElementById('settings-modal');
    const btnCloseSettings = document.getElementById('btn-close-settings-modal');
    const toggleAutostart = document.getElementById('setting-autostart');

    if (btnSettings) {
      btnSettings.addEventListener('click', async () => {
        await loadAudioDevices();
        settingsModal.classList.remove('hidden');
      });
    }

    if (btnCloseSettings) {
      btnCloseSettings.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
      });
    }

    if (toggleAutostart) {
      toggleAutostart.addEventListener('change', async (e) => {
        if (window.soundsok && window.soundsok.settings) {
          await window.soundsok.settings.toggleStartup(e.target.checked);
        }
      });
    }

    // PTT Settings
    const togglePtt = document.getElementById('setting-ptt-enable');
    const selectPttKey = document.getElementById('setting-ptt-key');

    if (togglePtt) {
      togglePtt.checked = localStorage.getItem('pttEnable') === 'true';
      togglePtt.addEventListener('change', (e) => {
        localStorage.setItem('pttEnable', e.target.checked);
      });
    }

    if (selectPttKey) {
      selectPttKey.value = localStorage.getItem('pttKey') || 'V';
      selectPttKey.addEventListener('change', (e) => {
        localStorage.setItem('pttKey', e.target.value);
      });
    }

    // Speaker/Mic Ratio Settings
    const inputSpeakerVol = document.getElementById('setting-speaker-volume');
    const labelSpeakerVolVal = document.getElementById('setting-speaker-volume-val');
    const inputMicVol = document.getElementById('setting-mic-volume');
    const labelMicVolVal = document.getElementById('setting-mic-volume-val');

    if (inputSpeakerVol && labelSpeakerVolVal) {
      const savedRatio = parseFloat(localStorage.getItem('speakerVolumeRatio') || '1.0');
      const val = Math.round(savedRatio * 100);
      inputSpeakerVol.value = val;
      labelSpeakerVolVal.textContent = `${val}%`;

      inputSpeakerVol.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        labelSpeakerVolVal.textContent = `${v}%`;
        localStorage.setItem('speakerVolumeRatio', (v / 100).toString());
        window.AudioPlayer._updateActualVolumes();
      });
    }

    if (inputMicVol && labelMicVolVal) {
      const savedRatio = parseFloat(localStorage.getItem('micVolumeRatio') || '1.0');
      const val = Math.round(savedRatio * 100);
      inputMicVol.value = val;
      labelMicVolVal.textContent = `${val}%`;

      inputMicVol.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        labelMicVolVal.textContent = `${v}%`;
        localStorage.setItem('micVolumeRatio', (v / 100).toString());
        window.AudioPlayer._updateActualVolumes();
      });
    }

    // Hotkey
    const hotkeyModal = document.getElementById('hotkey-modal');
    const btnCloseHotkey = document.getElementById('btn-close-hotkey-modal');
    const btnClearHotkey = document.getElementById('btn-clear-hotkey');
    const btnSaveHotkey = document.getElementById('btn-save-hotkey');
    const recorder = document.getElementById('hotkey-recorder');

    if (btnCloseHotkey) {
      btnCloseHotkey.addEventListener('click', closeHotkeyModal);
    }

    if (btnClearHotkey) {
      btnClearHotkey.addEventListener('click', async () => {
        if (currentHotkeySound) {
          await assignHotkey(currentHotkeySound.id, null);
          closeHotkeyModal();
        }
      });
    }

    if (btnSaveHotkey) {
      btnSaveHotkey.addEventListener('click', async () => {
        if (currentHotkeySound && recordedHotkey) {
          // Check conflict
          if (window.soundsok && window.soundsok.hotkeys) {
            const result = await window.soundsok.hotkeys.check(recordedHotkey);
            if (result.success && result.conflict && result.conflict.id !== currentHotkeySound.id) {
              const confirmMsg = `Bu kısayol zaten "${result.conflict.name}" sesine atanmış. Devam ederseniz eski atama silinecek. Onaylıyor musunuz?`;
              if (!confirm(confirmMsg)) {
                return;
              }
            }
          }
          await assignHotkey(currentHotkeySound.id, recordedHotkey);
          closeHotkeyModal();
        }
      });
    }

    if (recorder) {
      recorder.addEventListener('click', () => {
        recorder.classList.add('recording');
        document.getElementById('hotkey-display').textContent = 'Tuşlara basın...';
        
        const keydownHandler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          let keys = [];
          if (e.ctrlKey) keys.push('CommandOrControl');
          if (e.altKey) keys.push('Alt');
          if (e.shiftKey) keys.push('Shift');
          
          if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
            // Electron hotkey format uses capital letters
            let key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
            keys.push(key);
            
            recordedHotkey = keys.join('+');
            document.getElementById('hotkey-display').textContent = recordedHotkey;
            recorder.classList.remove('recording');
            btnSaveHotkey.disabled = false;
            
            document.removeEventListener('keydown', keydownHandler);
          }
        };
        
        document.addEventListener('keydown', keydownHandler);
        
        // Cancel recording if clicked outside
        const cancelRecording = (e) => {
          if (!recorder.contains(e.target)) {
            recorder.classList.remove('recording');
            if (!recordedHotkey) {
              document.getElementById('hotkey-display').textContent = 'Kısayol yok';
            } else {
              document.getElementById('hotkey-display').textContent = recordedHotkey;
            }
            document.removeEventListener('keydown', keydownHandler);
            document.removeEventListener('click', cancelRecording);
          }
        };
        
        // Use a small timeout so the current click doesn't trigger cancel
        setTimeout(() => document.addEventListener('click', cancelRecording), 10);
      });
    }
  }

  function openHotkeyModal(sound) {
    currentHotkeySound = sound;
    recordedHotkey = sound.hotkey || '';
    
    document.getElementById('hotkey-sound-name').textContent = sound.name;
    document.getElementById('hotkey-display').textContent = recordedHotkey || 'Kısayol yok';
    document.getElementById('btn-save-hotkey').disabled = true;
    document.getElementById('hotkey-modal').classList.remove('hidden');
  }

  function closeHotkeyModal() {
    document.getElementById('hotkey-modal').classList.add('hidden');
    currentHotkeySound = null;
    recordedHotkey = '';
  }

  async function assignHotkey(soundId, hotkey) {
    if (window.soundsok && window.soundsok.hotkeys) {
      const res = await window.soundsok.hotkeys.assign(soundId, hotkey);
      if (res.success && res.sound) {
        window.SoundList.updateSound(soundId, { hotkey: res.sound.hotkey });
        // We might also need to update the other sound if there was a conflict,
        // but re-loading all sounds is safer to ensure consistency.
        const resAll = await window.soundsok.sounds.list();
        if (resAll && resAll.success && resAll.sounds) {
          window.SoundList.setSounds(resAll.sounds);
        }
      }
    }
  }

  /* ─────────────── Global Listeners ─────────────── */

  function setupGlobalListeners() {
    if (window.soundsok && window.soundsok.playback) {
      window.soundsok.playback.onPlayHotkey((sound) => {
        console.log('[App] Playing from hotkey:', sound.name);
        window.AudioPlayer.loadAndPlay(sound.filePath, sound.id);
        window.Player.updateNowPlaying(sound);
      });
    }

    if (window.soundsok && window.soundsok.cli) {
      // CLI: Play sound by ID
      window.soundsok.cli.onPlayId((id) => {
        if (!window.SoundList) return;
        const sound = window.SoundList.getSoundById(id);
        if (sound) {
          window.AudioPlayer.loadAndPlay(sound.filePath, sound.id);
          window.Player.updateNowPlaying(sound);
        }
      });

      // CLI: Play hotbar slot
      window.soundsok.cli.onPlaySlot((slotNum) => {
        const slot = document.querySelector(`.hotbar-slot[data-slot="${slotNum}"]`);
        if (slot) {
          const soundId = slot.dataset.soundId;
          if (soundId && window.SoundList) {
            const sound = window.SoundList.getSoundById(soundId);
            if (sound) {
              window.AudioPlayer.loadAndPlay(sound.filePath, sound.id);
              window.Player.updateNowPlaying(sound);
            }
          }
        }
      });

      // CLI: Stop playback
      window.soundsok.cli.onStop(() => {
        window.AudioPlayer.stop();
        window.Player.resetUI();
      });

      // CLI: Toggle play/pause
      window.soundsok.cli.onToggle(() => {
        window.AudioPlayer.togglePlayPause();
      });

      // CLI: Change volume
      window.soundsok.cli.onVolume((vol) => {
        if (window.Player) {
          const slider = window.Player.els.volumeSlider;
          if (slider) slider.value = vol;
          window.Player._handleVolumeChange(vol);
        }
      });

      // CLI: Seek position
      window.soundsok.cli.onSeek((percent) => {
        window.AudioPlayer.seek(percent);
      });
    }
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

  /* ─────────────── Hotbar (Quick Access) ─────────────── */

  function setupHotbar() {
    const slots = document.querySelectorAll('.hotbar-slot');
    
    slots.forEach(slot => {
      const slotNum = parseInt(slot.dataset.slot, 10);
      
      // Drag & Drop events
      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        slot.classList.add('drag-over');
      });
      
      slot.addEventListener('dragleave', () => {
        slot.classList.remove('drag-over');
      });
      
      slot.addEventListener('drop', async (e) => {
        e.preventDefault();
        slot.classList.remove('drag-over');
        
        const soundId = e.dataTransfer.getData('text/plain');
        if (soundId) {
          await assignSoundToHotbar(soundId, slotNum);
        }
      });
      
      // Click to play
      slot.addEventListener('click', () => {
        const soundId = slot.dataset.soundId;
        if (soundId) {
          const sound = window.SoundList.getSoundById(soundId);
          if (sound) {
            window.AudioPlayer.loadAndPlay(sound.filePath, sound.id);
            window.Player.updateNowPlaying(sound);
          }
        }
      });
      
      // Clear button
      const clearBtn = slot.querySelector('.slot-clear');
      if (clearBtn) {
        clearBtn.addEventListener('click', async (e) => {
          e.stopPropagation(); // Prevent playing
          const soundId = slot.dataset.soundId;
          if (soundId) {
            await removeSoundFromHotbar(soundId);
          }
        });
      }
    });

    renderHotbar();
  }

  function renderHotbar() {
    const slots = document.querySelectorAll('.hotbar-slot');
    const sounds = window.SoundList.sounds;
    
    // Reset all slots first
    slots.forEach(slot => {
      slot.classList.remove('filled');
      slot.removeAttribute('data-sound-id');
      const nameEl = slot.querySelector('.slot-name');
      if (nameEl) nameEl.textContent = 'Boş';
      const clearBtn = slot.querySelector('.slot-clear');
      if (clearBtn) clearBtn.classList.add('hidden');
    });
    
    // Populate active slots
    sounds.forEach(sound => {
      if (sound.hotbarSlot && sound.hotbarSlot >= 1 && sound.hotbarSlot <= 10) {
        const slot = document.querySelector(`.hotbar-slot[data-slot="${sound.hotbarSlot}"]`);
        if (slot) {
          slot.classList.add('filled');
          slot.dataset.soundId = sound.id;
          const nameEl = slot.querySelector('.slot-name');
          if (nameEl) {
            nameEl.textContent = sound.name;
            nameEl.title = sound.name;
          }
          const clearBtn = slot.querySelector('.slot-clear');
          if (clearBtn) clearBtn.classList.remove('hidden');
        }
      }
    });
  }

  async function assignSoundToHotbar(soundId, slotNum) {
    // If another sound was in this slot, clear it first
    const sounds = window.SoundList.sounds;
    const existing = sounds.find(s => s.hotbarSlot === slotNum);
    if (existing && String(existing.id) !== String(soundId)) {
      await removeSoundFromHotbar(existing.id);
    }
    
    if (window.soundsok && window.soundsok.sounds) {
      const res = await window.soundsok.sounds.update(soundId, { hotbarSlot: slotNum });
      if (res && res.success && res.sound) {
        window.SoundList.updateSound(soundId, { hotbarSlot: slotNum });
        renderHotbar();
      }
    }
  }

  async function removeSoundFromHotbar(soundId) {
    if (window.soundsok && window.soundsok.sounds) {
      const res = await window.soundsok.sounds.update(soundId, { hotbarSlot: null });
      if (res && res.success && res.sound) {
        window.SoundList.updateSound(soundId, { hotbarSlot: null });
        renderHotbar();
      }
    }
  }

  /* ─────────────── Category Management Modals ─────────────── */

  let currentCategoryMoveSound = null;
  let currentEditCategory = null;
  let selectedCategoryColor = '';

  function setupCategoryModals() {
    // Move Modal
    const moveModal = document.getElementById('category-move-modal');
    const btnCloseMove = document.getElementById('btn-close-catmove-modal');
    
    if (btnCloseMove) {
      btnCloseMove.addEventListener('click', () => moveModal.classList.add('hidden'));
    }
    
    // Edit Modal
    const editModal = document.getElementById('category-edit-modal');
    const btnCloseEdit = document.getElementById('btn-close-catedit-modal');
    const btnSaveEdit = document.getElementById('btn-save-catedit');
    const btnDeleteEdit = document.getElementById('btn-delete-catedit');
    const nameInput = document.getElementById('catedit-name-input');
    
    if (btnCloseEdit) {
      btnCloseEdit.addEventListener('click', () => editModal.classList.add('hidden'));
    }
    
    if (btnSaveEdit) {
      btnSaveEdit.addEventListener('click', async () => {
        if (currentEditCategory && nameInput) {
          const newName = nameInput.value.trim();
          if (newName) {
            if (window.soundsok && window.soundsok.categories) {
              const res = await window.soundsok.categories.update(currentEditCategory.id, {
                name: newName,
                color: selectedCategoryColor
              });
              if (res && res.success) {
                await window.Categories.loadCategories();
                window.SoundList.render();
              }
            }
            editModal.classList.add('hidden');
          }
        }
      });
    }
    
    if (btnDeleteEdit) {
      btnDeleteEdit.addEventListener('click', async () => {
        if (currentEditCategory) {
          editModal.classList.add('hidden');
          await window.Categories.removeCategory(currentEditCategory.id);
        }
      });
    }
    
    // Bind global function for editing category
    window.openCategoryEditModal = (category) => {
      currentEditCategory = category;
      selectedCategoryColor = category.color || '#8b5cf6';
      
      if (nameInput) nameInput.value = category.name;
      
      const picker = document.getElementById('catedit-color-picker');
      if (picker) {
        picker.innerHTML = '';
        const colors = window.Categories.colors;
        colors.forEach(color => {
          const option = document.createElement('div');
          option.className = 'color-option';
          option.style.backgroundColor = color;
          if (color === selectedCategoryColor) {
            option.classList.add('selected');
          }
          option.addEventListener('click', () => {
            picker.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
            option.classList.add('selected');
            selectedCategoryColor = color;
          });
          picker.appendChild(option);
        });
      }
      
      editModal.classList.remove('hidden');
    };
  }

  function openCategoryMoveModal(sound) {
    currentCategoryMoveSound = sound;
    document.getElementById('catmove-sound-name').textContent = sound.name;
    
    const list = document.getElementById('catmove-list');
    if (list) {
      list.innerHTML = '';
      
      // Add 'Uncategorized' option
      const allItem = document.createElement('div');
      allItem.className = 'catmove-item';
      allItem.innerHTML = `
        <span class="category-dot" style="background: #8b5cf6;"></span>
        <span>Kategorisiz (Tüm Sesler)</span>
      `;
      allItem.addEventListener('click', async () => {
        await assignSoundToCategory(sound.id, null);
        document.getElementById('category-move-modal').classList.add('hidden');
      });
      list.appendChild(allItem);
      
      // Load user categories
      const categories = window.Categories.categories;
      categories.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'catmove-item';
        item.innerHTML = `
          <span class="category-dot" style="background: ${cat.color};"></span>
          <span>${cat.name}</span>
        `;
        item.addEventListener('click', async () => {
          await assignSoundToCategory(sound.id, cat.id);
          document.getElementById('category-move-modal').classList.add('hidden');
        });
        list.appendChild(item);
      });
    }
    
    document.getElementById('category-move-modal').classList.remove('hidden');
  }

  async function assignSoundToCategory(soundId, categoryId) {
    if (window.soundsok && window.soundsok.sounds) {
      const res = await window.soundsok.sounds.update(soundId, { categoryId: categoryId });
      if (res && res.success && res.sound) {
        window.SoundList.updateSound(soundId, { categoryId: categoryId });
        
        // Reload sounds to ensure correctness
        const allSounds = await window.soundsok.sounds.list();
        if (allSounds && allSounds.success && allSounds.sounds) {
          window.SoundList.setSounds(allSounds.sounds);
        }
        window.Categories.updateCounts();
      }
    }
  }

  /* ─────────────── Audio Devices ─────────────── */

  let _audioDeviceListenersBound = false;

  async function loadAudioDevices() {
    try {
      const speakerSelect = document.getElementById('setting-speaker-device');
      const micSelect = document.getElementById('setting-mic-device');
      if (!speakerSelect || !micSelect) return;
      
      // Request temporary microphone permission so device labels are visible
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        console.warn('[App] Media devices permission denied or not supported:', e);
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter(d => d.kind === 'audiooutput');
      
      speakerSelect.innerHTML = '';
      micSelect.innerHTML = '';
      
      // Default Speakers option
      const optDefaultSpeaker = document.createElement('option');
      optDefaultSpeaker.value = 'default';
      optDefaultSpeaker.textContent = 'Varsayılan Sistem Hoparlörü';
      speakerSelect.appendChild(optDefaultSpeaker);
      
      // Select Microphone option
      const optSelectMic = document.createElement('option');
      optSelectMic.value = '';
      optSelectMic.textContent = 'Seçilmedi (Discord/Kanal oynatma kapalı)';
      micSelect.appendChild(optSelectMic);
      
      outputs.forEach(device => {
        const optSpeaker = document.createElement('option');
        optSpeaker.value = device.deviceId;
        optSpeaker.textContent = device.label || `Çıkış Aygıtı (${device.deviceId.slice(0, 5)}...)`;
        speakerSelect.appendChild(optSpeaker);
        
        const optMic = document.createElement('option');
        optMic.value = device.deviceId;
        optMic.textContent = device.label || `Sanal Giriş (${device.deviceId.slice(0, 5)}...)`;
        micSelect.appendChild(optMic);
      });
      
      // Load saved settings
      speakerSelect.value = localStorage.getItem('speakerDeviceId') || 'default';
      micSelect.value = localStorage.getItem('micDeviceId') || '';
      
      // Listen to change events — only bind once
      if (!_audioDeviceListenersBound) {
        _audioDeviceListenersBound = true;
        
        speakerSelect.addEventListener('change', async (e) => {
          localStorage.setItem('speakerDeviceId', e.target.value);
          await window.AudioPlayer.setSpeakerDevice(e.target.value);
        });
        
        micSelect.addEventListener('change', async (e) => {
          localStorage.setItem('micDeviceId', e.target.value);
          await window.AudioPlayer.setMicDevice(e.target.value);
        });
      }
      
      // Initialize player engine settings
      await window.AudioPlayer.setSpeakerDevice(speakerSelect.value);
      await window.AudioPlayer.setMicDevice(micSelect.value);
      
    } catch (err) {
      console.error('[App] Failed to load audio devices:', err);
    }
  }

})();
