/**
 * SoundSok - Preload Script
 *
 * Runs in a privileged context before the renderer page loads.  Uses Electron's
 * `contextBridge` to expose a safe, minimal API on `window.soundsok` so the
 * renderer can communicate with the main process without enabling
 * `nodeIntegration`.
 */

const { contextBridge, ipcRenderer } = require('electron');

// ── IPC Channels (declared locally to support sandboxed preload script) ──
const SOUND_ADD          = 'sound:add';
const SOUND_REMOVE       = 'sound:remove';
const SOUND_LIST         = 'sound:list';
const SOUND_UPDATE       = 'sound:update';
const DIALOG_OPEN_FILES  = 'dialog:open-files';
const APP_MINIMIZE       = 'app:minimize';
const APP_MAXIMIZE       = 'app:maximize';
const APP_CLOSE          = 'app:close';
const CATEGORY_ADD       = 'category:add';
const CATEGORY_REMOVE    = 'category:remove';
const CATEGORY_LIST      = 'category:list';
const CATEGORY_UPDATE    = 'category:update';
const HOTKEY_ASSIGN      = 'hotkey:assign';
const HOTKEY_CHECK       = 'hotkey:check';
const APP_TOGGLE_STARTUP = 'app:toggle-startup';
const PTT_PRESS          = 'ptt:press';
const PTT_RELEASE        = 'ptt:release';

contextBridge.exposeInMainWorld('soundsok', {
  // ── Sound Operations ───────────────────────────────────────────────────

  sounds: {
    /**
     * Add a new sound to the library.
     * @param {string} filePath - Absolute path to the audio file.
     * @returns {Promise<{ success: boolean, sound?: Object, error?: string }>}
     */
    add: (filePath) => ipcRenderer.invoke(SOUND_ADD, filePath),

    /**
     * Remove a sound from the library by its id.
     * @param {number} id
     * @returns {Promise<{ success: boolean, deleted?: boolean, error?: string }>}
     */
    remove: (id) => ipcRenderer.invoke(SOUND_REMOVE, id),

    /**
     * Retrieve the complete list of sounds.
     * @returns {Promise<{ success: boolean, sounds?: Object[], error?: string }>}
     */
    list: () => ipcRenderer.invoke(SOUND_LIST),

    /**
     * Update fields on an existing sound.
     * @param {number} id   - Sound id to update.
     * @param {Object} data - Key/value pairs to change.
     * @returns {Promise<{ success: boolean, sound?: Object, error?: string }>}
     */
    update: (id, data) => ipcRenderer.invoke(SOUND_UPDATE, id, data),
  },

  // ── Category Operations ────────────────────────────────────────────────

  categories: {
    /**
     * Create a new category.
     * @param {{ name: string, color?: string, icon?: string }} category
     * @returns {Promise<{ success: boolean, category?: Object, error?: string }>}
     */
    add: (category) => ipcRenderer.invoke(CATEGORY_ADD, category),

    /**
     * Delete a category.  Sounds in this category will become uncategorised.
     * @param {number} id
     * @returns {Promise<{ success: boolean, deleted?: boolean, error?: string }>}
     */
    remove: (id) => ipcRenderer.invoke(CATEGORY_REMOVE, id),

    list: () => ipcRenderer.invoke(CATEGORY_LIST),

    /**
     * Update an existing category.
     * @param {number} id   - Category id to update.
     * @param {Object} data - Key/value pairs to change (camelCase keys).
     * @returns {Promise<{ success: boolean, category?: Object, error?: string }>}
     */
    update: (id, data) => ipcRenderer.invoke(CATEGORY_UPDATE, id, data),
  },

  // ── Playback ───────────────────────────────────────────────────────────
  // Audio playback is handled entirely in the renderer process using the
  // Web Audio API, but we need to listen for hotkey triggers from main.
  playback: {
    onPlayHotkey: (callback) => {
      ipcRenderer.on('PLAYBACK_PLAY_HOTKEY', (_event, sound) => callback(sound));
    }
  },

  // ── Hotkeys & Settings ─────────────────────────────────────────────────
  
  hotkeys: {
    assign: (soundId, hotkey) => ipcRenderer.invoke(HOTKEY_ASSIGN, soundId, hotkey),
    check: (hotkey) => ipcRenderer.invoke(HOTKEY_CHECK, hotkey),
  },
  
  settings: {
    toggleStartup: (enable) => ipcRenderer.invoke(APP_TOGGLE_STARTUP, enable),
  },
  
  ptt: {
    press: (key) => ipcRenderer.invoke(PTT_PRESS, key),
    release: (key) => ipcRenderer.invoke(PTT_RELEASE, key),
  },

  cli: {
    onPlayId: (callback) => ipcRenderer.on('cli:play-id', (_event, id) => callback(id)),
    onPlaySlot: (callback) => ipcRenderer.on('cli:play-slot', (_event, slot) => callback(slot)),
    onStop: (callback) => ipcRenderer.on('cli:stop', () => callback()),
    onToggle: (callback) => ipcRenderer.on('cli:toggle', () => callback()),
    onVolume: (callback) => ipcRenderer.on('cli:volume', (_event, vol) => callback(vol)),
    onSeek: (callback) => ipcRenderer.on('cli:seek', (_event, percent) => callback(percent)),
  },

  // ── Native Dialogs ─────────────────────────────────────────────────────

  dialog: {
    /**
     * Open a native file-picker filtered to supported audio formats.
     * @returns {Promise<string[]>} Array of selected file paths (empty if cancelled).
     */
    openFiles: () => ipcRenderer.invoke(DIALOG_OPEN_FILES),
  },

  // ── Window Controls (frameless title bar) ──────────────────────────────

  window: {
    /** Minimise the application window. */
    minimize: () => ipcRenderer.invoke(APP_MINIMIZE),

    /** Toggle maximise / restore. */
    maximize: () => ipcRenderer.invoke(APP_MAXIMIZE),

    /** Close the application window. */
    close: () => ipcRenderer.invoke(APP_CLOSE),
  },
});
