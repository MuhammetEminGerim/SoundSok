const { globalShortcut } = require('electron');

let database = null;
let mainWindow = null;
let stopShortcut = null;

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

  // Register global stop hotkey
  if (stopShortcut) {
    try {
      globalShortcut.register(stopShortcut, () => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('cli:stop');
        }
      });
    } catch (e) {
      console.error(`Failed to register global stop hotkey ${stopShortcut}`, e);
    }
  }
}

function registerStopShortcut(hotkey) {
  stopShortcut = hotkey;
  registerAllShortcuts();
}

function unregisterAllShortcuts() {
  globalShortcut.unregisterAll();
}

module.exports = { initGlobalShortcuts, registerAllShortcuts, unregisterAllShortcuts, registerStopShortcut };
