# UI Parity / Consistency Checklist

Last updated: 2026-05-03

This is now a practical checklist for current `web/` implementation quality, not a source-locked mirror document.

## App shell

- [ ] Sidebar collapse/resize behavior feels consistent across breakpoints.
- [x] Header, timeline, and composer spacing tokens are uniform enough for current pass.
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

- [x] Empty session and empty timeline states are distinct and intentional.
- [ ] Composer command interactions work with keyboard only.
- [ ] Command palette actions respect current mode/project availability.
- [x] Provider/model selectors reflect backend capability state exactly.
- [x] Unavailable providers/models are not selectable for agent execution.
- [x] Provider/model error states are explicit and actionable.
- [x] Tool calls are not dumped as raw text; they render as compact expandable cards.

## Overlay behavior

- [ ] `Esc` closes only the top-most open overlay.
- [ ] Focus returns to invoking element after modal/dialog close.
- [ ] Theme/settings dialogs preserve state changes reliably.

## Visual acceptance gate

- [ ] Capture before/after screenshots for Diff, Session, Settings.
- [x] Add current Picker screenshot to README.
- [ ] Build/typecheck pass after UI changes.
- [ ] No placeholder text in primary product surfaces.
