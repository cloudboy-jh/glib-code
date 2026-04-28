# Frontend Checklist — Gittrix Integration Track

Last updated: 2026-04-26

This checklist is intentionally backend-coupled: frontend work here is about exposing and enforcing the Gittrix model (ephemeral agent work, human promotion gate), not cosmetic parity passes.

## A) Current baseline cleanup

- [ ] Remove hardcoded `API_BASE` and mock app data in `web/src/App.vue`.
- [ ] Load recents from `/api/projects/recents` on app boot.
- [ ] Load current project from `/api/repo/current` (or explicit “no project” state).
- [ ] Load sessions from `/api/sessions?projectId=...` instead of local reactive mocks.
- [ ] Load diff sources/items/files/hunks from `/api/diff/*` end-to-end.

## B) Diff → context flow (real data only)

- [ ] Keep drill-down selection state for source/item/file/hunk in client state.
- [ ] Build context packet only via `/api/diff/pack` (no client-side diff assembly).
- [ ] Attach packed context to composer before send.
- [ ] Persist context block into timeline entries after send.
- [ ] Support clear/remove context from composer before send.

## C) Session + streaming wiring

- [ ] Create session from `/api/agent/sessions` and store returned session id.
- [ ] Send prompt via `/api/agent/sessions/:id/send`.
- [ ] Open `EventSource` to `/api/agent/sessions/:id/stream`.
- [ ] Reduce SSE `AgentEvent` stream into timeline UI state.
- [ ] Handle abort action via `DELETE /api/agent/sessions/:id/turn`.

## D) Gittrix-specific UX contract

- [ ] Show explicit session storage mode badge: `Ephemeral (Gittrix)`.
- [ ] Show “pending promote” state when ephemeral branch diverges.
- [ ] Add a Promotion action in Session header (human-only).
- [ ] Block/hide any “agent commit to durable” affordance.
- [ ] Show promotion conflict/error states from backend payloads.
- [ ] Show promotion success summary with durable commit sha.

## E) Robustness + edge states

- [ ] Empty state when project has zero sessions.
- [ ] Empty state when session has zero turns.
- [ ] Retry affordance for failed stream connection.
- [ ] Recover gracefully when a session referenced by UI was evicted.
- [ ] Preserve selected diff context when switching `Diff ↔ Session` mode.

## F) Keyboard/focus quality gates

- [ ] `cmd/ctrl+k` opens command palette from all primary surfaces.
- [ ] `cmd/ctrl+j` toggles terminal drawer without breaking composer focus.
- [ ] `esc` closes top-most overlay first.
- [ ] Dialog focus trap + focus return implemented for picker/settings/theme.

## G) Done criteria for frontend Gittrix milestone

- [ ] No mock recents/sessions/diff data remains in app shell.
- [ ] User can select diff context, send prompt, stream response, and promote from UI.
- [ ] Promotion status and conflict handling are visible without opening devtools.
- [ ] App remains usable when promote is rejected due to baseline conflict.


## All Modal interactions and content and layouts need to be adjusted. 