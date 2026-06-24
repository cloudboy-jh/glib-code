import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from "electron";
import { type UpdateInfo, type ProgressInfo, type UpdateDownloadedEvent } from "electron-updater";
// electron-updater is a pure CJS module — require directly to avoid TypeScript's
// __importDefault wrapper mangling the named exports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { autoUpdater } = require("electron-updater") as typeof import("electron-updater");
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

// Production layout (inside .app bundle / MSIX package):
// Resources/
//   app/          ← app.getAppPath(), compiled main.js + preload.js
//   server/       ← extraResources: Bun server source
//   web/dist/     ← extraResources: built Vue app
// process.resourcesPath points to Resources/

let serverProc: ReturnType<typeof spawn> | null = null;
let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
// Distinguishes a real quit (tray menu / app.quit) from a window "close" that
// should merely hide the window to the tray.
let isQuitting = false;
const isDev = process.env.GLIB_DESKTOP_DEV === "1";
const apiPort = 4273;
const devWebUrl = "http://127.0.0.1:5173";
const healthUrl = `http://127.0.0.1:${apiPort}/api/health`;

function getRepoRoot() {
  if (isDev) {
    return resolve(app.getAppPath(), "..");
  }
  return process.resourcesPath;
}

function getPreloadPath() {
  return join(app.getAppPath(), "dist", "preload.js");
}

function getTrayIconPath() {
  // Dev: app.getAppPath() is the desktop/ package root, so assets/ is relative.
  // Packaged: the tray PNG is shipped via extraResources into Resources/assets/.
  const fileName = process.platform === "win32" ? "tray.ico" : "tray.png";
  if (isDev) {
    return join(app.getAppPath(), "assets", fileName);
  }
  return join(process.resourcesPath, "assets", fileName);
}

function getBunCommand() {
  return process.platform === "win32" ? "bun.exe" : "bun";
}

async function waitForUrl(url: string, timeoutMs = 30_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // service is not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

// ── First-launch state ────────────────────────────────────────────────────

function getStateDir() {
  return app.getPath("userData");
}

function getFirstLaunchFlagPath() {
  return join(getStateDir(), "has-seen-welcome.json");
}

function hasSeenWelcome(): boolean {
  try {
    const raw = readFileSync(getFirstLaunchFlagPath(), "utf-8");
    return JSON.parse(raw)?.seen === true;
  } catch (error: any) {
    // If the file exists but can't be parsed, it's corrupted. Treat as seen
    // so the user doesn't get the full first-run flow again just because
    // the flag file was locked or partially written.
    if (error?.code === "ENOENT") return false;
    return true;
  }
}

function markWelcomeSeen() {
  try {
    mkdirSync(getStateDir(), { recursive: true });
    writeFileSync(getFirstLaunchFlagPath(), JSON.stringify({ seen: true, at: new Date().toISOString() }));
  } catch {
    // non-fatal
  }
}

// ── Auto-updater setup ────────────────────────────────────────────────────

function setupAutoUpdater(win: BrowserWindow) {
  // Only run the updater when explicitly enabled (i.e. CI/release builds set GLIB_ENABLE_UPDATER=1).
  // Local --dir builds and dev mode both skip it to avoid spurious "no disk space" / 404 errors.
  if (isDev || process.env.GLIB_ENABLE_UPDATER !== "1") return;

  autoUpdater.autoDownload = false; // we notify the renderer first
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    win.webContents.send("glib:update-available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === "string" ? info.releaseNotes : undefined,
    });
  });

  autoUpdater.on("update-not-available", () => {
    win.webContents.send("glib:update-not-available");
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    win.webContents.send("glib:update-progress", {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateDownloadedEvent) => {
    win.webContents.send("glib:update-downloaded", { version: info.version });
  });

  autoUpdater.on("error", (err: Error) => {
    win.webContents.send("glib:update-error", { message: err.message });
  });

  // Check for updates 5s after window is ready (non-blocking)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // network might be offline — silent fail
    });
  }, 5_000);
}

// ── IPC handlers ──────────────────────────────────────────────────────────

function registerIpcHandlers() {
  // Project picker
  ipcMain.handle("glib:pick-project-directory", async () => {
    const result = await dialog.showOpenDialog({
      title: "Open Project",
      properties: ["openDirectory"],
    });
    if (result.canceled) return null;
    return result.filePaths[0] ?? null;
  });

  // First-launch: renderer queries and acks
  ipcMain.handle("glib:first-launch-state", () => ({
    isFirstLaunch: !hasSeenWelcome(),
    platform: process.platform,
    appVersion: app.getVersion(),
  }));

  ipcMain.handle("glib:mark-welcome-seen", () => {
    markWelcomeSeen();
    return { ok: true };
  });

  // Update control: renderer triggers download + install
  ipcMain.handle("glib:download-update", async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle("glib:install-update", () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // Open URLs in default browser (for auth flows, release notes, etc.)
  ipcMain.handle("glib:open-external", async (_event, url: string) => {
    // Allowlist: only open https:// URLs
    if (typeof url === "string" && url.startsWith("https://")) {
      await shell.openExternal(url);
      return { ok: true };
    }
    return { ok: false, error: "URL must be https://" };
  });

  // Permission rationale: query whether broad FS access is granted (Windows only)
  ipcMain.handle("glib:check-fs-permission", () => {
    // On Windows MSIX, broadFileSystemAccess is declared in the manifest.
    // The OS prompts the user on first access — this lets the renderer show
    // a rationale card *before* that prompt fires.
    return {
      platform: process.platform,
      // MSIX apps have this declared; non-MSIX (dir builds) skip the prompt
      needsRationale: process.platform === "win32" && app.isPackaged,
    };
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────

function showMainWindow() {
  if (!mainWindow) {
    void createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function buildTrayMenu() {
  const visible = Boolean(mainWindow?.isVisible());
  return Menu.buildFromTemplate([
    {
      label: visible ? "Hide glib-code" : "Show glib-code",
      click: () => {
        if (mainWindow?.isVisible()) {
          mainWindow.hide();
        } else {
          showMainWindow();
        }
      },
    },
    {
      label: "Check for Updates",
      enabled: !isDev && process.env.GLIB_ENABLE_UPDATER === "1",
      click: () => {
        autoUpdater.checkForUpdates().catch(() => {
          // network might be offline — silent fail
        });
      },
    },
    { type: "separator" },
    {
      label: "Quit glib-code",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function refreshTrayMenu() {
  tray?.setContextMenu(buildTrayMenu());
}

function setupTray() {
  if (tray) return;

  const image = nativeImage.createFromPath(getTrayIconPath());
  // Fall back to an empty image rather than crashing if the asset is missing;
  // the tray still works, just without an icon.
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip("glib-code");
  tray.setContextMenu(buildTrayMenu());

  // Left-click toggles window visibility (Windows/Linux). On macOS the click
  // also opens the context menu by default, which is the expected behavior.
  tray.on("click", () => {
    if (mainWindow?.isVisible() && !mainWindow.isMinimized()) {
      mainWindow.hide();
    } else {
      showMainWindow();
    }
    refreshTrayMenu();
  });
}

// ── Window creation ───────────────────────────────────────────────────────

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // revealed after content loads to avoid flash
    backgroundColor: "#0b0f14",
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: getPreloadPath(),
    },
  });

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[desktop] failed to load ${validatedURL}: ${errorCode} ${errorDescription}`);
  });

  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow = win;

  win.once("ready-to-show", () => {
    win.show();
  });

  // Close-to-tray: hide the window instead of quitting. The app keeps running
  // (server stays alive) and is reachable from the tray. A real quit sets
  // isQuitting first (tray menu / before-quit).
  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
      refreshTrayMenu();
    }
  });

  win.on("show", refreshTrayMenu);
  win.on("hide", refreshTrayMenu);

  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  // Open devtools in dev OR when GLIB_DEVTOOLS is set (for debugging packaged builds)
  if (isDev || process.env.GLIB_DEVTOOLS === "1") {
    win.webContents.openDevTools({ mode: "detach" });
  }

  if (isDev) {
    try {
      await waitForUrl(devWebUrl);
      await win.loadURL(devWebUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await win.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(
          `<!doctype html><html><body style='margin:0;background:#0b0f14;color:#f4d2d2;font:14px system-ui;padding:32px'><h1>glib-code desktop failed to start</h1><pre>${message}</pre><p>Check the dev terminal. Vite must be running on ${devWebUrl}.</p></body></html>`
        )}`
      );
    }
    setupAutoUpdater(win);
    return;
  }

  const webIndex = join(getRepoRoot(), "web", "dist", "index.html");
  if (!existsSync(webIndex)) {
    await win.loadURL(
      `data:text/plain;charset=utf-8,${encodeURIComponent(
        "glib-code desktop needs a web build. Run `bun run build` first."
      )}`
    );
    return;
  }

  await win.loadFile(webIndex);
  setupAutoUpdater(win);
}

// ── App lifecycle ─────────────────────────────────────────────────────────

// Single-instance lock: a second launch (e.g. from the tray-installed shortcut)
// focuses the existing window instead of spawning a duplicate server/process.
const gotInstanceLock = app.requestSingleInstanceLock();
if (!gotInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showMainWindow();
  });

  app.whenReady().then(async () => {
    registerIpcHandlers();

    if (!isDev) {
      const serverDir = join(getRepoRoot(), "server");
      serverProc = spawn(getBunCommand(), ["run", join(serverDir, "server.js"), `--port=${apiPort}`], {
        cwd: serverDir,
        stdio: "inherit",
      });

      await waitForUrl(healthUrl);
    }

    setupTray();
    await createWindow();
  });
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  else showMainWindow();
});

// Close-to-tray means the window can be hidden ("closed") without quitting, so
// we no longer quit here — the app lives in the tray until explicitly quit.
// macOS already keeps the app alive on window close by convention.
app.on("window-all-closed", () => {
  // intentionally no-op: quit happens via the tray menu / before-quit
});

// Mark a real quit so the window's close handler stops hiding-to-tray.
app.on("before-quit", () => {
  isQuitting = true;
});

app.on("quit", () => {
  serverProc?.kill("SIGTERM");
  tray?.destroy();
  tray = null;
});
