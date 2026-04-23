export type ThemeTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  border: string;
  input: string;
  ring: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  mutedForeground: string;
};

export const THEME_PRESETS = {
  "tokyo-night": {
    background: "222 47% 5%",
    foreground: "215 25% 91%",
    card: "223 36% 9%",
    cardForeground: "215 25% 91%",
    border: "216 21% 18%",
    input: "216 21% 18%",
    ring: "224 71% 62%",
    primary: "224 71% 62%",
    primaryForeground: "210 40% 98%",
    muted: "219 27% 14%",
    mutedForeground: "217 12% 65%"
  },
  "catppuccin-mocha": {
    background: "240 21% 10%",
    foreground: "226 64% 88%",
    card: "237 24% 13%",
    cardForeground: "226 64% 88%",
    border: "232 14% 26%",
    input: "232 14% 26%",
    ring: "267 84% 81%",
    primary: "267 84% 81%",
    primaryForeground: "240 21% 10%",
    muted: "235 17% 17%",
    mutedForeground: "227 27% 72%"
  },
  "gruvbox-dark": {
    background: "42 23% 10%",
    foreground: "42 45% 82%",
    card: "42 22% 14%",
    cardForeground: "42 45% 82%",
    border: "35 18% 24%",
    input: "35 18% 24%",
    ring: "40 88% 62%",
    primary: "40 88% 62%",
    primaryForeground: "42 23% 10%",
    muted: "39 18% 18%",
    mutedForeground: "40 22% 65%"
  },
  nord: {
    background: "220 27% 12%",
    foreground: "218 27% 88%",
    card: "220 25% 16%",
    cardForeground: "218 27% 88%",
    border: "218 16% 28%",
    input: "218 16% 28%",
    ring: "213 32% 62%",
    primary: "213 32% 62%",
    primaryForeground: "220 27% 12%",
    muted: "220 22% 19%",
    mutedForeground: "218 20% 66%"
  }
} as const satisfies Record<string, ThemeTokens>;

export type ThemePreset = keyof typeof THEME_PRESETS;
export const THEME_PRESET_IDS = Object.keys(THEME_PRESETS) as ThemePreset[];
