const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("downloader", {
  readClipboardText: () => ipcRenderer.invoke("read-clipboard-text"),
  getDefaultDownloadStatus: () => ipcRenderer.invoke("default-download-client-status"),
  pickDirectory: () => ipcRenderer.invoke("pick-download-directory"),
  pickVideoFile: () => ipcRenderer.invoke("pick-video-file"),
  openDownloadLocation: (targetPath, fallbackPath) => ipcRenderer.invoke("open-download-location", targetPath, fallbackPath),
  resizeToContent: (height, options) => ipcRenderer.invoke("window-resize-to-content", height, options),
  minimizeWindow: () => ipcRenderer.invoke("window-minimize"),
  closeWindow: () => ipcRenderer.invoke("window-close"),
  getUpdateState: () => ipcRenderer.invoke("update-get-state"),
  checkForUpdates: () => ipcRenderer.invoke("update-check"),
  setAutoUpdateCheck: (enabled) => ipcRenderer.invoke("update-set-auto-check", Boolean(enabled)),
  installUpdate: () => ipcRenderer.invoke("update-install"),
  onUpdateState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("update-state", handler);
    return () => ipcRenderer.removeListener("update-state", handler);
  }
});
