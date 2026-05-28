# Next Steps

## Frontend

- [x] Harden picker keyboard flow across `mode -> session-choice -> session-list` (`j/k`, arrows, `Enter`, `Esc`) with no focus traps.
- [x] Refactor Settings modal to a unified row-based layout across Models/GitTrix/Editor with subtle selected-state indicators.
- [ ] Polish session list presentation consistency between picker and sidebar (spacing, hierarchy, timestamp weight).
- [x] Add regression coverage for picker continue/new flow, canonical path lookups, list capping, and stale-session recovery actions.
- [x] Enforce deterministic overlay/key precedence (`Esc`, `Cmd/Ctrl+K`, `Cmd/Ctrl+J`) so top-most UI surface always wins.
- [ ] Wire active hunk/multi-file context selection into the current full-width diff workbench flow.
- [ ] Ship project-level provider/model override UX with effective-state labels.
- [ ] Swap simulated terminal output for real `/api/term` websocket integration when backend is ready.

## Backend

- [ ] Document sessions list contract clearly (`/api/sessions` scoped, `/api/sessions?scope=all` global).
- [ ] Add tests for path normalization edge cases (drive casing, slash style, trailing slash).
- [ ] Optimize `scope=all` aggregation path for larger repos/session counts (cache or incremental strategy).
- [ ] Add telemetry for session-list fetch latency and empty-result causes.
- [ ] Add pagination/limit support for `scope=all` session listing.
- [ ] Strengthen session-index hygiene/cleanup for stale project-path entries.
- [ ] Finalize `/api/term` websocket lifecycle/capability/error handling for frontend adoption.
