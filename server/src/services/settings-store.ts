import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir, ensureParent, getConfigDir } from "../lib/paths";

export type Settings = {
  themePreset: string;
  timestampFormat: "24-hour" | "12-hour" | "locale";
  defaultProvider: string;
  defaultModel: string;
  durableProvider: "local" | "github";
  ephemeralProvider: "local" | "cloudflare-artifacts";
  promoteStrategy: "commit" | "branch" | "pr" | "patch";
  confirmDestroy: boolean;
  telemetryOptIn: boolean;
  piBinaryPath: string;
  maxImageAttachmentMb: number;
};

export type ProvidersState = {
  defaultProvider: string;
  defaultModel: string;
};

const DEFAULT_SETTINGS: Settings = {
  themePreset: "catppuccin-mocha",
  timestampFormat: "24-hour",
  defaultProvider: "codex",
  defaultModel: "claude-opus-4.7",
  durableProvider: "local",
  ephemeralProvider: "local",
  promoteStrategy: "commit",
  confirmDestroy: true,
  telemetryOptIn: false,
  piBinaryPath: "",
  maxImageAttachmentMb: 10
};

const DEFAULT_PROVIDERS_STATE: ProvidersState = {
  defaultProvider: "codex",
  defaultModel: "gpt-5-codex"
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

export async function bootSettingsStore() {
  await ensureDir(getConfigDir());
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

export async function getProvidersState() {
  const loaded = await readJson<Partial<ProvidersState>>(cfg("providers.json"), {});
  return {
    defaultProvider: loaded.defaultProvider ?? DEFAULT_PROVIDERS_STATE.defaultProvider,
    defaultModel: loaded.defaultModel ?? DEFAULT_PROVIDERS_STATE.defaultModel
  } satisfies ProvidersState;
}

export async function patchProviderDefaults(partial: { defaultProvider?: string; defaultModel?: string }) {
  const current = await getProvidersState();
  const next: ProvidersState = {
    ...current,
    defaultProvider: partial.defaultProvider ?? current.defaultProvider,
    defaultModel: partial.defaultModel ?? current.defaultModel
  };
  await writeAtomic(cfg("providers.json"), next);
  return next;
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
