import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfigDir, ensureDir, ensureParent } from "../lib/paths";

export type ProjectEntry = {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: string;
};

export type Settings = {
  themePreset: string;
  timestampFormat: "24-hour" | "12-hour" | "locale";
  defaultModel: string;
  confirmDestroy: boolean;
  telemetryOptIn: boolean;
  opencodeBinaryPath: string;
  maxImageAttachmentMb: number;
};

const DEFAULT_SETTINGS: Settings = {
  themePreset: "tokyo-night",
  timestampFormat: "24-hour",
  defaultModel: "claude-opus-4.7",
  confirmDestroy: true,
  telemetryOptIn: false,
  opencodeBinaryPath: "",
  maxImageAttachmentMb: 10
};

const DEFAULT_KEYBINDINGS = {
  version: 1,
  rules: [
    { key: "d", command: "mode.diff" },
    { key: "s", command: "mode.session" },
    { key: "cmd+j", command: "terminal.toggle" },
    { key: "cmd+k", command: "palette.open" }
  ]
};

type Store = {
  currentProjectId: string | null;
  projectsById: Map<string, { id: string; name: string; path: string; branch: string; isGitRepo: true }>;
};

const store: Store = {
  currentProjectId: null,
  projectsById: new Map()
};

function cfg(name: string) {
  return join(getConfigDir(), name);
}

async function writeAtomic(path: string, value: unknown) {
  await ensureParent(path);
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await rename(tempPath, path);
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  if (!existsSync(path)) return fallback;
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function bootState() {
  await ensureDir(getConfigDir());
}

export async function getRecents() {
  const recents = await readJson<ProjectEntry[]>(cfg("recents.json"), []);
  return recents.sort((a, b) => +new Date(b.lastOpenedAt) - +new Date(a.lastOpenedAt));
}

export async function putRecent(entry: Omit<ProjectEntry, "lastOpenedAt">) {
  const recents = await getRecents();
  const now = new Date().toISOString();
  const next = [
    { ...entry, lastOpenedAt: now },
    ...recents.filter((r) => r.id !== entry.id)
  ].slice(0, 20);
  await writeAtomic(cfg("recents.json"), next);
  return next;
}

export async function removeRecent(id: string) {
  const recents = await getRecents();
  const next = recents.filter((r) => r.id !== id);
  await writeAtomic(cfg("recents.json"), next);
  if (store.currentProjectId === id) store.currentProjectId = null;
}

export async function getSettings() {
  const loaded = await readJson<Partial<Settings>>(cfg("settings.json"), {});
  return { ...DEFAULT_SETTINGS, ...loaded };
}

export async function patchSettings(partial: Partial<Settings>) {
  const merged = { ...(await getSettings()), ...partial };
  await writeAtomic(cfg("settings.json"), merged);
  return merged;
}

export async function resetSettings() {
  await writeAtomic(cfg("settings.json"), DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export async function getKeybindings() {
  return readJson(cfg("keybindings.json"), DEFAULT_KEYBINDINGS);
}

export async function setKeybindings(next: unknown) {
  await writeAtomic(cfg("keybindings.json"), next);
  return next;
}

export async function resetKeybindings() {
  await writeAtomic(cfg("keybindings.json"), DEFAULT_KEYBINDINGS);
  return DEFAULT_KEYBINDINGS;
}

export function setCurrentProject(id: string | null) {
  store.currentProjectId = id;
}

export function getCurrentProjectId() {
  return store.currentProjectId;
}

export function registerProject(project: { id: string; name: string; path: string; branch: string; isGitRepo: true }) {
  store.projectsById.set(project.id, project);
}

export function getProjectById(id: string) {
  return store.projectsById.get(id) ?? null;
}
