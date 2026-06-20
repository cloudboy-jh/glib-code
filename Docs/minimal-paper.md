# Minimal Paper

Last updated: 2026-06-19

Preset id: `minimal-paper`. In-house glib theme. One of the two entries surfaced under the "In-House Glib Themes / Curated" header in `ThemePicker.vue` and `ThemeDialog.vue`, and one half of the left-sidebar quick-toggle pair (the other is `minimal-dark`).

## Identity

Warm, low-chroma light theme built on a paper base. Foreground is near-black with a slight warming (`0 3% 6%`) — an ink tone, not pure black. Background sits at `51 33% 92%` — a creamy paper rather than `#FFFFFF`. Card is brighter than background (`48 100% 97%`), so raised surfaces read as a lighter sheet laid on the page. Intent: writing-paper feel, readable for long sessions, avoiding the flat #FFFFFF glare of `github-light`.

## Tokens

Defined in `shared/src/theme/presets.ts:29-41`. Twelve HSL triplets, stored as bare `H S% L%` strings consumed by `hsl(var(--token))` in CSS.

| token                 | HSL            | role                          |
| --------------------- | -------------- | ----------------------------- |
| `background`         | `51 33% 92%`    | paper canvas                 |
| `foreground`          | `0 3% 6%`       | near-black, slightly warm ink |
| `card`                | `48 100% 97%`   | raised card (near-white)     |
| `cardForeground`     | `0 3% 6%`       | ink on cards                 |
| `border`              | `55 10% 79%`    | warm gray dividers            |
| `input`               | `55 10% 79%`    | matches border               |
| `ring`                | `0 3% 6%`       | focus ring = ink color        |
| `primary`             | `0 3% 6%`       | accent = ink (no chroma)     |
| `primaryForeground`  | `48 100% 97%`   | text on primary (inverted)    |
| `muted`               | `51 21% 88%`    | muted paper surface           |
| `mutedForeground`    | `45 2% 33%`     | dark-warm secondary text      |

The background's `H=51, S=33` is the only meaningful chroma in the palette — everywhere else saturation is ≤21% or pure grayscale. The warm hue comes from the canvas alone; everything layered on top is ink-toned to keep contrast legible without competing with the paper warmth.

`ring` and `primary` are both `0 3% 6%` (the ink color). The theme has no accent hue: focus rings and primary fills are both just ink. `primaryForeground` inverts to near-white, matching `card` rather than `background` — so a primary-filled button reads as ink-on-paper, not ink-on-canvas.

## Application

Same path as every other preset. `web/src/lib/theme.ts::applyTheme('minimal-paper')` writes all twelve tokens as CSS custom properties on `document.documentElement.style`, sets `root.dataset.theme = 'minimal-paper'`, and persists to `localStorage` under `glib-theme-preset`.

CSS consumes these via `hsl(var(--token))` and `hsl(var(--token) / <alpha>)`. Light-theme components that need darker overlays (RecentList, PickerScreen, SettingsModal) pass lower alphas against `--background` because `--background` is already a mid-lightness cream — full-alpha `hsl(var(--background) / 1)` would erase the surface they're meant to tint.

## Diff overrides

`web/src/lib/diffThemes.ts:23-44` defines the `--diffs-*` family for this preset. Source comment in file: "Light theme — higher opacity needed; Flexoki 600 add/del colors".

### Flexoki pair

- Addition: `#66800B` → `hsl(73 84% 27%)` (Flexoki green-600, an olive).
- Deletion: `#AF3029` → `hsl(3 62% 42%)` (Flexoki red-600, a brick).

These are deliberately not the saturated green/red used by the dark presets. On a warm cream canvas, a saturated #22c55e / #ef4444 pair would bleach and clash; the muted olive/brick keep the paper tone coherent and stay legible at the opacities the diff ladders use.

### Raw-hex overrides

This preset sets `--diffs-addition-color-override: '#66800B'` and `--diffs-deletion-color-override: '#AF3029'` directly (`diffThemes.ts:29, 31`). These are consumed by `@pierre/diffs` for the per-line addition/deletion accent and bypass the HSL pipeline. `minimal-paper` is the only preset in the map that sets these two properties. Every other entry, including `minimal-dark`, drives accents purely through the HSL `--diffs-fg-number-*-override` / `--diffs-bg-*-override` family.

### Opacity ladder

Hover/context/separator overrides use higher alphas than the dark entries: `0.55` / `0.35` / `0.6` vs. the dark pattern's `0.35` / `0.2` / `0.35`. Reason: `--muted` on a light background needs more ink to read as a visible band; the dark-preset alphas would be invisible against the cream canvas.

Addition/deletion bg ladders (over Flexoki hues):
- Addition: 0.10 / 0.16 / 0.20 / 0.28 (bg / number / hover / emphasis).
- Deletion: 0.10 / 0.18 / 0.18 / 0.26.

## Global light-theme fallback

`minimal-paper` is the canonical light-theme diff fallback. `DIFF_THEME_VARS_LIGHT_FALLBACK = DIFF_THEME_VARS_BY_PRESET['minimal-paper']!` (`diffThemes.ts:117`). `getDiffThemeVars(preset, 'light')` returns `minimal-paper`'s overrides for any light preset that has no explicit entry — `github-light`, `solarized-light`, `catppuccin-latte`, `paper`, etc. all inherit the Flexoki pair and the raw-hex overrides when used in a diff view.

This is one-way: `minimal-paper` does not inherit from any other preset. It is the source for the light fallback, not a consumer of it.

## Highlighter pairing

The only preset with a special-cased Shiki pair. `web/src/components/shared/DiffView.vue:78-80`:

```ts
if (props.themePreset === 'minimal-paper') {
  return { dark: 'pierre-dark', light: 'github-light' };
}
return { dark: 'pierre-dark', light: 'pierre-light' };
```

Every other preset gets `{dark: 'pierre-dark', light: 'pierre-light'}` (the default `@pierre/theme` pair). `minimal-paper` swaps the light half to `github-light`.

Reason: `pierre-light` is a warm, low-contrast light theme whose token colors wash out against `minimal-paper`'s paper background — its lightness curve was tuned for a near-white canvas, not a cream one. `github-light` is a higher-contrast light syntax theme whose token colors read cleanly on the warm cream. No other preset triggers this branch.

`themeType` (`'dark' | 'light'`) is passed in from the parent (SessionDiffOverlay, Timeline, DiffWorkbench) and selects which half of the pair Shiki uses. It is not derived from the preset name — a caller can pass `themeType: 'dark'` with `themePreset: 'minimal-paper'`, in which case Shiki uses `pierre-dark`. The branch only controls which pair is offered; the parent still chooses the half.

## UI surfacing

- **Settings → Theme preset** (`ThemePicker.vue`): rendered in the `inHouseThemes` group at the top, with the "In-House Glib Themes / Curated" label. Two swatches per row: `background` and `primary`.
- **Theme dialog** (`ThemeDialog.vue`): same grouping, four swatches per row (`background`, `foreground`, `primary`, `border`). Searchable by "minimal-paper" or "Minimal Paper".
- **Left sidebar quick-toggle** (`LeftSidebar.vue:160-185`): only visible when `isMinimalTheme` is true. When the current theme is `minimal-paper`, the toggle shows a `Sun` icon and emits `toggleMinimalTheme` on click, flipping to `minimal-dark`. The toggle is hidden when the active preset is anything other than `minimal-dark` or `minimal-paper`.

## Server-side validation

`server/src/services/settings-store.ts:124-130` includes `minimal-paper` in the allowed `THEME_PRESETS` set. `normalizeSettings` will accept and persist it; any unknown id is silently reset to the default.

## Gotchas

- `getStoredTheme()` in `web/src/lib/theme.ts` returns `catppuccin-mocha` on a storage miss, not `minimal-paper`. The in-house themes are opt-in, not the app default.
- `themeType` is caller-controlled, not preset-derived. A caller passing `themeType: 'dark'` to a `DiffView` with `themePreset: 'minimal-paper'` will render with the `pierre-dark` Shiki half — not the `github-light` swap. The swap only kicks in when the caller also selects `'light'`.
- The raw-hex `--diffs-addition-color-override` / `--diffs-deletion-color-override` are not part of the HSL token system; they bypass `hsl(var(--token))` entirely and are read by `@pierre/diffs` as literal CSS colors. If you retune the Flexoki hues, update both the hex and the HSL derivation comments in `diffThemes.ts` — they are paired in the file but not paired in code.
