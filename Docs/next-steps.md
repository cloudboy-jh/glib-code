# Next Steps

Last updated: 2026-05-02

## Immediate priority order

1. Terminal WebSocket transport (`/api/term`).
2. Attachments API + frontend integration (`/api/attachments`).
3. Git mutation route completion under `/api/git`.
4. Hosted-mode architecture/design pass.
5. Reliability pass (tests, error envelopes, restart behavior).

## Execution sequence

### 1) Terminal WS

- Replace placeholder terminal transport with real `/api/term` websocket lifecycle.
- Add reconnect handling and explicit disconnected state in UI.

### 2) Attachments

- Implement upload/read/delete backend routes.
- Wire composer attachment selection + send payload.

### 3) Git mutations

- Complete missing stage/unstage/discard/commit/push/pull/checkout endpoints.
- Align frontend command actions to real route behavior.

### 4) Hosted-mode design

- Document adapter and transport choices for bridge + cloud flows.
- Define latency and failure-handling constraints.

### 5) Reliability pass

- Standardize error payloads.
- Add integration-level route tests for core workflows.
- Validate behavior across both hosts (dev web + Electron shell).
- Add restart/recovery checks for session metadata and timeline persistence.
