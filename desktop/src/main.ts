import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { autoUpdater, type UpdateInfo, type ProgressInfo, type UpdateDownloadedEvent } from "electron-updater";
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
  } catch {
    return false;
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
  // Don't run updater in dev or when there's no publish config
  if (isDev) return;

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

  win.once("ready-to-show", () => {
    win.show();
  });

  if (isDev) {
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

app.whenReady().then(async () => {
  registerIpcHandlers();

  if (!isDev) {
    serverProc = spawn(getBunCommand(), ["server/src/index.ts", `--port=${apiPort}`], {
      cwd: getRepoRoot(),
      stdio: "inherit",
    });

    await waitForUrl(healthUrl);
  }

  await createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => {
  serverProc?.kill("SIGTERM");
});
