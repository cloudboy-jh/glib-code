# Next Steps

## Frontend

- [ ] Polish session list presentation consistency between picker and sidebar (spacing, hierarchy, timestamp weight).
- [ ] Ship project-level provider/model override UX + effective state labels.
- [ ] Add hunk selection UI for promote selectors.
- [ ] Wire active hunk/multi-file selection UI into the current full-width diff workbench.
- [ ] Preserve selected context while navigating within Diff before session creation.
- [x] Swap simulated terminal output for real `/api/term` websocket integration.
- [x] Wire image/file uploads to `/api/attachments` endpoints.
- [ ] Ensure command palette actions are disabled when backend capability is missing.
- [ ] Remove remaining mock-only critical workflow paths.

## Backend

- [ ] Document sessions list contract clearly (`/api/sessions` scoped, `/api/sessions?scope=all` global).
- [ ] Add tests for path normalization edge cases (drive casing, slash style, trailing slash).
- [ ] Optimize `scope=all` aggregation path for larger repos/session counts (cache or incremental strategy).
- [ ] Add telemetry for session-list fetch latency and empty-result causes.
- [ ] Add pagination/limit support for `scope=all` session listing.
- [ ] Strengthen session-index hygiene/cleanup for stale project-path entries.
- [x] Finalize `/api/term` websocket lifecycle/capability/error handling for frontend adoption.
- [x] Implement `/api/attachments` upload/read/delete routes.
- [x] Implement remaining git mutation routes under `/api/git` (stage/unstage/discard/commit/pull/checkout/create-branch/get-commit).
- [ ] Implement `/api/diff/branch-compare`.
- [ ] Add timeout handling per turn.
- [x] Complete real local pi RPC parity test against installed `pi` binary.
- [x] Remove in-process SDK runtime path after RPC parity is complete.
- [ ] Ensure project browsing/listing state moves beyond single process-global current project scope.
- [ ] Persist project provider/model overrides beyond current server process or remove them from contract.
- [ ] Move current project state to a client/session-scoped model (not single process-global value).
- [ ] Harden FS read/tree for large repos and binary files.
- [ ] Keep readiness checks fast and cached while preserving actionable errors.
- [ ] Ensure Git + diff route surface matches what frontend advertises.
- [ ] Typecheck + build pass (`bun run --cwd server check`, `bun run --cwd server build`).

## Verification

- [x] Workspace checks pass (`bun run check`).
- [x] Workspace builds pass (`bun run build`).
- [x] Run `Docs/session-smoke-test.md` end-to-end manually (including restart/reload-after-promote). *(Non-blocking for current release gate.)*
- [x] Confirm clean cold start manually (no App.vue TDZ regression). *(Non-blocking for current release gate.)*
