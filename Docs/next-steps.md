# Next Steps — Gittrix-First Backend Integration

Last updated: 2026-04-26

Current docs describe a fuller system than what the code currently ships. The immediate plan is to stop polishing mock UI behavior and wire the real backend path around Gittrix.

## Current reality snapshot (from code)

- Frontend shell/components exist, but `web/src/App.vue` still carries mock recents/sessions/diff payloads.
- Diff endpoints are partially real (`/api/diff/sources|items|files|hunks|pack`), but `branch-compare` is still `501`.
- Agent and session APIs are stubbed (`/api/agent/*` and most `/api/sessions/*` return `501`/placeholder).
- Settings/keybindings/recents persistence is real and local-file-backed.

## Primary objective

Adopt `gittrix` as glib's primary backend for model ephemeral storage routing:

- Agent writes only to ephemeral session repos.
- Durable repo changes happen only through a human promotion action.
- Promotion creates one clean synthetic commit on durable.

## Execution order

### 1) Backend contract freeze for Gittrix
- [ ] Define glib↔gittrix mapping for session lifecycle (`start`, `list`, `diff`, `log`, `promote`).
- [ ] Define API error contract for promotion conflicts and stale baseline.
- [ ] Define session identity model (`glibSessionId` ↔ `gittrixSessionId`).

### 2) Backend integration slice (no UI polish work until this lands)
- [ ] Add a `gittrix` service adapter in `server/src/services` and isolate all durable writes behind it.
- [ ] Replace stubbed `/api/agent/*` routes with real turn orchestration in ephemeral workspaces.
- [ ] Replace stubbed `/api/sessions/*` routes with gittrix-backed session listing/read/fork/delete semantics.
- [ ] Add `/api/git/promote` (or equivalent) as a human-only promotion endpoint.

### 3) Frontend data-plane switch from mock to real
- [ ] Remove mock session/diff/recents data from `App.vue`; hydrate from API on boot.
- [ ] Wire Diff selection → Session composer context using real `/api/diff/pack` output.
- [ ] Show promotion CTA/state in Session header and session timeline.

### 4) Conflict + promotion UX hardening
- [ ] Surface baseline conflict errors with explicit “rebase/review/retry promote” states.
- [ ] Block any UI path that implies direct durable write from agent turns.
- [ ] Add promotion result summary card (files promoted, commit sha, skipped/conflicted files).

### 5) Acceptance gate for the Gittrix milestone
- [ ] End-to-end: start session → agent edits ephemeral → human promote → one durable commit.
- [ ] Verify no agent path can commit directly to durable branch.
- [ ] Verify stale durable baseline is detected before promote.
- [ ] Build + typecheck pass for `server`, `web`, and `shared`.

## Tracking docs

- Frontend execution checklist: `Docs/frontend-checklist.md`
- Backend execution checklist: `Docs/backend-checklist.md`
