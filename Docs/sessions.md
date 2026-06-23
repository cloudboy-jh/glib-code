# Sessions Plan

Remaining work on glib-code. Sessions 1 and 6 are done. Grounded in actual codebase state as of 2026-06-22.

---

## Session 3 — Project scope model fix

Architectural. The server's `currentProjectId` is a module-level singleton (`project-store.ts:33-37`). Highest leverage, highest risk.

### 3a. Eliminate silent global fallbacks — staged, not big-bang

Strategy: frontend always sends `projectPath` first (low risk), then backend honors it,
then backend goes strict. Each step is its own commit + green check/build/test.

Step 1 — Frontend central injection (low risk):
- `useApiClient`: inject `projectPath` into GET/DELETE query + POST/PATCH body when a
  project context is present. Provide `currentProject.value?.path` to the client.
- Ship while backend is still lenient; verify nothing breaks.

Step 2 — Backend honors `projectPath` first, global fallback retained (medium risk):
- `services/git.ts` `activeRepo()`/`getGit()` — accept `projectPath?`, prefer arg.
  Thread through every exported git fn (backs all `git-routes.ts`).
- `services/diff.ts` `repoPath(projectPath?)` — already has fallback; verify callers pass it.
- `routes/fs.ts` + `routes/open.ts` `activeProjectPath()` — read `?projectPath=` first.
- `routes/sessions.ts` + `routes/agent.ts` `mustProject()` — accept `projectPath` first.
- `services/session-resolver.ts` `currentProject()` — keep; callers prefer explicit path.

Step 3 — Flip to strict (highest risk):
- Routes return 400 `PROJECT_PATH_REQUIRED` when `projectPath` absent AND no global set.
  Keep global fallback only for desktop single-client path.
- Update tests that rely on the global: `fs.test`, `session-routes.test`,
  `git-routes.test`, `session-resolver.test` — pass `projectPath` explicitly.

### 3d. Project browsing beyond single-global

Audit App.vue single-project assumptions (the `id || normalizedPath` fallback in
`openProject`, session-list logic that ignores `projectPath`). Verify two-tab scenario.

### Verification
- `bun run check && bun run build && bun test` (server: `bun test server/src`; web: vitest)
- Manual: two browser tabs, different projects, run agent + diff in each, no cross-contamination

Note: 3b (persist overrides) and 3c (override UX) are done — see Done section. Only 3a/3d remain.

---

## Session 4 — Capability gating + runtime hygiene

Mixed frontend/backend. No architectural changes.

### 4a. Command palette capability gating

`paletteCommands` (App.vue:868-875) is hardcoded with no `disabled` flag. Extend type to `{ id; label; disabled?; disabledReason? }`. Compute disabled per command: `session.new` disabled if no authed providers, `mode.session`/`mode.diff` disabled if no project, `terminal.toggle` disabled if term capability missing.

### 4b. Remove remaining mock-only critical workflow paths

Frontend is clean (only test mocks + demo recents). Verify server-side: `/api/diff/branch-compare` stub already 501s clearly. No action unless other mocks found.

### 4c. Per-turn timeout handling

`runTurn` (agent-runtime.ts:743-850) has no deadline. Add `turnTimeoutMs` setting (default 300000). Wrap `promptRuntime` with `AbortSignal.timeout`. On timeout: emit `turn_end` with `reason: "timeout"`, call `pi.abort()`. Frontend renders timeout in timeline.

### 4d. Telemetry for session-list fetch latency

Add timing to `GET /api/sessions` + `scope=all`. Log route, scope, project count, session count, latency ms.

### 4e. Readiness checks fast + cached

`/api/readiness` caches 30s. `getPiCapabilities()` caches 15s. But `run()` calls for git/pi/gh versions shell out every time. Cache version strings with long TTL (they don't change per-process).

### 4f. Verify details.filePath populated

`classifyToolResult` (agent-runtime.ts:349) reads `result.details.filePath` from pi. If empty, patch headers show "file". Pass tool input's `filePath`/`path` field as fallback (web side already does this at App.vue:1325).

### 4g. Extract detailsDiffToUnifiedPatch to shared/

Done in Session 2 — `shared/src/diff/detailsToPatch.ts` now backs both server and web. Nothing left here.

### Verification
- `bun run check && bun run build && bun test`
- Manual: no providers then palette disables `session.new`
- Manual: turn timeout then timeline shows timeout
- Manual: diff patch headers show real filenames

---

## Session 5 — Scale + perf + branch compare + git UX

Backend perf + missing git features.

### 5a. Optimize scope=all aggregation

`listSessionsAcrossProjects` (sessions.ts:36-58) reads every session JSON on every call + re-indexes (N disk writes). Cache listing 10s TTL + invalidation on create/delete. Stop re-indexing in `listSessions`. Move to background sweep. Build `updatedAt` into index for cheap sorting.

### 5b. Pagination for scope=all

Add `?limit=` and `?offset=`. Default 50. Return `{ sessions, total, hasMore }` or `X-Total-Count` header.

### 5c. Implement /api/diff/branch-compare

Stub returns 501 (diff.ts:41). Implement `git diff base...head`. Reuse `diffFiles`/`diffHunks`/`packDiff`. Update `/sources` to `branches: { enabled: true }`.

### 5d. Harden FS for large repos + binary files

- `flattenPaths`: use `git ls-files` instead of manual walk (git-aware, skips ignored). Max path count 10,000 with truncation.
- `/fs/read`: size limit 1MB, binary detection (null bytes in first 8KB), return `{ ok: false, binary: true }` for binaries.

### 5e. Inline commit-detail in history rows

Currently modal only (DiffWorkbench.vue:267, 272-288). Add inline expandable row: click to expand author/date/subject/files inline. Keep modal for full detail.

### 5f. Branch management surface

Only free-text checkout input exists (DiffWorkbench.vue:226-237). `GET /git/branches` exists but unused. Add branch dropdown, switch/create, current-branch indicator.

### 5g. Structured pull-conflict rendering

`describeGitError` (DiffWorkbench.vue:447-455) flattens to comma-joined string. Replace with structured modal (like promote `BASELINE_CONFLICT` at App.vue:472-484): list conflicted files with click-to-open-diff, abort/continue guidance.

### Verification
- `bun run check && bun run build && bun test`
- Manual: large repo file tree loads fast
- Manual: branch compare renders
- Manual: pull conflict shows structured modal with file links
- Manual: inline commit detail expansion

---

## Dependencies

```
Session 3 (independent, can run any time)
Session 4 (4g done in Session 2; 4f shares the classifyToolResult area)
Session 5 (5a uses index prune from session 1, already done)
```

- Session 3 is independent and can run next.
- Session 4 follows 3.
- Session 5 reuses the shared diff patterns from Session 2.

## Done
- Session 1: session list polish, API contracts, path/fs tests, session-index prune
- Session 2: diff workbench multi-file + per-file hunk selection (FileList checkboxes, HunkList, SelectionTray wired); widened startSessionFromDiff payload; SessionDiffOverlay file-list sidebar + focusFile refocus; FileTreeView path-click to open diff (via @pierre/trees onSelectionChange); extracted detailsDiffToUnifiedPatch to shared/src/diff/detailsToPatch.ts (server + web)
- Session 3 (partial — 3b + 3c): persist per-project provider/model overrides to `<configDir>/project-overrides.json` with patch/clear semantics + boot load (`loadProjectOverrides`); `GET /api/projects/:id/provider` returns override/defaults/effective; Settings → Models "Project override" section (effective label, active badge, pin-current-default, clear); project-store persistence tests. 3a (eliminate global fallbacks) + 3d still pending.
- Session 6: agent file tree wiring (classifyToolResult tree branch + export parity)
- Onboarding tier 1+2+3: interactive signin cards, focus trap, readiness warnings, post-onboarding hint, corrupted flag file handling, update prompt z-index, docs update
