# Session Reliability Remaining Work - 2026-05-12

## Current State

- Session hydrate/send/stream/diff/promote calls now include the active session `projectPath`.
- Backend session lookup is centralized in `server/src/services/session-resolver.ts`.
- Stream/send infrastructure errors are shown as session notices instead of repeated timeline cards.
- Stale sessions get a recovery banner with Reload sessions and New replacement actions.
- New local sessions use a git-backed GitTrix ephemeral workspace for agent cwd; old/non-git sessions still fall back to durable repo cwd.

## Completed For This Pass

- Replaced `.git`-less local GitTrix ephemeral copies with git-backed workspaces.
  - Prefer local git worktree.
  - Fall back to local clone per session.
  - Agent cwd returns to the ephemeral workspace only when session metadata says it is git-backed and `.git` exists.
- Added session resolver regression coverage for index lookup, explicit `projectPath`, stale index cleanup, and agent cwd fallback.
- Added route coverage for explicit `projectPath` resolution on session get/patch/send/abort/diff/promote/evict paths.
- Added clearer client session states and per-session composer drafts.
- Stream disconnects now verify session availability before marking a session stale.
- Standardized session/agent route error envelopes with `ok`, `code`, `message`, and `retryable` fields on handled failures.
- Fixed pi RPC prompt completion to wait for `agent_end` instead of `turn_end`, preserving final assistant text after tool calls.
- Updated promote diff API/UI so changed file metadata comes from the backend and users can commit all or selected files from the modal.

## Remaining P0

- Add stream lifecycle manual checks:
  - refresh app during an active session
  - restart backend and send again
  - switch project and return
  - verify stream replay and no duplicate timeline entries
- Add full live-agent route validation for successful send/stream/abort/diff/promote with `projectPath` query/body.

## Remaining P1

- Add recovery behavior for backend restart:
  - reconnect stream after hydrate
  - keep active session if metadata exists
  - clear active session only when resolver confirms it is gone

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

Short version lives in `Docs/session-smoke-test.md`.

- Create a session from a repo and ask `git status` / `git remote -v`.
- Refresh the app and send another message to the same session.
- Restart backend and send another message to the same session.
- Switch to another project, then return and continue the session.
- Delete or corrupt a session file and confirm the UI shows one stale banner, not timeline spam.
- Promote session diff after recovery/reload.
