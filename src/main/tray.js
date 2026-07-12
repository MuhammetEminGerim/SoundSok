const { Tray, Menu, app, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;

function createTray(mainWindow) {
  let iconPath = path.join(__dirname, '..', '..', 'resources', 'icon.ico');
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
  } else {
    // Create a 16x16 empty image as fallback to prevent crash
    icon = nativeImage.createEmpty();
  }
  
  try {
    tray = new Tray(icon);
    
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Göster', click: () => mainWindow.show() },
      { type: 'separator' },
      { 
        label: 'Çıkış', 
        click: () => {
          app.isQuiting = true;
          app.quit();
        }
      }
    ]);
    
    tray.setToolTip('SoundSok');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    });
  } catch (e) {
    console.error('Tray icon could not be created', e);
  }
  
  return tray;
}

module.exports = { createTray };
