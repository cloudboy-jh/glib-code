import type { ThemePreset } from '@glib-code/shared/theme/presets';

export type DiffThemeVars = Record<string, string>;

export const DIFF_THEME_VARS_BY_PRESET: Partial<Record<ThemePreset, DiffThemeVars>> = {
  'minimal-dark': {
    '--diffs-bg-buffer-override': 'hsl(var(--background))',
    '--diffs-bg-hover-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-bg-context-override': 'hsl(var(--muted) / 0.2)',
    '--diffs-bg-separator-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-fg-number-override': 'hsl(var(--muted-foreground) / 0.9)',
    '--diffs-fg-number-addition-override': 'hsl(142 55% 58%)',
    '--diffs-fg-number-deletion-override': 'hsl(0 65% 60%)',
    '--diffs-bg-addition-override': 'hsl(142 55% 42% / 0.09)',
    '--diffs-bg-addition-number-override': 'hsl(142 55% 42% / 0.14)',
    '--diffs-bg-addition-hover-override': 'hsl(142 55% 42% / 0.17)',
    '--diffs-bg-addition-emphasis-override': 'hsl(142 55% 42% / 0.23)',
    '--diffs-bg-deletion-override': 'hsl(0 65% 52% / 0.14)',
    '--diffs-bg-deletion-number-override': 'hsl(0 65% 52% / 0.22)',
    '--diffs-bg-deletion-hover-override': 'hsl(0 65% 52% / 0.22)',
    '--diffs-bg-deletion-emphasis-override': 'hsl(0 65% 52% / 0.28)'
  },
  'minimal-paper': {
    // Light theme — higher opacity needed; Flexoki 600 add/del colors
    '--diffs-bg-buffer-override': 'hsl(var(--background))',
    '--diffs-bg-hover-override': 'hsl(var(--muted) / 0.55)',
    '--diffs-bg-context-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-bg-separator-override': 'hsl(var(--muted) / 0.6)',
    '--diffs-addition-color-override': '#66800B',
    '--diffs-deletion-color-override': '#AF3029',
    '--diffs-fg-number-override': 'hsl(var(--muted-foreground) / 0.85)',
    // Flexoki green-600 (#66800B) → 73 84% 27%
    '--diffs-fg-number-addition-override': 'hsl(73 84% 27%)',
    // Flexoki red-600 (#AF3029) → 3 62% 42%
    '--diffs-fg-number-deletion-override': 'hsl(3 62% 42%)',
    '--diffs-bg-addition-override': 'hsl(73 84% 27% / 0.10)',
    '--diffs-bg-addition-number-override': 'hsl(73 84% 27% / 0.16)',
    '--diffs-bg-addition-hover-override': 'hsl(73 84% 27% / 0.20)',
    '--diffs-bg-addition-emphasis-override': 'hsl(73 84% 27% / 0.28)',
    '--diffs-bg-deletion-override': 'hsl(3 62% 42% / 0.10)',
    '--diffs-bg-deletion-number-override': 'hsl(3 62% 42% / 0.18)',
    '--diffs-bg-deletion-hover-override': 'hsl(3 62% 42% / 0.18)',
    '--diffs-bg-deletion-emphasis-override': 'hsl(3 62% 42% / 0.26)'
  },
  'tokyo-night': {
    '--diffs-bg-buffer-override': 'hsl(var(--background))',
    '--diffs-bg-hover-override': 'hsl(var(--muted) / 0.34)',
    '--diffs-bg-context-override': 'hsl(var(--muted) / 0.2)',
    '--diffs-bg-separator-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-fg-number-override': 'hsl(var(--muted-foreground) / 0.9)',
    '--diffs-fg-number-addition-override': 'hsl(160 68% 60%)',
    '--diffs-fg-number-deletion-override': 'hsl(0 76% 63%)',
    '--diffs-bg-addition-override': 'hsl(160 72% 40% / 0.08)',
    '--diffs-bg-addition-number-override': 'hsl(160 72% 40% / 0.13)',
    '--diffs-bg-addition-hover-override': 'hsl(160 72% 40% / 0.16)',
    '--diffs-bg-addition-emphasis-override': 'hsl(160 72% 40% / 0.22)',
    '--diffs-bg-deletion-override': 'hsl(0 76% 56% / 0.14)',
    '--diffs-bg-deletion-number-override': 'hsl(0 76% 56% / 0.22)',
    '--diffs-bg-deletion-hover-override': 'hsl(0 76% 56% / 0.22)',
    '--diffs-bg-deletion-emphasis-override': 'hsl(0 76% 56% / 0.28)'
  },
  'catppuccin-mocha': {
    '--diffs-bg-buffer-override': 'hsl(var(--background))',
    '--diffs-bg-hover-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-bg-context-override': 'hsl(var(--muted) / 0.2)',
    '--diffs-bg-separator-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-fg-number-override': 'hsl(var(--muted-foreground) / 0.9)',
    '--diffs-fg-number-addition-override': 'hsl(142 70% 62%)',
    '--diffs-fg-number-deletion-override': 'hsl(0 78% 66%)',
    '--diffs-bg-addition-override': 'hsl(142 70% 48% / 0.08)',
    '--diffs-bg-addition-number-override': 'hsl(142 70% 48% / 0.13)',
    '--diffs-bg-addition-hover-override': 'hsl(142 70% 48% / 0.16)',
    '--diffs-bg-addition-emphasis-override': 'hsl(142 70% 48% / 0.22)',
    '--diffs-bg-deletion-override': 'hsl(0 78% 58% / 0.14)',
    '--diffs-bg-deletion-number-override': 'hsl(0 78% 58% / 0.22)',
    '--diffs-bg-deletion-hover-override': 'hsl(0 78% 58% / 0.22)',
    '--diffs-bg-deletion-emphasis-override': 'hsl(0 78% 58% / 0.28)'
  },
  'gruvbox-dark': {
    '--diffs-bg-buffer-override': 'hsl(var(--background))',
    '--diffs-bg-hover-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-bg-context-override': 'hsl(var(--muted) / 0.2)',
    '--diffs-bg-separator-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-fg-number-override': 'hsl(var(--muted-foreground) / 0.9)',
    '--diffs-fg-number-addition-override': 'hsl(93 52% 58%)',
    '--diffs-fg-number-deletion-override': 'hsl(4 62% 63%)',
    '--diffs-bg-addition-override': 'hsl(93 52% 44% / 0.09)',
    '--diffs-bg-addition-number-override': 'hsl(93 52% 44% / 0.14)',
    '--diffs-bg-addition-hover-override': 'hsl(93 52% 44% / 0.17)',
    '--diffs-bg-addition-emphasis-override': 'hsl(93 52% 44% / 0.23)',
    '--diffs-bg-deletion-override': 'hsl(4 62% 52% / 0.15)',
    '--diffs-bg-deletion-number-override': 'hsl(4 62% 52% / 0.24)',
    '--diffs-bg-deletion-hover-override': 'hsl(4 62% 52% / 0.23)',
    '--diffs-bg-deletion-emphasis-override': 'hsl(4 62% 52% / 0.3)'
  },
  nord: {
    '--diffs-bg-buffer-override': 'hsl(var(--background))',
    '--diffs-bg-hover-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-bg-context-override': 'hsl(var(--muted) / 0.2)',
    '--diffs-bg-separator-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-fg-number-override': 'hsl(var(--muted-foreground) / 0.9)',
    '--diffs-fg-number-addition-override': 'hsl(145 45% 67%)',
    '--diffs-fg-number-deletion-override': 'hsl(355 58% 70%)',
    '--diffs-bg-addition-override': 'hsl(145 45% 50% / 0.08)',
    '--diffs-bg-addition-number-override': 'hsl(145 45% 50% / 0.13)',
    '--diffs-bg-addition-hover-override': 'hsl(145 45% 50% / 0.16)',
    '--diffs-bg-addition-emphasis-override': 'hsl(145 45% 50% / 0.22)',
    '--diffs-bg-deletion-override': 'hsl(355 58% 58% / 0.14)',
    '--diffs-bg-deletion-number-override': 'hsl(355 58% 58% / 0.22)',
    '--diffs-bg-deletion-hover-override': 'hsl(355 58% 58% / 0.22)',
    '--diffs-bg-deletion-emphasis-override': 'hsl(355 58% 58% / 0.28)'
  }
};

// Fallbacks by theme polarity — used when a preset has no explicit entry
export const DIFF_THEME_VARS_DARK_FALLBACK = DIFF_THEME_VARS_BY_PRESET['catppuccin-mocha']!;
export const DIFF_THEME_VARS_LIGHT_FALLBACK = DIFF_THEME_VARS_BY_PRESET['minimal-paper']!;

export function getDiffThemeVars(preset: ThemePreset, themeType: 'dark' | 'light'): DiffThemeVars {
  return (
    DIFF_THEME_VARS_BY_PRESET[preset] ??
    (themeType === 'light' ? DIFF_THEME_VARS_LIGHT_FALLBACK : DIFF_THEME_VARS_DARK_FALLBACK)
  );
}
