# Next Steps

Last updated: 2026-05-03

## Immediate priority order

1. Frontend session data-plane switch + promote UX.
2. Terminal WebSocket transport (`/api/term`).
3. Attachments API + frontend integration (`/api/attachments`).
4. Git mutation route completion under `/api/git`.
5. Reliability pass (tests, error envelopes, restart behavior).

## Execution sequence

### 1) Frontend data-plane + promote

- Replace local session/timeline state with real `/api/sessions` + `/api/agent` flow.
- Consume SSE stream from `/api/agent/sessions/:id/stream` and reduce to timeline entries.
- Wire composer send/abort to backend routes.
- Add session diff/promotion UI using:
  - `GET /api/sessions/:id/diff`
  - `POST /api/sessions/:id/promote`
  - 409 baseline conflict handling modal/state.

### 2) Terminal WS

- Replace placeholder terminal transport with real `/api/term` websocket lifecycle.
- Add reconnect handling and explicit disconnected state in UI.

### 3) Attachments

- Implement upload/read/delete backend routes.
- Wire composer attachment selection + send payload.

### 4) Git mutations

- Complete missing stage/unstage/discard/commit/push/pull/checkout endpoints.
- Align frontend command actions to real route behavior.

### 5) Reliability pass

- Standardize error payloads.
- Add integration-level route tests for core workflows.
- Validate behavior across both hosts (dev web + Electron shell).
- Add restart/recovery checks for session metadata and timeline persistence.
