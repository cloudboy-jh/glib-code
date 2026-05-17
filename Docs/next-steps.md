# Next Steps

Last updated: 2026-05-17

## Current shipped local loop

- Open/clone a local git repo.
- Review uncommitted or commit diffs without a provider key.
- Add provider API keys explicitly inside glib-code.
- Start pi-backed agent sessions paired with GitTrix metadata. Local GitTrix sessions use git-backed ephemeral workspaces when available; old/non-git sessions still fall back to durable repo cwd.
- Stream user/assistant/error/tool-call timeline events over SSE.
- Keep session send/stream/abort/hydrate/diff/promote actions scoped to `sessionId` plus active `projectPath` so reloads, project switches, and stale index state do not strand valid sessions.
- Preserve streamed assistant text chunks with collision-proof event IDs.
- Review session diffs and commit all or selected files back to the durable repo.
- Sign in with GitHub via device OAuth, select GitHub durable storage, and promote session changes as pushed commits.
- Local durable promote supports dirty-repo protection, stash-and-continue, and local push when the branch has an upstream.

## Immediate priority order

1. UI/UX polish for the commit modal and Settings → GitTrix cards now that the GitHub durable smoke path works.
2. Finish live session smoke validation for reload/restart recovery after successful GitHub durable promote.
3. Terminal WebSocket transport (`/api/term`).
4. Attachments API + frontend integration (`/api/attachments`).
5. Remaining git mutation routes under `/api/git` (stage/unstage/discard/pull/checkout).
6. Redesigned hunk/file context selection that does not compromise diff readability.

## Completed recently

- Made sandbox/RPC runtime the default; in-process SDK remains available with `GLIB_PI_RUNTIME=sdk` as a temporary fallback.
- Wired provider/model discovery and provider key management through `/api/providers`.
- Moved provider key storage to glib-owned app config (`<configDir>/pi/auth.json`).
- Stopped reading opencode auth storage.
- Added GitTrix local, GitHub durable, and Cloudflare Artifacts ephemeral session start/diff/promote/evict wiring.
- Hydrated sessions from backend state and replayed persisted timelines.
- Wired prompt send, SSE streaming, and abort routes.
- Added compact tool-call cards in the timeline.
- Added session diff/promote modal with file-level selection and baseline conflict handling.
- Reworked Settings → Models and ModelPicker around active model + usable provider auth.
- Kept Picker/project open/diff review available without provider keys.
- Added explicit GitTrix startup errors and Cloudflare config preflight errors.
- Added GitTrix quick fallback to Local durable/local ephemeral when provider setup fails.
- Previously hydrated GitTrix ephemeral workspace from durable repo on session start; local sessions now use git-backed worktree/clone workspaces.
- Added README app screenshot.
- Added `bun run dev:desktop` for server + Vite + Electron local desktop development.
- Added strict Vite port handling and visible Electron startup/error logging for desktop dev.
- Fixed same-millisecond streamed text chunk collisions that could drop words from assistant responses.
- Added session-id routing and app-level session indexing for agent send/stream/abort/delete so valid sessions do not 404 after global project changes.
- Split server app state into focused settings and project stores.
- Added frontend guards against duplicate session creation and stale session EventSource streams.
- Added projectPath-scoped session hydrate/send/stream/diff/promote routing and shared backend session resolver.
- Moved session stream/send infrastructure failures out of the timeline and into a recovery banner.
- Added durable repo cwd fallback when GitTrix ephemeral workspace is not a git repo.
- Added git-backed local GitTrix ephemeral workspaces using detached worktrees with clone fallback.
- Persisted GitTrix workspace capability metadata (`isGitBacked`, `workspaceKind`, normalized `ephemeralPath`) on glib sessions.
- Restored full-width diff reading after removing the hunk side-panel experiment.
- Fixed uncommitted diff packing for staged tracked files and untracked file content.
- Confirmed pi RPC CLI invocation (`pi --mode rpc --no-session`) and abort command schema (`{ type: "abort", id }` -> response event).
- Fixed pi RPC completion to wait for `agent_end` rather than `turn_end`, so final assistant text after tool calls is preserved.
- Added session resolver and session route regression coverage for explicit `projectPath` and stale index behavior.
- Updated promote diff API to return changed file metadata and updated the modal to support full-width review plus commit-all/selected flows.
- Added `Docs/session-smoke-test.md` as the short live validation checklist.
- Added GitHub device OAuth sign-in from Settings and app-managed GitHub token storage.
- Updated GitHub durable promote to use the app-managed token before env/`gh` fallbacks.
- Fixed GitHub durable + local ephemeral session start by fetching the remote baseline SHA before creating the local worktree/clone.
- Completed the live GitHub durable smoke path through session start, README edit, diff review, commit, push, and GitHub verification.
- Added structured session diff/promote errors and dirty durable repo blockers.
- Added local stash-and-continue plus local push support for upstream-backed local repos.
- Added route coverage for session promote errors, dirty repo blocking, git stash/push, and GitHub auth config failures.

## 1) Sandbox + pi RPC runtime

- Finish live authenticated smoke coverage for create/send/tool/final-answer/abort/delete against installed pi.
- Keep frontend `AgentEvent` contract untouched.
- Keep GitTrix storage/promote interfaces untouched.

## 2) Terminal WS

- Replace placeholder terminal transport with real `/api/term` websocket lifecycle.
- Add reconnect handling and explicit disconnected state in UI.
- Route terminal cwd through the active project or active GitTrix ephemeral workspace depending on context.

## 3) Attachments

- Implement upload/read/delete backend routes.
- Wire composer attachment selection + send payload.
- Decide persistence boundary for attachments: repo-local `.glib`, config dir, or session-scoped workspace.

## 4) Git mutations

- Complete remaining stage/unstage/discard/pull/checkout endpoints.
- Keep local commit/push behavior routed through GitTrix promote for session changes.
- Align frontend command actions to real route behavior.
- Ensure destructive actions have explicit confirmation/error surfaces.

## 5) Hunk-level context/promote

- Extend diff selection from file-level to hunk-level.
- Reuse the same selection primitive for context packing and session promote selectors.
- Keep file-level promote as the fallback for large or unsupported patches.

## 6) Reliability pass

- Add integration-level route tests for provider auth, live session create/send/stream, diff, promote, and session resolver fallback.
- Add multi-tab and reload regression coverage for session-id plus projectPath-scoped actions.
- Validate behavior across both hosts: Vite dev web and Electron shell.
- Add restart/recovery checks for session metadata, timeline persistence, and GitTrix workspace mapping.
- Add tests that assert agent cwd is the GitTrix ephemeral workspace once GitTrix reports `isGitBacked: true`.

## 7) Cloudflare Artifacts adapter

- Harden Cloudflare Artifacts error UX around missing account/token environment.

## 8) GitTrix UI polish

- Replace the current commit success overlay with a cleaner success receipt and clearer next action.
- Refine GitHub account/settings visuals now that avatar/account data is available.
- Make provider combinations and capabilities obvious before session start.
- Improve copy around local stash, local push, GitHub durable push, and no-upstream states.
