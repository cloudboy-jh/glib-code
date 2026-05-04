import { app, BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

let serverProc: ReturnType<typeof spawn> | null = null;
const isDev = process.env.GLIB_DESKTOP_DEV === "1";
const apiPort = 4273;
const devWebUrl = "http://127.0.0.1:5173";
const healthUrl = `http://127.0.0.1:${apiPort}/api/health`;

function getRepoRoot() {
  return resolve(app.getAppPath(), "..");
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

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[desktop] failed to load ${validatedURL}: ${errorCode} ${errorDescription}`);
  });

  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
  });

  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent("<!doctype html><html><body style='margin:0;background:#0b0f14;color:#d7dee8;font:14px system-ui;display:grid;place-items:center;height:100vh'>Starting glib-code...</body></html>")}`);

  if (isDev) {
    try {
      await waitForUrl(devWebUrl);
      await win.loadURL(devWebUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><body style='margin:0;background:#0b0f14;color:#f4d2d2;font:14px system-ui;padding:32px'><h1>glib-code desktop failed to start</h1><pre>${message}</pre><p>Check the dev terminal. Vite must be running on ${devWebUrl}.</p></body></html>`)}`);
    }
    return;
  }

  const webIndex = join(getRepoRoot(), "web", "dist", "index.html");
  if (!existsSync(webIndex)) {
    await win.loadURL(`data:text/plain;charset=utf-8,${encodeURIComponent("glib-code desktop needs a web build. Run `bun run build` first.")}`);
    return;
  }

  await win.loadFile(webIndex);
}

app.whenReady().then(async () => {
  if (!isDev) {
    serverProc = spawn(getBunCommand(), ["server/src/index.ts", `--port=${apiPort}`], {
      cwd: getRepoRoot(),
      stdio: "inherit"
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
