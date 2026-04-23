import { app, BrowserWindow } from "electron";
import { spawn } from "node:child_process";

let serverProc: ReturnType<typeof spawn> | null = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      sandbox: true
    }
  });

  win.loadURL("http://127.0.0.1:4173");
}

app.whenReady().then(() => {
  serverProc = spawn("bun", ["server/src/index.ts", "--port=4173"], {
    cwd: process.cwd(),
    stdio: "inherit"
  });

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("quit", () => {
  serverProc?.kill("SIGTERM");
});
