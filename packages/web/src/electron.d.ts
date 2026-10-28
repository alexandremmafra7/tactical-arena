export interface ElectronAppInfo {
  name: string;
  version: string;
  electron: string;
  chrome: string;
  platform: string;
}

export interface ElectronSaveResult {
  ok: boolean;
  path?: string;
  error?: string;
}

export interface ElectronAPI {
  getAppInfo: () => Promise<ElectronAppInfo>;
  saveGame: () => Promise<ElectronSaveResult>;
  quitGame: () => Promise<void>;
  toggleFullscreen: () => Promise<boolean>;
  isFullscreen: () => Promise<boolean>;
  setFullscreen: (flag: boolean) => Promise<boolean>;
  onFullscreenChange: (callback: (isFull: boolean) => void) => () => void;
  setZoomFactor?: (factor: number) => void;
  getZoomFactor?: () => number;
}

/** Only present inside the packaged desktop app (see packages/desktop/src/preload.js) — undefined in a
 *  plain browser tab, including the dev-web-only workflow used while iterating on this UI. */
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
