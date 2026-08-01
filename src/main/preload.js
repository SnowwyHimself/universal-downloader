// Preload — the only bridge between the sandboxed renderer and Node/Electron.
// Everything the UI can do is an explicit, named channel here; the renderer
// never gets raw ipcRenderer or Node access. Download/convert/settings
// channels are added in their respective phases.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lasso', {
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
  clipboard: {
    read: () => ipcRenderer.invoke('clipboard:read'),
  },
});
