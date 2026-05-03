# Next Steps

Last updated: 2026-05-03

## Immediate priority order

1. Terminal WebSocket transport (`/api/term`).
2. Attachments API + frontend integration (`/api/attachments`).
3. Git mutation route completion under `/api/git`.
4. Reliability pass (tests, error envelopes, restart behavior).
5. Cloudflare Artifacts adapter once backend support lands.

## Execution sequence

### Completed: frontend data-plane + promote

- Session state now hydrates from `/api/sessions` and `/api/agent` routes instead of localStorage mock state.
- Session timeline consumes `/api/agent/sessions/:id/stream` SSE events with client-side dedupe.
- Composer send and `/stop`/`/abort` hit backend agent routes.
- Session diff/promotion UI is wired with:
  - `GET /api/sessions/:id/diff`
  - `POST /api/sessions/:id/promote`
  - file-level selection
  - 409 baseline conflict modal/state
- Provider auth is not required for picker/project open/diff review; it only gates agent session creation/sending.
- Settings → Git now documents the local MVP GitTrix mode:
  - Durable: Local repo
  - Ephemeral: Local workspace
  - Promote: Commit
  - Cloudflare Artifacts and other non-local providers/strategies are visible but disabled as Coming Soon.

### 1) Terminal WS

- Replace placeholder terminal transport with real `/api/term` websocket lifecycle.
- Add reconnect handling and explicit disconnected state in UI.

### 2) Attachments

- Implement upload/read/delete backend routes.
- Wire composer attachment selection + send payload.

### 3) Git mutations

- Complete missing stage/unstage/discard/commit/push/pull/checkout endpoints.
- Align frontend command actions to real route behavior.

### 4) Reliability pass

- Standardize error payloads.
- Add integration-level route tests for core workflows.
- Validate behavior across both hosts (dev web + Electron shell).
- Add restart/recovery checks for session metadata and timeline persistence.

### 5) Cloudflare Artifacts adapter

- Keep Cloudflare Artifacts disabled as Coming Soon in Settings → Git until the backend adapter is wired.
- Replace local adapter shim paths with the real adapter implementation when available.
