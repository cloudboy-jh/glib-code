# UI Parity / Consistency Checklist

Last updated: 2026-04-30

This is now a practical checklist for current `web/` implementation quality, not a source-locked mirror document.

## App shell

- [ ] Sidebar collapse/resize behavior feels consistent across breakpoints.
- [ ] Header, timeline, and composer spacing tokens are uniform.
- [ ] No component uses one-off hardcoded colors when token exists.

## Picker and project flows

- [ ] Keyboard navigation (`j/k`, arrows, enter) works without focus traps.
- [ ] Recent status badges (`missing_path`, `missing_git`) are always visible and accurate.
- [ ] Open/init/create flows have clear error states.

## Diff UX

- [ ] Commit history list supports keyboard-first navigation.
- [ ] Uncommitted and commit diff views share identical controls and layout rhythm.
- [ ] File navigation (`Prev/Next/select`) is stable with large diffs.
- [ ] Diff truncation message is clear when patch exceeds max line cap.

## Session UX

- [ ] Empty session and empty timeline states are distinct and intentional.
- [ ] Composer command interactions work with keyboard only.
- [ ] Command palette actions respect current mode/project availability.
- [ ] Provider/model selectors reflect backend capability state exactly.
- [ ] Unavailable providers/models are never selectable.
- [ ] Provider/model error states are explicit and actionable.

## Overlay behavior

- [ ] `Esc` closes only the top-most open overlay.
- [ ] Focus returns to invoking element after modal/dialog close.
- [ ] Theme/settings dialogs preserve state changes reliably.

## Visual acceptance gate

- [ ] Capture before/after screenshots for Picker, Diff, Session, Settings.
- [ ] Build/typecheck pass after UI changes.
- [ ] No placeholder text in primary product surfaces.
