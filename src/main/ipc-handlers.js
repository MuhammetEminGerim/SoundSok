/**
 * SoundSok - IPC Handler Registration
 *
 * Connects each IPC channel to the appropriate database operation or native
 * API call.  All handlers use `ipcMain.handle` (invoke/handle pattern) so
 * the renderer can `await` results.
 *
 * Usage (in main.js):
 *   const { registerIpcHandlers } = require('./ipc-handlers');
 *   registerIpcHandlers(db, mainWindow);
 */

const path = require('path');
const { ipcMain, dialog } = require('electron');
const { SUPPORTED_FORMATS } = require('../shared/constants');
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

/**
 * Build a file-dialog filter object from the supported format list.
 * Produces a single "Audio Files" filter plus an "All Files" fallback.
 *
 * @returns {Electron.FileFilter[]}
 */
function buildAudioFilters() {
  // Strip leading dots – dialog.showOpenDialog expects bare extensions
  const extensions = SUPPORTED_FORMATS.map((ext) => ext.replace(/^\./, ''));

  return [
    { name: 'Audio Files', extensions },
    { name: 'All Files', extensions: ['*'] },
  ];
}

/**
 * Extract a human-readable sound name from a file path.
 * Removes the extension and replaces underscores/hyphens with spaces.
 *
 * @param {string} filePath
 * @returns {string}
 */
function nameFromPath(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  return base.replace(/[_-]+/g, ' ').trim();
}

/**
 * Register all IPC handlers for the application.
 *
 * @param {import('./database')} db          - Initialised Database instance.
 * @param {Electron.BrowserWindow} mainWindow - The primary application window.
 */
function registerIpcHandlers(db, mainWindow) {
  // ── Native File Dialog ─────────────────────────────────────────────────

  ipcMain.handle(DIALOG_OPEN_FILES, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Audio Files',
      properties: ['openFile', 'multiSelections'],
      filters: buildAudioFilters(),
    });

    if (result.canceled) {
      return [];
    }

    return result.filePaths;
  });

  // ── Sound CRUD ─────────────────────────────────────────────────────────

  ipcMain.handle(SOUND_ADD, (_event, filePath) => {
    try {
      const name = nameFromPath(filePath);
      const sound = db.addSound({ name, filePath });
      return { success: true, sound };
    } catch (error) {
      // UNIQUE constraint violation → file already added
      if (error.message.includes('UNIQUE')) {
        return { success: false, error: 'This audio file has already been added.' };
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(SOUND_REMOVE, (_event, id) => {
    try {
      const result = db.removeSound(id);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(SOUND_LIST, () => {
    try {
      const sounds = db.getAllSounds();
      return { success: true, sounds };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(SOUND_UPDATE, (_event, id, data) => {
    try {
      const sound = db.updateSound(id, data);
      if (!sound) {
        return { success: false, error: 'Sound not found.' };
      }
      return { success: true, sound };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ── Category CRUD ──────────────────────────────────────────────────────

  ipcMain.handle(CATEGORY_ADD, (_event, category) => {
    try {
      const cat = db.addCategory(category);
      return { success: true, category: cat };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CATEGORY_REMOVE, (_event, id) => {
    try {
      const result = db.removeCategory(id);
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(CATEGORY_LIST, () => {
    try {
      const categories = db.getAllCategories();
      return { success: true, categories };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // ── Window Controls (frameless title bar) ──────────────────────────────

  ipcMain.handle(APP_MINIMIZE, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle(APP_MAXIMIZE, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle(APP_CLOSE, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });
}

module.exports = { registerIpcHandlers };
