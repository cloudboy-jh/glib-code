import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureDir, getConfigDir } from "../lib/paths";
import { writeJsonAtomic } from "../lib/atomic-write";

export type Settings = {
  themePreset: string;
  timestampFormat: "24-hour" | "12-hour" | "locale";
  durableProvider: "local" | "github";
  ephemeralProvider: "local" | "cloudflare-artifacts";
  promoteStrategy: "commit" | "branch" | "pr" | "patch";
  confirmDestroy: boolean;
  telemetryOptIn: boolean;
  piBinaryPath: string;
  maxImageAttachmentMb: number;
  preferredEditor: string | null;
};

export type ProvidersState = {
  defaultProvider: string;
  defaultModel: string;
};

const DEFAULT_SETTINGS: Settings = {
  themePreset: "catppuccin-mocha",
  timestampFormat: "24-hour",
  durableProvider: "local",
  ephemeralProvider: "local",
  promoteStrategy: "commit",
  confirmDestroy: true,
  telemetryOptIn: false,
  piBinaryPath: "",
  maxImageAttachmentMb: 10,
  preferredEditor: null
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
  await writeJsonAtomic(path, value);
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
  return normalizeSettings({ ...DEFAULT_SETTINGS, ...loaded });
}

export async function patchSettings(partial: Partial<Settings>) {
  const merged = normalizeSettings({ ...(await getSettings()), ...partial });
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

const THEME_PRESETS = new Set([
  "tokyo-night", "catppuccin-mocha", "gruvbox-dark", "nord", "rose-pine", "rose-pine-moon", "dracula",
  "kanagawa-wave", "kanagawa-dragon", "everforest-dark", "solarized-dark", "github-dark", "ayu-dark", "one-dark",
  "monokai-pro", "oxocarbon-dark", "night-owl", "material-palenight", "poimandres", "github-light", "solarized-light",
  "catppuccin-latte", "ayu-mirage", "nightfox", "carbon", "synthwave", "matrix", "minimal-dark", "paper"
]);
const EDITORS = new Set(["vscode", "cursor", "zed", "obsidian"]);

function normalizeSettings(value: Settings): Settings {
  return {
    themePreset: THEME_PRESETS.has(value.themePreset) ? value.themePreset : DEFAULT_SETTINGS.themePreset,
    timestampFormat: ["24-hour", "12-hour", "locale"].includes(value.timestampFormat) ? value.timestampFormat : DEFAULT_SETTINGS.timestampFormat,
    durableProvider: value.durableProvider === "github" ? "github" : "local",
    ephemeralProvider: value.ephemeralProvider === "cloudflare-artifacts" ? "cloudflare-artifacts" : "local",
    promoteStrategy: value.promoteStrategy === "commit" ? "commit" : DEFAULT_SETTINGS.promoteStrategy,
    confirmDestroy: typeof value.confirmDestroy === "boolean" ? value.confirmDestroy : DEFAULT_SETTINGS.confirmDestroy,
    telemetryOptIn: typeof value.telemetryOptIn === "boolean" ? value.telemetryOptIn : DEFAULT_SETTINGS.telemetryOptIn,
    piBinaryPath: typeof value.piBinaryPath === "string" ? value.piBinaryPath : DEFAULT_SETTINGS.piBinaryPath,
    maxImageAttachmentMb: typeof value.maxImageAttachmentMb === "number" ? value.maxImageAttachmentMb : DEFAULT_SETTINGS.maxImageAttachmentMb,
    preferredEditor: value.preferredEditor && EDITORS.has(value.preferredEditor) ? value.preferredEditor : null
  };
}
