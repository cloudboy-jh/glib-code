import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import os from "node:os";

export function getConfigDir() {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) throw new Error("APPDATA not set");
    return join(appData, "glib-code");
  }

  if (process.platform === "darwin") {
    return join(os.homedir(), "Library", "Application Support", "glib-code");
  }

  const xdg = process.env.XDG_CONFIG_HOME;
  return xdg ? join(xdg, "glib-code") : join(os.homedir(), ".config", "glib-code");
}

export function repoGlibDir(repoPath: string) {
  return join(repoPath, ".glib");
}

export async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

export async function ensureParent(path: string) {
  await ensureDir(dirname(path));
}

export async function ensureRepoGlibIgnore(repoPath: string) {
  const glibDir = repoGlibDir(repoPath);
  await ensureDir(glibDir);
  const path = join(glibDir, ".gitignore");
  if (!existsSync(path)) {
    await writeFile(path, "*\n", "utf8");
  }
}

export function inRepo(root: string, candidate: string) {
  const rootResolved = resolve(root);
  const candidateResolved = resolve(candidate);
  return candidateResolved === rootResolved || candidateResolved.startsWith(`${rootResolved}${process.platform === "win32" ? "\\" : "/"}`);
}
