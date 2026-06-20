# Minimal Dark

Last updated: 2026-06-19

Preset id: `minimal-dark`. In-house glib theme. One of the two entries surfaced under the "In-House Glib Themes / Curated" header in `ThemePicker.vue` and `ThemeDialog.vue`, and one half of the left-sidebar quick-toggle pair (the other is `minimal-paper`).

## Identity

Neutral grayscale dark theme. Every token sits at `S% = 0` — no hue, no chroma. The palette is pure grayscale; structural contrast comes from lightness steps only. The intent is chrome that recedes: code and diffs are the content, the shell around them does not compete.

## Tokens

Defined in `shared/src/theme/presets.ts:16-28`. Twelve HSL triplets, each stored as a bare `H S% L%` string consumed by `hsl(var(--token))` in CSS. No `hsl()` wrapper, no alpha channel — alpha is added at use sites via `hsl(var(--token) / <alpha>)`.

| token                 | HSL          | role                                |
| --------------------- | ------------ | ----------------------------------- |
| `background`        | `0 0% 9%`    | app canvas                          |
| `foreground`        | `0 0% 95%`  | primary text                       |
| `card`              | `0 0% 12%`  | raised surfaces (diff shell, etc.) |
| `cardForeground`  | `0 0% 95%`  | text on cards                      |
| `border`           | `0 0% 25%`  | dividers, input outlines           |
| `input`             | `0 0% 25%`  | input backgrounds (matches border) |
| `ring`               | `0 0% 70%`  | focus ring                         |
| `primary`           | `0 0% 70%`  | accent / active state fill         |
| `primaryForeground` | `0 0% 9%`   | text on primary (inverted)         |
| `muted`              | `0 0% 15%`  | muted surface                      |
| `mutedForeground`  | `0 0% 65%`  | secondary text                    |

Lightness ladder: 9 → 12 → 15 → 25 → 65 → 70 → 95. Background through muted is the surface track; border through ring is the line track; foreground through primaryForeground is the text track. `primary`/`ring` share L=70%, so the accent reads as a bright gray rather than a hue — there is no "accent color" in this theme.

## Application

Same path as every other preset. `web/src/lib/theme.ts::applyTheme('minimal-dark')` reads the token map, writes all twelve as CSS custom properties on `document.documentElement.style`, sets `root.dataset.theme = 'minimal-dark'`, and persists to `localStorage` under `glib-theme-preset`.

CSS throughout the app consumes these via `hsl(var(--token))` and `hsl(var(--token) / <alpha>)`. No component reads the raw `H S% L%` strings directly; the only exceptions are the two theme pickers, which interpolate `hsl(${THEME_PRESETS['minimal-dark'].background})` for swatch previews.

## Diff overrides

`web/src/lib/diffThemes.ts:6-22` defines the `--diffs-*` family for this preset. Standard dark-palette pattern:

- Addition accent: `hsl(142 55% 42%)` — a mid-saturation green, layered over `hsl(var(--muted) / <alpha>)` at 0.09 / 0.14 / 0.17 / 0.23 for bg / number / hover / emphasis.
- Deletion accent: `hsl(0 65% 52%)` — a mid-saturation red, same ladder at 0.14 / 0.22 / 0.22 / 0.28.
- Number fg: `hsl(var(--muted-foreground) / 0.9)`. Hover/context/separator all derive from `hsl(var(--muted) / 0.2..0.35)`.

This entry does not set the raw-hex `--diffs-addition-color-override` / `--diffs-deletion-color-override` (only `minimal-paper` does).

## Highlighter pairing

No special-case. `web/src/components/shared/DiffView.vue:81` returns the default pair `{dark: 'pierre-dark', light: 'pierre-light'}` for this preset. Shiki uses the `dark` half when `themeType === 'dark'` is passed from the caller.

## UI surfacing

- **Settings → Theme preset** (`ThemePicker.vue`): rendered in the `inHouseThemes` group at the top, with the "In-House Glib Themes / Curated" label. Two swatches per row: `background` and `primary`.
- **Theme dialog** (`ThemeDialog.vue`): same grouping, four swatches per row (`background`, `foreground`, `primary`, `border`). Searchable by "minimal-dark" or "Minimal Dark".
- **Left sidebar quick-toggle** (`LeftSidebar.vue:160-185`): only visible when `isMinimalTheme` is true. When the current theme is `minimal-dark`, the toggle shows a `Moon` icon and emits `toggleMinimalTheme` on click, flipping to `minimal-paper`. The toggle is hidden when the active preset is anything other than `minimal-dark` or `minimal-paper`.

## Server-side validation

`server/src/services/settings-store.ts:124-130` includes `minimal-dark` in the allowed `THEME_PRESETS` set. `normalizeSettings` will accept and persist it; any unknown id is silently reset to the default. The default on the server side is whatever `DEFAULT_SETTINGS.themePreset` is — not necessarily an in-house theme.

## Gotchas

- `getStoredTheme()` in `web/src/lib/theme.ts` returns `catppuccin-mocha` on a storage miss, not `minimal-dark`. The in-house themes are opt-in, not the app default.
- `minimal-dark` is not the dark-theme fallback for diffs. That role is held by `catppuccin-mocha` (`DIFF_THEME_VARS_DARK_FALLBACK`, `diffThemes.ts:116`). A dark preset without an explicit diff entry inherits mocha's overrides, not minimal-dark's.
