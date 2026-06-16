import { contextBridge, ipcRenderer } from "electron";

// ── Update event types ────────────────────────────────────────────────────
type UpdateAvailableInfo = { version: string; releaseDate?: string; releaseNotes?: string };
type UpdateProgressInfo = { percent: number; transferred: number; total: number; bytesPerSecond: number };
type UpdateDownloadedInfo = { version: string };
type UpdateErrorInfo = { message: string };

type UpdateListener =
  | ((info: UpdateAvailableInfo) => void)
  | ((info: UpdateProgressInfo) => void)
  | ((info: UpdateDownloadedInfo) => void)
  | ((info: UpdateErrorInfo) => void)
  | (() => void);

// ── Exposed API ───────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld("glibDesktop", {
  // Project picker
  pickProjectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke("glib:pick-project-directory"),

  // First-launch
  getFirstLaunchState: (): Promise<{
    isFirstLaunch: boolean;
    platform: string;
    appVersion: string;
  }> => ipcRenderer.invoke("glib:first-launch-state"),

  markWelcomeSeen: (): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("glib:mark-welcome-seen"),

  // Permissions
  checkFsPermission: (): Promise<{ platform: string; needsRationale: boolean }> =>
    ipcRenderer.invoke("glib:check-fs-permission"),

  // Updates
  downloadUpdate: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("glib:download-update"),

  installUpdate: (): Promise<void> =>
    ipcRenderer.invoke("glib:install-update"),

  // External links (auth, release notes)
  openExternal: (url: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("glib:open-external", url),

  // Update event subscriptions — renderer registers listeners, gets back
  // an unsubscribe function to call on component unmount.
  onUpdateAvailable: (cb: (info: UpdateAvailableInfo) => void) => {
    const handler = (_: Electron.IpcRendererEvent, info: UpdateAvailableInfo) => cb(info);
    ipcRenderer.on("glib:update-available", handler);
    return () => ipcRenderer.removeListener("glib:update-available", handler);
  },

  onUpdateNotAvailable: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("glib:update-not-available", handler);
    return () => ipcRenderer.removeListener("glib:update-not-available", handler);
  },

  onUpdateProgress: (cb: (info: UpdateProgressInfo) => void) => {
    const handler = (_: Electron.IpcRendererEvent, info: UpdateProgressInfo) => cb(info);
    ipcRenderer.on("glib:update-progress", handler);
    return () => ipcRenderer.removeListener("glib:update-progress", handler);
  },

  onUpdateDownloaded: (cb: (info: UpdateDownloadedInfo) => void) => {
    const handler = (_: Electron.IpcRendererEvent, info: UpdateDownloadedInfo) => cb(info);
    ipcRenderer.on("glib:update-downloaded", handler);
    return () => ipcRenderer.removeListener("glib:update-downloaded", handler);
  },

  onUpdateError: (cb: (info: UpdateErrorInfo) => void) => {
    const handler = (_: Electron.IpcRendererEvent, info: UpdateErrorInfo) => cb(info);
    ipcRenderer.on("glib:update-error", handler);
    return () => ipcRenderer.removeListener("glib:update-error", handler);
  },
});
