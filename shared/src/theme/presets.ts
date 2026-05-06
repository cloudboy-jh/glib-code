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
  },
  "rose-pine": {
    background: "249 22% 12%",
    foreground: "245 50% 91%",
    card: "247 23% 15%",
    cardForeground: "245 50% 91%",
    border: "249 15% 28%",
    input: "249 15% 28%",
    ring: "2 55% 83%",
    primary: "2 55% 83%",
    primaryForeground: "249 22% 12%",
    muted: "248 18% 19%",
    mutedForeground: "248 20% 68%"
  },
  "rose-pine-moon": {
    background: "246 24% 17%",
    foreground: "245 50% 91%",
    card: "247 23% 20%",
    cardForeground: "245 50% 91%",
    border: "248 15% 33%",
    input: "248 15% 33%",
    ring: "35 88% 72%",
    primary: "35 88% 72%",
    primaryForeground: "246 24% 17%",
    muted: "247 18% 24%",
    mutedForeground: "248 20% 72%"
  },
  dracula: {
    background: "231 15% 12%",
    foreground: "60 30% 96%",
    card: "232 14% 16%",
    cardForeground: "60 30% 96%",
    border: "232 14% 28%",
    input: "232 14% 28%",
    ring: "326 100% 74%",
    primary: "326 100% 74%",
    primaryForeground: "231 15% 12%",
    muted: "232 14% 21%",
    mutedForeground: "225 27% 78%"
  },
  "kanagawa-wave": {
    background: "240 21% 10%",
    foreground: "43 38% 81%",
    card: "230 20% 14%",
    cardForeground: "43 38% 81%",
    border: "225 15% 25%",
    input: "225 15% 25%",
    ring: "37 62% 67%",
    primary: "37 62% 67%",
    primaryForeground: "240 21% 10%",
    muted: "229 18% 18%",
    mutedForeground: "42 17% 65%"
  },
  "kanagawa-dragon": {
    background: "60 8% 8%",
    foreground: "42 22% 74%",
    card: "70 7% 11%",
    cardForeground: "42 22% 74%",
    border: "48 8% 22%",
    input: "48 8% 22%",
    ring: "80 24% 56%",
    primary: "80 24% 56%",
    primaryForeground: "60 8% 8%",
    muted: "55 7% 15%",
    mutedForeground: "45 12% 58%"
  },
  "everforest-dark": {
    background: "90 12% 10%",
    foreground: "45 35% 82%",
    card: "88 11% 14%",
    cardForeground: "45 35% 82%",
    border: "78 10% 25%",
    input: "78 10% 25%",
    ring: "68 36% 55%",
    primary: "68 36% 55%",
    primaryForeground: "90 12% 10%",
    muted: "85 10% 18%",
    mutedForeground: "49 17% 65%"
  },
  "solarized-dark": {
    background: "192 100% 8%",
    foreground: "44 87% 94%",
    card: "194 76% 11%",
    cardForeground: "44 87% 94%",
    border: "194 43% 22%",
    input: "194 43% 22%",
    ring: "45 100% 35%",
    primary: "45 100% 35%",
    primaryForeground: "192 100% 8%",
    muted: "193 62% 15%",
    mutedForeground: "186 8% 60%"
  },
  "github-dark": {
    background: "216 28% 7%",
    foreground: "210 17% 82%",
    card: "215 21% 11%",
    cardForeground: "210 17% 82%",
    border: "215 14% 25%",
    input: "215 14% 25%",
    ring: "212 92% 45%",
    primary: "212 92% 45%",
    primaryForeground: "210 40% 98%",
    muted: "215 17% 16%",
    mutedForeground: "217 10% 64%"
  },
  "ayu-dark": {
    background: "220 29% 7%",
    foreground: "39 54% 79%",
    card: "220 26% 10%",
    cardForeground: "39 54% 79%",
    border: "217 18% 22%",
    input: "217 18% 22%",
    ring: "35 100% 58%",
    primary: "35 100% 58%",
    primaryForeground: "220 29% 7%",
    muted: "219 22% 14%",
    mutedForeground: "40 21% 62%"
  },
  "one-dark": {
    background: "220 13% 13%",
    foreground: "220 14% 71%",
    card: "220 13% 17%",
    cardForeground: "220 14% 71%",
    border: "220 10% 28%",
    input: "220 10% 28%",
    ring: "207 82% 66%",
    primary: "207 82% 66%",
    primaryForeground: "220 13% 13%",
    muted: "220 11% 21%",
    mutedForeground: "220 9% 58%"
  },
  "monokai-pro": {
    background: "70 8% 15%",
    foreground: "60 30% 96%",
    card: "70 8% 18%",
    cardForeground: "60 30% 96%",
    border: "70 6% 29%",
    input: "70 6% 29%",
    ring: "53 92% 57%",
    primary: "53 92% 57%",
    primaryForeground: "70 8% 15%",
    muted: "70 7% 22%",
    mutedForeground: "60 12% 70%"
  },
  "oxocarbon-dark": {
    background: "240 10% 4%",
    foreground: "240 12% 90%",
    card: "240 8% 8%",
    cardForeground: "240 12% 90%",
    border: "240 6% 22%",
    input: "240 6% 22%",
    ring: "277 84% 79%",
    primary: "277 84% 79%",
    primaryForeground: "240 10% 4%",
    muted: "240 7% 13%",
    mutedForeground: "240 7% 64%"
  },
  "night-owl": {
    background: "222 68% 7%",
    foreground: "210 40% 88%",
    card: "222 55% 10%",
    cardForeground: "210 40% 88%",
    border: "220 40% 22%",
    input: "220 40% 22%",
    ring: "180 100% 45%",
    primary: "180 100% 45%",
    primaryForeground: "222 68% 7%",
    muted: "222 45% 14%",
    mutedForeground: "210 24% 68%"
  },
  "material-palenight": {
    background: "230 24% 12%",
    foreground: "232 38% 86%",
    card: "230 21% 16%",
    cardForeground: "232 38% 86%",
    border: "231 16% 30%",
    input: "231 16% 30%",
    ring: "266 89% 78%",
    primary: "266 89% 78%",
    primaryForeground: "230 24% 12%",
    muted: "230 18% 20%",
    mutedForeground: "232 20% 67%"
  },
  "poimandres": {
    background: "220 54% 7%",
    foreground: "210 60% 88%",
    card: "220 45% 10%",
    cardForeground: "210 60% 88%",
    border: "220 25% 24%",
    input: "220 25% 24%",
    ring: "191 97% 77%",
    primary: "191 97% 77%",
    primaryForeground: "220 54% 7%",
    muted: "220 35% 14%",
    mutedForeground: "212 23% 68%"
  }
} as const satisfies Record<string, ThemeTokens>;

export type ThemePreset = keyof typeof THEME_PRESETS;
export const THEME_PRESET_IDS = Object.keys(THEME_PRESETS) as ThemePreset[];
