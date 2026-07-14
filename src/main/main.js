/**
 * SoundSok - Electron Main Process
 *
 * Entry point for the application.  Responsibilities:
 *   1. Create the frameless BrowserWindow.
 *   2. Initialise the SQLite database.
 *   3. Register all IPC handlers.
 *   4. Manage the standard Electron lifecycle events.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');
const Database = require('./database');
const { registerIpcHandlers } = require('./ipc-handlers');
const { APP_NAME } = require('../shared/constants');
const { createTray } = require('./tray');
const { initGlobalShortcuts, unregisterAllShortcuts } = require('./globalShortcuts');
const { startRemoteServer } = require('./remote-server');

/** @type {BrowserWindow | null} */
let mainWindow = null;

/** @type {Database | null} */
let database = null;

// ── Single Instance Lock (CLI command receiver) ───────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
      
      // Handle the command line args sent from the second instance
      handleCliArguments(commandLine);
    }
  });
}

function handleCliArguments(argv) {
  console.log('[Main] Received CLI Arguments:', argv);
  if (!mainWindow) return;
  
  const playIdIdx = argv.indexOf('--play-id');
  if (playIdIdx !== -1 && playIdIdx + 1 < argv.length) {
    mainWindow.webContents.send('cli:play-id', argv[playIdIdx + 1]);
    return;
  }
  
  const playSlotIdx = argv.indexOf('--play-slot');
  if (playSlotIdx !== -1 && playSlotIdx + 1 < argv.length) {
    const slot = parseInt(argv[playSlotIdx + 1], 10);
    mainWindow.webContents.send('cli:play-slot', slot);
    return;
  }
  
  if (argv.includes('--stop')) {
    mainWindow.webContents.send('cli:stop');
    return;
  }
  
  if (argv.includes('--toggle')) {
    mainWindow.webContents.send('cli:toggle');
    return;
  }
  
  const volumeIdx = argv.indexOf('--volume');
  if (volumeIdx !== -1 && volumeIdx + 1 < argv.length) {
    const vol = parseInt(argv[volumeIdx + 1], 10);
    mainWindow.webContents.send('cli:volume', vol);
    return;
  }

  const seekIdx = argv.indexOf('--seek');
  if (seekIdx !== -1 && seekIdx + 1 < argv.length) {
    const percent = parseInt(argv[seekIdx + 1], 10);
    mainWindow.webContents.send('cli:seek', percent);
    return;
  }
}

function compilePttHelper() {
  const sourcePath = path.join(__dirname, 'ptt_helper.cs');
  const exePath = path.join(__dirname, 'ptt_helper.exe');
  
  if (!fs.existsSync(exePath) && fs.existsSync(sourcePath)) {
    try {
      console.log('[Main] Compiling ptt_helper.cs...');
      const windir = process.env.windir || 'C:\\Windows';
      const cscPath = path.join(windir, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe');
      
      if (fs.existsSync(cscPath)) {
        execSync(`"${cscPath}" /out:"${exePath}" "${sourcePath}"`, { stdio: 'ignore' });
        console.log('[Main] ptt_helper.exe compiled successfully.');
      } else {
        console.warn('[Main] csc.exe not found. PTT automation will not work.');
      }
    } catch (err) {
      console.error('[Main] Failed to compile ptt_helper.cs:', err);
    }
  }
}

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
    backgroundColor: '#f5f6fa',
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
    // Handle any arguments passed to the initial instance
    handleCliArguments(process.argv);
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
  // Compile the PTT automation helper first
  compilePttHelper();

  // Initialise the database before anything else
  database = new Database();
  database.init();

  createWindow();

  // Wire up IPC channels
  registerIpcHandlers(database, mainWindow);

  // Start Remote control web server
  try {
    const serverInfo = startRemoteServer(database, (channel, ...args) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, ...args);
      }
    });
    global.remoteUrl = serverInfo.url;
    console.log('[Main] Web Remote Server started successfully at', global.remoteUrl);
  } catch (err) {
    console.error('[Main] Failed to start Web Remote Server:', err);
  }
  
  // Create system tray
  createTray(mainWindow);
  
  // Init global shortcuts
  initGlobalShortcuts(database, mainWindow);

  // macOS: re-create the window when the dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      registerIpcHandlers(database, mainWindow);
    }
  });
});

app.on('window-all-closed', () => {
  // We override this to NOT quit when all windows are closed,
  // because we want the app to keep running in the tray.
});

app.on('before-quit', () => {
  unregisterAllShortcuts();
  if (database) {
    database.close();
  }
});
