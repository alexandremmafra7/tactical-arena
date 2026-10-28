export const fullscreenHelper = {
  async isFullscreen(): Promise<boolean> {
    if (window.electronAPI?.isFullscreen) {
      return await window.electronAPI.isFullscreen();
    }
    return !!document.fullscreenElement;
  },

  async toggleFullscreen(): Promise<boolean> {
    if (window.electronAPI?.toggleFullscreen) {
      return await window.electronAPI.toggleFullscreen();
    }

    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      return true;
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
      return false;
    }
  },

  async setFullscreen(flag: boolean): Promise<boolean> {
    if (window.electronAPI?.setFullscreen) {
      return await window.electronAPI.setFullscreen(flag);
    }

    if (flag && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      return true;
    } else if (!flag && document.fullscreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
      return false;
    }
    return flag;
  },

  onFullscreenChange(callback: (isFull: boolean) => void): () => void {
    if (window.electronAPI?.onFullscreenChange) {
      return window.electronAPI.onFullscreenChange(callback);
    }

    function handler() {
      callback(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
    };
  }
};
