/**
 * SoundSok - Preload Script
 *
 * Runs in a privileged context before the renderer page loads.  Uses Electron's
 * `contextBridge` to expose a safe, minimal API on `window.soundsok` so the
 * renderer can communicate with the main process without enabling
 * `nodeIntegration`.
 */

const { contextBridge, ipcRenderer } = require('electron');
const {
  SOUND_ADD,
  SOUND_REMOVE,
  SOUND_LIST,
  SOUND_UPDATE,
  DIALOG_OPEN_FILES,
  APP_MINIMIZE,
  APP_MAXIMIZE,
  APP_CLOSE,
  CATEGORY_ADD,
  CATEGORY_REMOVE,
  CATEGORY_LIST,
} = require('../shared/ipc-channels');

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

    /**
     * Retrieve all categories.
     * @returns {Promise<{ success: boolean, categories?: Object[], error?: string }>}
     */
    list: () => ipcRenderer.invoke(CATEGORY_LIST),
  },

  // ── Playback ───────────────────────────────────────────────────────────
  // Audio playback is handled entirely in the renderer process using the
  // Web Audio API, so no IPC calls are needed here.
  playback: {},

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
