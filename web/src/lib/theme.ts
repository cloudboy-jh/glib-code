import { THEME_PRESETS, THEME_PRESET_IDS, type ThemePreset } from "@glib-code/shared/theme/presets";

const STORAGE_KEY = "glib-theme-preset";

export function getStoredTheme(): ThemePreset {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw && THEME_PRESET_IDS.includes(raw as ThemePreset)) {
    return raw as ThemePreset;
  }
  return "catppuccin-mocha";
}

export function applyTheme(theme: ThemePreset) {
  const tokens = THEME_PRESETS[theme];
  const root = document.documentElement;

  root.dataset.theme = theme;

  // Light vs dark, inferred from background lightness (matches diffThemeType).
  // Drives provider-icon inversion so the lobehub (dark-on-transparent) SVGs
  // stay legible on light presets like minimal-paper instead of forcing white.
  const lightness = Number(tokens.background.split(" ")[2]?.replace("%", "") ?? "0");
  const isLight = lightness > 50;
  root.style.setProperty("--icon-invert", isLight ? "0" : "1");

  root.style.setProperty("--background", tokens.background);
  root.style.setProperty("--foreground", tokens.foreground);
  root.style.setProperty("--card", tokens.card);
  root.style.setProperty("--card-foreground", tokens.cardForeground);
  root.style.setProperty("--border", tokens.border);
  root.style.setProperty("--input", tokens.input);
  root.style.setProperty("--ring", tokens.ring);
  root.style.setProperty("--primary", tokens.primary);
  root.style.setProperty("--primary-foreground", tokens.primaryForeground);
  root.style.setProperty("--muted", tokens.muted);
  root.style.setProperty("--muted-foreground", tokens.mutedForeground);

  localStorage.setItem(STORAGE_KEY, theme);
}
