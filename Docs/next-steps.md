# Next Steps

Last updated: 2026-05-19

## Current shipped local loop

- Open/clone a local git repo.
- Review uncommitted or commit diffs without a provider key.
- Add provider API keys explicitly inside glib-code.
- Start pi-backed agent sessions paired with GitTrix metadata. Local GitTrix sessions use git-backed ephemeral workspaces when available; old/non-git sessions still fall back to durable repo cwd.
- Stream user/assistant/error/tool-call timeline events over SSE.
- Persist session documents and indexes with atomic writes and per-session/index write locks so concurrent tool/meta updates do not corrupt or drop events.
- Keep session send/stream/abort/hydrate/diff/promote actions scoped to `sessionId` plus active `projectPath` so reloads, project switches, and stale index state do not strand valid sessions.
- Reject concurrent sends for a session with a structured `TURN_ALREADY_RUNNING` response.
- Delete sessions from the sidebar/API with active-turn abort, runtime disposal, local session cleanup, and best-effort GitTrix workspace eviction.
- Export sessions as glib JSON, glib event JSONL, Markdown transcripts, or pi-compatible JSONL downloads.
- Preserve streamed assistant text chunks with collision-proof event IDs.
- Review session diffs and commit all or selected files back to the durable repo.
- Sign in with GitHub via device OAuth, select GitHub durable storage, and promote session changes as pushed commits.
- Local durable promote supports dirty-repo protection, stash-and-continue, and local push when the branch has an upstream.
- Settings → GitTrix exposes Local/GitHub durable choices, Local/Cloudflare Artifacts ephemeral choices, and the commit promote strategy; unsupported choices stay guarded by config/auth checks.
- Picker/sidebar UX keeps the global sidebar available on home, shows project sessions as soon as a project is selected, and uses a larger Diffs/Session mode chooser.
- Diff → session context currently packs the opened file or whole diff. Hunk/multi-file context payload plumbing exists in app state, but no active selector UI is wired into the current diff workbench.

## Development phases

### Phase 1: stabilize local/desktop loop

Goal: make the current local and desktop session workflow boring and reliable before adding more surface area.

Scope:

1. Finish live session smoke validation for reload/restart recovery after successful GitHub durable promote. ✅ Local/GitHub smoke path has passed; keep this checklist as the release gate.
2. Fix concrete reload/restart/session recovery bugs found by the smoke checklist. ✅ Session persistence races, concurrent sends, stale session routing, and delete/export paths are now hardened.
3. Add regression coverage for session-id plus `projectPath` routing, stale streams, duplicate creates, and recovery banners. ✅ Core route/session-store coverage exists; multi-tab/restart integration remains in the reliability pass.
4. Polish promote failure/success states only where they block clear recovery. ✅ Dirty repo, promote failure, stash/push, and baseline conflict surfaces are covered.

Exit criteria:

- `Docs/session-smoke-test.md` passes on local web and desktop dev.
- Reopened sessions can send, stream, diff, and promote after app refresh and backend restart.
- Stale sessions show one recoverable state, not timeline spam.
- Duplicate create/send attempts do not create duplicate sessions or concurrent turns.
- Session delete/export are available from the sidebar and stay scoped to the selected project/session.

### Phase 2: finish core product gaps

Goal: complete the missing local-product primitives after Phase 1 is stable.

Scope:

1. Terminal WebSocket transport (`/api/term`) and real terminal UI state.
2. Attachments API + composer integration (`/api/attachments`).
3. Remaining git mutation routes under `/api/git` (`stage`, `unstage`, `discard`, `pull`, `checkout`, branch operations).
4. Project/provider override UX, or remove the half-built override contract.

Exit criteria:

- Terminal connects to the correct durable repo or session workspace cwd and handles disconnect/reconnect.
- Attachments can be uploaded, referenced in sends, read, and deleted with a documented persistence boundary.
- Git command UI only exposes actions backed by real routes and explicit destructive confirmations.
- Provider/model override behavior is either persisted and visible or removed from API/docs.

### Later phases

- Phase 3: hunk/multi-file context selection and hunk-level promote.
- Phase 4: broader test hardening, restart/multi-tab behavior, release discipline.
- Phase 5: hosted/cloud architecture, desktop bridge, Cloudflare/GitTrix sync.

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
- Captured the latest external validation run under `suitener-results/`.
- Added shared atomic write helpers and moved session/settings/project/GitHub/pi auth JSON persistence onto atomic writes.
- Serialized session event/meta writes per session and serialized the global session index to prevent concurrent tool/meta write races.
- Added session-store concurrency regression tests.
- Added server-side concurrent-turn rejection with `TURN_ALREADY_RUNNING` and route coverage.
- Researched pi and opencode session/export formats; pi is JSONL session-header + message entries, while opencode is SQLite-backed and not a simple portable export target.
- Added backend session exports for glib JSON, glib event JSONL, Markdown, and pi-compatible JSONL.
- Added sidebar session delete/export UI, export downloads, local session cleanup, and active-session replacement behavior.
- Kept the sidebar visible/useful on the picker, hydrated selected-project sessions immediately, and enlarged the Diffs/Session chooser.
- Switched dev logs to human-readable output by default with `GLIB_LOG_JSON=1` for JSON logs.

## 1) Sandbox + pi RPC runtime

- Finish live authenticated smoke coverage for create/send/tool/final-answer/abort/delete/export against installed pi.
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

- Wire selection UI back into the current full-width diff workbench. `HunkList`/`SelectionTray` components and hunk-aware context payloads exist, but the active workbench only starts sessions from the opened file or whole diff.
- Extend diff selection from file-level to hunk-level without restoring the old side-panel that damaged readability.
- Reuse the same selection primitive for context packing and session promote selectors.
- Keep file-level promote as the fallback for large or unsupported patches.

## 6) Reliability pass

- Add integration-level route tests for provider auth, live session create/send/stream, diff, promote, and session resolver fallback.
- Add multi-tab and reload regression coverage for session-id plus projectPath-scoped actions.
- Validate behavior across both hosts: Vite dev web and Electron shell.
- Add restart/recovery checks for session metadata, timeline persistence, and GitTrix workspace mapping.
- Add tests that assert agent cwd is the GitTrix ephemeral workspace once GitTrix reports `isGitBacked: true`.
- Add browser-level checks for sidebar delete/export downloads and project-picker/sidebar state.

## 7) Cloudflare Artifacts adapter

- Harden Cloudflare Artifacts error UX around missing account/token environment.

## 8) GitTrix UI polish

- Replace the current commit success overlay with a cleaner success receipt and clearer next action.
- Refine GitHub account/settings visuals now that avatar/account data is available.
- Make provider combinations and capabilities obvious before session start.
- Improve copy around local stash, local push, GitHub durable push, and no-upstream states.
