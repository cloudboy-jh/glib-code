# Next Steps — UI Parity + Diff Contract

Last updated: 2026-04-23

## Progress snapshot

- [x] Diff surface uses `@pierre/diffs` renderer.
- [x] Picker-first onboarding is in place (open/clone/recent).
- [x] Session composer is gated until a real session exists.
- [x] Sidebar stays visible while picker is shown.
- [x] New logo assets wired (wordmark + icon) with theme-aware masking.
- [x] Picker now has Theme entry + dedicated Theme dialog.
- [x] Default theme is `catppuccin-mocha`.

## Component checklist

### Picker / onboarding
- [x] Centered picker surface with Get Started + Recent Projects.
- [x] Open Project dialog.
- [x] Clone Repository dialog.
- [x] Recent list cleaned (no Ctrl-1..Ctrl-9 hints).
- [x] Theme button under Recent Projects.
- [ ] Add keyboard navigation for picker rows (j/k + enter).
- [ ] Add robust recents states (missing path, no .git, remove/forget).

### Session surfaces
- [x] Sidebar logo integration and collapse behavior.
- [x] Empty-state when Session mode has no active session.
- [ ] Tighten parity pass for SessionHeader spacing/control density.
- [ ] Tighten parity pass for Timeline card rhythm + metadata tone.
- [ ] Tighten parity pass for Composer geometry and action strip.

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
