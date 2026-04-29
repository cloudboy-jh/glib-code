# Next Steps

Last updated: 2026-04-29

## Immediate priority order

1. Complete backend agent/session routes so frontend can stop simulating chat state.
2. Wire frontend session/timeline to real API + SSE stream.
3. Finish git mutation + terminal + attachments routes to unblock full in-app workflow.

## Execution sequence

### 1) Backend runtime slice

- Implement `/api/agent/sessions`, `send`, `stream`, `abort`, `delete`.
- Implement durable session storage under `.glib/`.
- Implement `/api/sessions` list/read/fork/delete/patch.

### 2) Frontend data-plane switch

- Replace mock session/timeline state with API-backed data.
- Consume SSE stream and reduce events into timeline.
- Keep diff context handoff as first-class composer input.

### 3) Remaining API parity

- Implement `/api/git` mutations.
- Implement `/api/term` WebSocket.
- Implement `/api/attachments`.
- Implement `/api/diff/branch-compare`.

### 4) Reliability pass

- Standardize error payloads.
- Add integration-level route tests for core workflows.
- Validate behavior across both hosts (dev web + Electron shell).
