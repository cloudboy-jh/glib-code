# Next Steps

Last updated: 2026-04-30

## Immediate priority order

1. Complete frontend session/timeline data-plane switch to real `/api/sessions` + `/api/agent` SSE.
2. Finish GitTrix service boundary integration (`session.write/promote/evict`).
3. Finish git mutation + terminal + attachments routes to unblock full in-app workflow.

## Execution sequence

### 1) Frontend data-plane switch

- Replace mock session/timeline state with API-backed data.
- Consume SSE stream and reduce events into timeline.
- Keep diff context handoff as first-class composer input.

### 2) Backend GitTrix boundary slice

- Add `GitTrixService` integration for write/promote/evict routes.
- Keep opencode capability authority as source for provider/model selection validation.

### 3) Remaining API parity

- Implement `/api/git` mutations.
- Implement `/api/term` WebSocket.
- Implement `/api/attachments`.
- Implement `/api/diff/branch-compare`.

### 4) Reliability pass

- Standardize error payloads.
- Add integration-level route tests for core workflows.
- Validate behavior across both hosts (dev web + Electron shell).
