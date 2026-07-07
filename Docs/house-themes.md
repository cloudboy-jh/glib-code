# glib-code House Themes: Minimal Dark & Minimal Light

Last updated: 2026-07-06

glib-code ships ~30 theme presets, but only two are in-house and curated: **Minimal Dark**
(`minimal-dark`) and **Minimal Light** (`minimal-paper`). They are the only presets grouped
under the "In-House Glib Themes / Curated" header in the theme picker and dialog, and the only
two reachable from the left-sidebar one-tap toggle.

> Note on naming: the light theme's preset id is `minimal-paper`, not `minimal-light`. The
> "light" half of the minimal pair *is* `minimal-paper` — a warm paper-toned light theme rather
> than a flat white one. Everywhere in this doc, "Minimal Light" refers to `minimal-paper`.

Both are a matched pair: tap the sidebar toggle and you flip straight between them.

---

## Philosophy

Both themes are low-chroma and deliberately quiet. The idea is that your code and diffs are the
content — the chrome around them should recede, not compete. Minimal Dark is pure grayscale;
Minimal Light carries a single warm hue in its canvas and keeps everything else ink-toned.

| | Minimal Dark | Minimal Light (`minimal-paper`) |
|---|---|---|
| Base | Neutral charcoal (`0 0% 9%`) | Warm cream paper (`51 33% 92%`) |
| Text | Near-white (`0 0% 95%`) | Warm near-black ink (`0 3% 6%`) |
| Accent hue | None (bright gray) | None (ink) |
| Feel | Chrome disappears in the dark | Writing-paper, easy on long sessions |
| Avoids | — | The flat `#FFFFFF` glare of `github-light` |

---

## Tokens

Each theme is a `ThemeTokens` object — twelve HSL triplets stored as bare `H S% L%` strings
(no `hsl()` wrapper, no alpha). CSS consumes them via `hsl(var(--token))`, and alpha is added at
use sites via `hsl(var(--token) / <alpha>)`. Both live in `shared/src/theme/presets.ts`.

### Minimal Dark (`minimal-dark`)

Every token sits at `S% = 0` — pure grayscale, no hue. All contrast comes from lightness steps.

| token | HSL | role |
|---|---|---|
| `background` | `0 0% 9%` | app canvas |
| `foreground` | `0 0% 95%` | primary text |
| `card` | `0 0% 12%` | raised surfaces (diff shell, etc.) |
| `cardForeground` | `0 0% 95%` | text on cards |
| `border` | `0 0% 25%` | dividers, input outlines |
| `input` | `0 0% 25%` | input backgrounds (matches border) |
| `ring` | `0 0% 70%` | focus ring |
| `primary` | `0 0% 70%` | accent / active state fill |
| `primaryForeground` | `0 0% 9%` | text on primary (inverted) |
| `muted` | `0 0% 15%` | muted surface |
| `mutedForeground` | `0 0% 65%` | secondary text |

Lightness ladder: `9 → 12 → 15 → 25 → 65 → 70 → 95`. Background→muted is the surface track,
border→ring is the line track, foreground→primaryForeground is the text track. `primary` and
`ring` share L=70%, so the accent reads as a bright gray — there is no accent *color*.

### Minimal Light (`minimal-paper`)

A warm, low-chroma light theme on a paper base. The only meaningful chroma in the whole palette
is the canvas hue (`H=51, S=33`); everything layered on top is ink-toned (`S ≤ 21%`).

| token | HSL | role |
|---|---|---|
| `background` | `51 33% 92%` | paper canvas |
| `foreground` | `0 3% 6%` | near-black, slightly warm ink |
| `card` | `48 100% 97%` | raised card (near-white) |
| `cardForeground` | `0 3% 6%` | ink on cards |
| `border` | `55 10% 79%` | warm gray dividers |
| `input` | `55 10% 79%` | matches border |
| `ring` | `0 3% 6%` | focus ring = ink color |
| `primary` | `0 3% 6%` | accent = ink (no chroma) |
| `primaryForeground` | `48 100% 97%` | text on primary (inverted) |
| `muted` | `51 21% 88%` | muted paper surface |
| `mutedForeground` | `45 2% 33%` | dark-warm secondary text |

`card` is *brighter* than `background`, so raised surfaces read as a lighter sheet laid on the
page. `primaryForeground` inverts to near-white matching `card` — a primary-filled button reads
as ink-on-paper. Like Minimal Dark, there is no accent hue: focus rings and primary fills are
both just ink.

---

## Using them

### Theme picker (Settings → Theme preset)
Both appear first, under the "In-House Glib Themes / Curated" label, above a divider that
separates them from the ~28 third-party presets. Each row shows the pretty name and two swatches
(`background`, `primary`).

### Theme dialog (toolbar)
Same in-house-first grouping, four swatches per row (`background`, `foreground`, `primary`,
`border`), plus a search box that filters by id or pretty name.

### Left-sidebar quick-toggle
Appears at the bottom of the left sidebar **only** when a minimal theme is already active:
- On Minimal Dark → shows a **Moon** icon, "Switch to Minimal Paper".
- On Minimal Light → shows a **Sun** icon, "Switch to Minimal Dark".

Pick any non-minimal preset and the toggle disappears until you return to a minimal theme.

---

## How a theme gets applied

`web/src/lib/theme.ts::applyTheme(preset)` is the single entry point. It reads
`THEME_PRESETS[preset]`, writes all twelve tokens as CSS custom properties on
`document.documentElement.style` (`--background` … `--muted-foreground`), sets
`root.dataset.theme = preset`, and persists to `localStorage` under `glib-theme-preset`.

Nothing reads the raw HSL strings directly except the two pickers, which interpolate
`hsl(${THEME_PRESETS[id].background})` for swatch previews.

> Storage-miss default is `catppuccin-mocha`, **not** an in-house theme. The minimal themes are
> opt-in, not the app default.

---

## Diff behavior

Diffs (`@pierre/diffs`) read a `--diffs-*` CSS variable family; per-preset overrides live in
`web/src/lib/diffThemes.ts`. Both minimal themes have explicit entries.

- **Minimal Dark**: standard dark pattern — additions `hsl(142 55% 42%)` (green), deletions
  `hsl(0 65% 52%)` (red), layered over `hsl(var(--muted) / <alpha>)` on the usual
  `0.09 / 0.14 / 0.17 / 0.23` ladder. Does *not* set raw-hex overrides.
- **Minimal Light**: uses the muted **Flexoki 600** pair instead of saturated green/red, which
  would bleach against cream — additions `#66800B` → `hsl(73 84% 27%)` (olive), deletions
  `#AF3029` → `hsl(3 62% 42%)` (brick). It also sets the raw-hex
  `--diffs-addition-color-override` / `--diffs-deletion-color-override` directly (the only preset
  that does), and uses higher hover/context/separator alphas (`0.55 / 0.35 / 0.6`) because
  `--muted` needs more ink to read as a visible band on a light canvas.

`minimal-paper` is also the **global light-theme diff fallback**: any light preset without its
own diff entry (`github-light`, `solarized-light`, `catppuccin-latte`, `paper`, …) inherits
`minimal-paper`'s overrides via `getDiffThemeVars(preset, 'light')`.

### Syntax highlighter
Every preset uses the default Shiki pair `{dark: 'pierre-dark', light: 'pierre-light'}` — except
`minimal-paper`, the one exception, which swaps the light half to `github-light`
(`DiffView.vue:78-80`). Reason: `pierre-light` was tuned for a near-white canvas and washes out
on cream; `github-light` reads cleanly on the warm paper. The active half is chosen by the
caller-supplied `themeType`, not derived from the preset name.

---

## Server-side validation

`server/src/services/settings-store.ts` keeps an allow-list `THEME_PRESETS` set; both
`minimal-dark` and `minimal-paper` are in it. `normalizeSettings` persists a valid id and
silently resets any unknown id back to `DEFAULT_SETTINGS.themePreset`.

---

## Gotchas

- **The light theme's id is `minimal-paper`, not `minimal-light`.** There is no `minimal-light`
  preset in the repo.
- Storage-miss default is `catppuccin-mocha`; the minimal themes are opt-in.
- Minimal Dark is *not* the dark diff fallback — that is `catppuccin-mocha`
  (`DIFF_THEME_VARS_DARK_FALLBACK`). A dark preset with no diff entry inherits mocha's overrides.
- `themeType` for diffs is caller-controlled, not preset-derived. Passing `themeType: 'dark'`
  with `themePreset: 'minimal-paper'` renders the `pierre-dark` Shiki half — the `github-light`
  swap only kicks in when the caller also selects `'light'`.
- If you retune the Flexoki hues, update both the raw hex and the HSL derivation comment in
  `diffThemes.ts` — they are paired in the file but not in code.

---

## Source map

| concern | file |
|---|---|
| Token definitions | `shared/src/theme/presets.ts` (`minimal-dark` 16-28, `minimal-paper` 29-41) |
| Type + id export | `shared/src/theme/presets.ts:408-409` |
| CSS var application | `web/src/lib/theme.ts` |
| Diff var overrides | `web/src/lib/diffThemes.ts` (lines 6-44) |
| Light-theme diff fallback | `web/src/lib/diffThemes.ts:117` |
| Shiki highlighter branch | `web/src/components/shared/DiffView.vue:77-82` |
| Settings picker grouping | `web/src/components/settings/ThemePicker.vue:66` |
| Theme dialog grouping | `web/src/components/picker/ThemeDialog.vue:81` |
| Sidebar quick-toggle | `web/src/components/session/LeftSidebar.vue:160-185`, `214` |
| Toggle handler | `web/src/App.vue:1686-1687` |
| Allowed-id whitelist | `server/src/services/settings-store.ts:124-130` |
