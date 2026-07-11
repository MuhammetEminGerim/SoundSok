/**
 * SoundSok - Electron Main Process
 *
 * Entry point for the application.  Responsibilities:
 *   1. Create the frameless BrowserWindow.
 *   2. Initialise the SQLite database.
 *   3. Register all IPC handlers.
 *   4. Manage the standard Electron lifecycle events.
 */

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');
const Database = require('./database');
const { registerIpcHandlers } = require('./ipc-handlers');
const { APP_NAME } = require('../shared/constants');

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** @type {Database | null} */
let database = null;

/**
 * Create the primary application window.
 */
function createWindow() {
  const windowOptions = {
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    frame: false,                     // frameless window – custom title bar
    backgroundColor: '#0a0a0f',
    show: false,                      // avoid white flash before content loads
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  };

  // Set the application icon if the resource file exists
  const iconPath = path.join(__dirname, '..', '..', 'resources', 'icon.ico');
  if (fs.existsSync(iconPath)) {
    windowOptions.icon = iconPath;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Load the renderer HTML
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Show the window once the renderer has finished painting
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools automatically in dev mode (electron . --dev)
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Initialise the database before anything else
  database = new Database();
  database.init();

  createWindow();

  // Wire up IPC channels
  registerIpcHandlers(database, mainWindow);

  // macOS: re-create the window when the dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      registerIpcHandlers(database, mainWindow);
    }
  });
});

app.on('window-all-closed', () => {
  // Close database connection before quitting
  if (database) {
    database.close();
  }

  // On macOS the app traditionally stays active until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
