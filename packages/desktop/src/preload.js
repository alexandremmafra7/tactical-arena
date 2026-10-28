import { contextBridge, ipcRenderer, webFrame } from 'electron';

/** The surface the renderer gets into the main process for desktop app features
 *  (app info, save backup, quit, fullscreen control, and adaptive zoom). */
contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  saveGame: () => ipcRenderer.invoke('app:save-game'),
  quitGame: () => ipcRenderer.invoke('app:quit'),
  toggleFullscreen: () => ipcRenderer.invoke('app:toggle-fullscreen'),
  isFullscreen: () => ipcRenderer.invoke('app:is-fullscreen'),
  setFullscreen: (flag) => ipcRenderer.invoke('app:set-fullscreen', flag),
  onFullscreenChange: (callback) => {
    const subscription = (_event, isFull) => callback(isFull);
    ipcRenderer.on('app:fullscreen-changed', subscription);
    return () => ipcRenderer.removeListener('app:fullscreen-changed', subscription);
  },
  setZoomFactor: (factor) => {
    if (typeof factor === 'number' && factor > 0) {
      webFrame.setZoomFactor(factor);
    }
  },
  getZoomFactor: () => webFrame.getZoomFactor(),
});
