# Next Steps — UI Parity + Diff Contract

Last updated: 2026-04-24

## Progress snapshot

- [x] Diff surface uses `@pierre/diffs` renderer.
- [x] Picker-first onboarding is in place (open/clone/recent).
- [x] Session composer is gated until a real session exists.
- [x] Sidebar stays visible while picker is shown.
- [x] New logo assets wired (wordmark + icon) with theme-aware masking.
- [x] Picker now has Theme entry + dedicated Theme dialog.
- [x] Project open flow now routes through an inline picker mode chooser (`Diffs` vs `Session`).
- [x] Default theme is `catppuccin-mocha`.
- [x] Browser tab favicon now uses the glib icon asset.
- [x] Session sidebar now has persisted resize width.
- [x] Session sidebar has Home action back to picker.
- [x] Session sidebar collapse now uses the masked glib icon rail.

## Component checklist

### Picker / onboarding
- [x] Centered picker surface with Get Started + Recent Projects.
- [x] Open Project dialog.
- [x] Clone Repository dialog.
- [x] Recent list cleaned (no Ctrl-1..Ctrl-9 hints).
- [x] Theme button under Recent Projects.
- [x] Inline project mode chooser in picker (`Diffs` / `Session`).
- [x] Session mode selection now auto-starts a session.
- [ ] Add keyboard navigation for picker rows (j/k + enter).
- [ ] Add robust recents states (missing path, no .git, remove/forget).

### Session surfaces
- [x] Sidebar logo integration and collapse behavior.
- [x] Sidebar resize rail + persisted width.
- [x] Sidebar Home action back to picker.
- [x] Empty-state when Session mode has no active session.
- [x] Sidebar session list now groups by repo and project/worktree.
- [x] Sidebar session selection now works from homepage/picker state (no disable lock).
- [ ] Tighten sidebar parity pass for shadcn/t3 sizing, collapse behavior, and search control.
- [x] Refine Composer/chat input against official t3 source scans.
- [x] SessionHeader now uses iconized controls + split Diff action (`Current session diff` / `Commits list`).
- [x] SessionHeader model control is text-only and overflow (`...`) action was removed.
- [ ] Tighten parity pass for SessionHeader spacing/control density and button styling against official t3 source scans.
- [ ] Tighten parity pass for Timeline card rhythm + metadata tone.

### Diff surfaces (glib-go contract)
- [x] Project picker + commit picker flow.
- [x] File list + split/unified display toggle.
- [x] Unified reader via `@pierre/diffs`.
- [ ] Replace mock diff payloads with repo-backed data.
- [ ] Add explicit file/hunk selection state for attach-to-agent flow.

### Overlays / settings / keyboard
- [x] Command palette toggle (`Ctrl/Cmd+K`).
- [x] Terminal toggle (`Ctrl/Cmd+J`).
- [x] Escape closes top-most overlay (palette/settings/theme/terminal).
- [ ] Focus trap + focus return parity across all dialogs.
- [ ] Polish Settings modal to match target rhythm exactly.

## Acceptance gate

- [ ] Screenshot parity review done for non-diff surfaces.
- [ ] Diff reader review done against glib-go contract.
- [x] Build + typecheck passing.
- [ ] No placeholder-only behavior in primary UI paths.

## Latest notes

- The sidebar was pushed closer to t3 structure, but the current pass still needs another visual correction pass.
- Picker mode selection is now inline on the picker surface instead of a separate dialog.
- Composer pass is now in a cleaner one-surface state with command execution wiring and reduced footer noise.
- Composer context hint now lives in the input placeholder (commit-context-aware) instead of a separate badge/row.
- Sidebar wordmark was resized/centered and the alpha chip was removed.
- Session header now has iconized controls and split Diff behavior with dedicated actions.
- Sidebar session hierarchy now nests by repo -> project/worktree -> sessions.
- Sidebar action/header icon set now uses heavier lucide sizing/stroke; Home now uses a real home icon.
- Session selection from sidebar now rehydrates the related project and opens chat even from homepage.
- Next implementation slice is timeline rhythm/metadata parity.
- Main known sidebar gaps right now:
  - search control still needs stronger shadcn-style definition,
  - expanded sizing/collapse behavior still needs polish,
  - icon rail behavior should stay theme-masked and visually consistent.
