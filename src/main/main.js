const { app, BrowserWindow, ipcMain, shell, clipboard, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// Packaged apps swallow console output, so a startup crash would be invisible.
// Record it and surface it rather than failing silently.
function reportStartupError(err) {
  const message = (err && err.stack) || String(err);
  try {
    fs.writeFileSync(path.join(app.getPath('userData'), 'startup-error.log'), message);
  } catch { /* best effort */ }
  console.error('Startup error:', message);
  try {
    dialog.showErrorBox('Snag failed to start', message);
  } catch { /* dialog may be unavailable very early */ }
}
process.on('uncaughtException', reportStartupError);
process.on('unhandledRejection', reportStartupError);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 720,
    minHeight: 560,
    // Frameless on BOTH platforms so our custom titlebar is the only chrome
    // and looks identical on Windows and macOS. Hidden traffic lights on mac.
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0d0d12',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Avoid a white flash: reveal only once the first paint is ready.
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // External links open in the user's real browser, never a new Electron window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

/* ---------------- Window control IPC (custom titlebar) ---------------- */
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:toggle-maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());
ipcMain.handle('clipboard:read', () => clipboard.readText());

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// A tool, not a background service: closing the window quits everywhere.
app.on('window-all-closed', () => app.quit());
