# Session Reliability Remaining Work - 2026-05-12

## Current State

- Session hydrate/send/stream/diff/promote calls now include the active session `projectPath`.
- Backend session lookup is centralized in `server/src/services/session-resolver.ts`.
- Stream/send infrastructure errors are shown as session notices instead of repeated timeline cards.
- Stale sessions get a recovery banner with Reload sessions and New replacement actions.
- Agent cwd falls back to the durable repo when the GitTrix ephemeral workspace is not a git repo.

## Remaining P0

- Replace `.git`-less local GitTrix ephemeral copies with git-backed workspaces.
  - Prefer local git worktree if compatible with GitTrix promote semantics.
  - Otherwise use a local clone per session.
  - Agent cwd should return to the ephemeral workspace only when git commands work there.
- Add server regression tests for session resolver behavior:
  - resolve by session index
  - resolve by explicit `projectPath`
  - recover when index is missing/stale
  - return one clean 404 for truly missing sessions
- Add stream lifecycle tests/manual checks:
  - refresh app during an active session
  - restart backend and send again
  - switch project and return
  - verify stream replay and no duplicate timeline entries
- Add route tests for send/stream/abort/diff/promote with `projectPath` query/body.

## Remaining P1

- Promote session status from local UI state into a clearer model:
  - connected
  - connecting
  - disconnected
  - stale
  - running
- Show compact session status in `SessionHeader` and sidebar rows.
- Add recovery behavior for backend restart:
  - reconnect stream after hydrate
  - keep active session if metadata exists
  - clear active session only when resolver confirms it is gone
- Keep composer draft per session, not globally.
- Standardize route error payloads across `/api/agent/*` and `/api/sessions/*`.

## Remaining P2

- Multi-tab behavior:
  - prevent duplicate runtime sends for same session/turn
  - avoid conflicting active-session local state
  - decide whether streams are per tab or shared through a client-side coordinator
- Hosted/cloud workspace behavior:
  - define sandbox-to-Artifacts sync
  - verify cwd semantics for Cloudflare Sandbox
  - ensure promote runs against the expected GitTrix ephemeral provider state
- Session diagnostics panel:
  - session id
  - durable repo path
  - agent cwd
  - GitTrix ephemeral path
  - baseline SHA
  - stream status
  - last resolver path

## Explicit Non-Goals For This Pass

- Do not re-add the hunk side panel.
- Do not add branch checkout/compare UI until backend git mutation and branch compare routes are real.
- Do not route git-aware agent turns into `.git`-less ephemeral directories.

## Validation Checklist

- Create a session from a repo and ask `git status` / `git remote -v`.
- Refresh the app and send another message to the same session.
- Restart backend and send another message to the same session.
- Switch to another project, then return and continue the session.
- Delete or corrupt a session file and confirm the UI shows one stale banner, not timeline spam.
- Promote session diff after recovery/reload.
