# Dev demo routes

Special query-string routes for exercising specific UI surfaces in pure browser dev (no Electron, no desktop bridge). All routes are dev-only conveniences and never ship to end users.

## `?demo=theme-cycle`

Cycles the active theme preset every ~900ms across the full preset list, starting from the saved theme. Used to generate the README theme-cycle gif and sanity-check theme token coverage across the workbench.

- Auto-starts on mount if `demo=theme-cycle` is present.
- Restores the original theme on unmount.
- Does not persist theme changes (uses `updateTheme(theme, { persist: false })`).
- Forces `state.mode = 'diff'` and closes any open dialogs so the workbench is the visible surface.

## `?demo=onboarding`

Forces the `FirstLaunchOverlay` open in browser-only mode so the onboarding/welcome flow can be exercised interactively without a desktop shell. Used as the cleanup surface for the real first-run flow — copy, step ordering, permission rationale, and signin card layout all render from the same `FirstLaunchOverlay.vue` used in production.

- Interactive: each step advances on button click (`Get started` → `Continue` → `Set up providers in Settings` / `Skip for now`), exactly like the desktop first-run.
- Seeds demo state via `useFirstLaunch().seedDemo()`:
  - `platform = 'win32'`
  - `appVersion = 'dev'`
  - `needsFsPermissionRationale = true` (so the permissions step renders — it's the showcase path)
- `window.glibDesktop` is absent in pure browser dev, so `advanceStep` / `completeFirstLaunch` short-circuit desktop-only calls (`markWelcomeSeen`, update subscriptions) and the overlay closes cleanly on the final advance.
- No mock callbacks or shims — the real composable code path runs end-to-end.

To iterate on the overlay (copy tweaks, step transitions, card layout, accessibility), load this route, walk the steps, and confirm each panel. Changes to `FirstLaunchOverlay.vue` or `useFirstLaunch.ts` propagate to both the demo and the real desktop first-run.

## Combining routes

The two demos are mutually exclusive — loading `?demo=theme-cycle` overrides onboarding wiring and vice versa. Don't combine them on one URL.
