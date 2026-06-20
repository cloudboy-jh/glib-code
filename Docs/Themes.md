# In-House Themes: Minimal Dark & Minimal Paper

Last updated: 2026-06-19

## Scope

glib ships ~30 theme presets, most of them third-party palettes (catppuccin, gruvbox, tokyo-night, etc.). Two are in-house and curated: `minimal-dark` and `minimal-paper`. They are the only presets surfaced under the "In-House Glib Themes" header in `ThemePicker.vue` and `ThemeDialog.vue`, and the only presets reachable from the left sidebar's one-tap toggle.

This doc covers what those two themes are, where their tokens live, how they get applied, and the special-cased diff/highlighter behavior for `minimal-paper`.

## The two presets

Both are defined in `shared/src/theme/presets.ts` as entries in the `THEME_PRESETS` map. Each entry is a `ThemeTokens` object — twelve HSL triplets (no `hsl()` wrapper, no `/` alpha; just `H S% L%` strings consumed by `hsl(var(--token))` in CSS).

### `minimal-dark`

A neutral, low-chroma dark theme. No accent hue. All tokens sit at `S% = 0` so the palette is pure grayscale; the only structural contrast comes from lightness steps.

| token                 | HSL            | role                                |
| --------------------- | -------------- | ----------------------------------- |
| `background`         | `0 0% 9%`      | app canvas                          |
| `foreground`         | `0 0% 95%`     | primary text                        |
| `card`               | `0 0% 12%`     | raised surfaces (diff shell, etc.)  |
| `cardForeground`    | `0 0% 95%`     | text on cards                       |
| `border`             | `0 0% 25%`     | dividers, input outlines            |
| `input`              | `0 0% 25%`     | input backgrounds (matches border) |
| `ring`                | `0 0% 70%`     | focus ring                          |
| `primary`             | `0 0% 70%`     | accent / active state fill          |
| `primaryForeground` | `0 0% 9%`      | text on primary (inverted)          |
| `muted`               | `0 0% 15%`     | muted surface                       |
| `mutedForeground`   | `0 0% 65%`     | secondary text                      |

Intention: stay out of the way. Code and diffs are the content; chrome recedes.

### `minimal-paper`

A warm, low-chroma light theme built on a paper base. Foreground is near-black with a slight warming (`0 3% 6%`); background sits at `51 33% 92%` — a creamy paper tone rather than pure white. Card is brighter than background (`48 100% 97%`), so raised surfaces feel like a lighter sheet laid on the page.

| token                 | HSL             | role                          |
| --------------------- | -------------- | ----------------------------- |
| `background`         | `51 33% 92%`    | paper canvas                 |
| `foreground`         | `0 3% 6%`       | near-black, slightly warm ink |
| `card`               | `48 100% 97%`   | raised card (near-white)     |
| `cardForeground`    | `0 3% 6%`       | ink on cards                 |
| `border`             | `55 10% 79%`    | warm gray dividers           |
| `input`              | `55 10% 79%`    | matches border               |
| `ring`                | `0 3% 6%`       | focus ring = ink color       |
| `primary`             | `0 3% 6%`       | accent = ink (no chroma)     |
| `primaryForeground` | `48 100% 97%`   | text on primary (inverted)   |
| `muted`               | `51 21% 88%`    | muted paper surface          |
| `mutedForeground`   | `45 2% 33%`     | dark-warm secondary text     |

Intention: a writing-paper feel — readable for long sessions, avoids the flat #FFFFFF glare of `github-light`.

The two presets form a matched pair: toggle the sidebar icon and you flip between them. No other preset is reachable from that shortcut.

## Application path

`web/src/lib/theme.ts::applyTheme(preset)` is the only entry point. It reads `THEME_PRESETS[preset]` and writes each of the twelve tokens to `document.documentElement.style` as CSS custom properties (`--background`, `--foreground`, … `--muted-foreground`). It also sets `root.dataset.theme = preset` and persists to `localStorage` under `glib-theme-preset`.

CSS throughout the app consumes these via `hsl(var(--token))` and `hsl(var(--token) / <alpha>)`. No component reads the raw HSL strings directly except the two theme pickers, which render small color swatches by interpolating into `hsl(${THEME_PRESETS[id].background})` inline.

Callers of `applyTheme`:

- `App.vue:1654` — on settings load from server
- `App.vue:1680` — after `setTheme` from picker/dialog
- `App.vue:1718` — restoring original after a cycle preview
- `App.vue:3114` — watcher on `settings.themePreset`

`getStoredTheme()` returns `catppuccin-mocha` as the storage-miss default, not an in-house theme. In-house themes are not the app default.

## UI surfacing

### Settings → Theme preset (`ThemePicker.vue`)

The picker is a flat list with a section break. `IN_HOUSE_THEMES = ['minimal-dark', 'minimal-paper']` filters `THEME_PRESET_IDS` into `inHouseThemes` (rendered first under a "In-House Glib Themes / Curated" label) and `otherThemes` (everything else, rendered below a divider). Each row shows the pretty-printed name ("Minimal Dark", "Minimal Paper") and two swatches: `background` and `primary`.

### Theme dialog (`ThemeDialog.vue`)

Same in-house-first layout, four swatches per row (`background`, `foreground`, `primary`, `border`), plus a search input that filters by id or pretty name. Reachable from the toolbar; emits `update:modelValue` back into `App.vue`'s `setTheme`.

### Left sidebar quick-toggle (`LeftSidebar.vue:160-185`)

Only shown when `isMinimalTheme` is true (`themePreset === 'minimal-dark' || 'minimal-paper'`). The button is a small icon-only strip at the bottom of the sidebar:

- If current is `minimal-dark` → icon is `Moon`, title/aria "Switch to Minimal Paper".
- If current is `minimal-paper` → icon is `Sun`, title/aria "Switch to Minimal Dark".
- Emits `toggleMinimalTheme`, handled in `App.vue:1686` as a hard flip between the two: `next = current === 'minimal-dark' ? 'minimal-paper' : 'minimal-dark'`.

For any other preset, the toggle is hidden — you only see it once you've already picked an in-house theme. Switching to a non-minimal preset from the picker hides the toggle again.

## Diff theming

Diffs use `@pierre/diffs`'s `FileDiff`, which reads CSS custom properties off the diff shell. `web/src/lib/diffThemes.ts` exports `DIFF_THEME_VARS_BY_PRESET` — per-preset overrides for the `--diffs-*` family. Both in-house themes have explicit entries.

### `minimal-dark` diff overrides

Standard dark-pattern overrides: numbers and hunk emphasis use `hsl(142 55% 42%)` (green-600-ish) for additions and `hsl(0 65% 52%)` for deletions, all layered over `hsl(var(--muted) / <alpha>)` for hover/context/separator states. Opacity steps are the standard 0.09 / 0.14 / 0.17 / 0.23 ladder used by most dark presets in the map.

### `minimal-paper` diff overrides

Light-theme overrides. Comment in file notes the source: "Flexoki 600 add/del colors".

- Addition color: `#66800B` → `hsl(73 84% 27%)` (Flexoki green-600, an olive).
- Deletion color: `#AF3029` → `hsl(3 62% 42%)` (Flexoki red-600, a brick).
- Hover/context/separator overrides use higher alphas than the dark entry (`0.55` / `0.35` / `0.6`), because `--muted` on a light background needs more ink to read as a visible band.
- Inline `--diffs-addition-color-override` and `--diffs-deletion-color-override` are set to the raw hex (`#66800B`, `#AF3029`) — these are consumed directly by `@pierre/diffs` for the per-line addition/deletion accent, bypassing the HSL pipeline.

`minimal-paper` is also the global light-theme fallback: `DIFF_THEME_VARS_LIGHT_FALLBACK = DIFF_THEME_VARS_BY_PRESET['minimal-paper']!` (`diffThemes.ts:117`). Any light preset without an explicit entry inherits `minimal-paper`'s overrides via `getDiffThemeVars(preset, 'light')`.

### Highlighter pairing (`DiffView.vue:77-82`)

`FileDiff` is given a Shiki theme pair `{dark, light}`. Default for every preset: `{dark: 'pierre-dark', light: 'pierre-light'}` (from `@pierre/theme`).

`minimal-paper` is the only preset that breaks this: it returns `{dark: 'pierre-dark', light: 'github-light'}` (`DiffView.vue:78-80`). Reason: `pierre-light` is a warm, low-contrast light theme whose token colors wash out against `minimal-paper`'s paper background; `github-light` is a higher-contrast light syntax theme that reads cleanly on the warm cream canvas. This is a one-off branch — no other preset has a special-cased highlighter pair.

`themeType` (`'dark' | 'light'`) is passed in from the parent and selects which half of the pair Shiki uses; it is *not* derived from the preset name. Callers (SessionDiffOverlay, Timeline, DiffWorkbench) are responsible for picking `'light'` when `themePreset === 'minimal-paper'` (or any other light preset).

## Server-side validation

`server/src/services/settings-store.ts:124-130` keeps a `THEME_PRESETS` set of allowed ids. Both in-house ids are in it. `normalizeSettings` coerces any unknown `themePreset` back to `DEFAULT_SETTINGS.themePreset` — so a client sending `themePreset: 'minimal-dark'` persists, but a client sending `'made-up'` is silently reset. The default on the server side is whatever `DEFAULT_SETTINGS.themePreset` is (see top of `settings-store.ts`), not necessarily an in-house theme.

## Source map

| concern                       | file                                                   |
| ----------------------------- | ------------------------------------------------------ |
| Token definitions           | `shared/src/theme/presets.ts` (lines 16-41)         |
| Type + id export             | `shared/src/theme/presets.ts:408-409`               |
| CSS var application           | `web/src/lib/theme.ts`                              |
| Diff var overrides          | `web/src/lib/diffThemes.ts` (lines 6-44)            |
| Light fallback assignment  | `web/src/lib/diffThemes.ts:117`                   |
| Shiki highlighter branch    | `web/src/components/shared/DiffView.vue:77-82`     |
| Settings picker grouping   | `web/src/components/settings/ThemePicker.vue:66`   |
| Dialog grouping               | `web/src/components/picker/ThemeDialog.vue:81`      |
| Sidebar quick-toggle         | `web/src/components/session/LeftSidebar.vue:160-185`, `214` |
| Toggle handler              | `web/src/App.vue:1686-1687`                          |
| Apply-theme callers        | `web/src/App.vue:1654`, `1680`, `1718`, `3114`     |
| Allowed-id whitelist       | `server/src/services/settings-store.ts:124-130`    |
