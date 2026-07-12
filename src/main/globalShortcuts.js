const { globalShortcut } = require('electron');

let database = null;
let mainWindow = null;

function initGlobalShortcuts(db, window) {
  database = db;
  mainWindow = window;
  registerAllShortcuts();
}

function registerAllShortcuts() {
  globalShortcut.unregisterAll();
  
  if (!database || !mainWindow) return;
  
  const sounds = database.getAllSounds();
  for (const sound of sounds) {
    if (sound.hotkey) {
      try {
        globalShortcut.register(sound.hotkey, () => {
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('PLAYBACK_PLAY_HOTKEY', sound);
          }
        });
      } catch (e) {
        console.error(`Failed to register hotkey ${sound.hotkey} for sound ${sound.name}`, e);
      }
    }
  }
}

function unregisterAllShortcuts() {
  globalShortcut.unregisterAll();
}

module.exports = { initGlobalShortcuts, registerAllShortcuts, unregisterAllShortcuts };
