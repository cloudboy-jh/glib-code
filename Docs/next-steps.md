# Next Steps

Last updated: 2026-05-01

## Immediate priority order

1. Lock first-run onboarding for provider/model/git readiness so the app is usable on first launch.
2. Complete frontend session/timeline data-plane switch to real `/api/sessions` + `/api/agent` SSE.
3. Finish GitTrix service boundary integration (`session.write/promote/evict`).
4. Finish git mutation + terminal + attachments routes to unblock full in-app workflow.

## Execution sequence

### 1) First-run onboarding + setup parity

- Make startup gate explicit in UI from `/api/readiness` and `/api/providers`:
  - `opencode missing`
  - `no authenticated providers`
  - `models unavailable for authenticated provider`
  - `git missing/unavailable`
- Replace dead-end empty states with action-led setup states:
  - provider auth guidance (`opencode auth list` / `opencode auth login`)
  - model refresh guidance (`opencode models <provider>`)
  - git installation/config guidance
- Keep GitTrix config app-level only (not project-level).
- Add acceptance checks for first-use flow:
  - fresh machine with no auth
  - auth present + models present
  - auth present + provider with zero models

### 2) Frontend data-plane switch

- Replace mock session/timeline state with API-backed data.
- Consume SSE stream and reduce events into timeline.
- Keep diff context handoff as first-class composer input.

### 3) Backend GitTrix boundary slice

- Add `GitTrixService` integration for write/promote/evict routes.
- Keep opencode capability authority as source for provider/model selection validation.

### 4) Remaining API parity

- Implement `/api/git` mutations.
- Implement `/api/term` WebSocket.
- Implement `/api/attachments`.
- Implement `/api/diff/branch-compare`.

### 5) Reliability pass

- Standardize error payloads.
- Add integration-level route tests for core workflows.
- Validate behavior across both hosts (dev web + Electron shell).
- Add coverage for opencode capability parsing against real CLI output variants.
