# Sessions Plan

Remaining work on glib-code. Sessions 1 and 6 are done. Grounded in actual codebase state as of 2026-06-22.

---

## Session 2 — Diff workbench + hunk selection + file tree

Frontend-heavy. The data model for hunks/multi-file already exists end-to-end. Only the producer UI is missing. May split into 2a/2b.

### 2a. Widen DiffWorkbench emit + multi-file selection

- `DiffWorkbench.vue:330` emits `{ source; ref?; file? }`. Widen to include `files?: string[]` and `hunks?`.
- File picker dropdown (DiffWorkbench.vue:109-176) only single-select. Add checkboxes, `selectedFiles` state.
- `emitStartSessionFromDiff()` (DiffWorkbench.vue:838-845) sends `files` array.

### 2b. Hunk selection UI

- `DiffView.vue` (shared, 139 lines) is purely presentational. Add `@hunk-toggle` emit on `@@` header click.
- `DiffWorkbench.vue` tracks `selectedHunksByFile`.
- Selected hunks highlighted, unselected dimmed.
- Same pattern in promote dialog (`App.vue:334-456`). Currently file-level checkboxes only. Add hunk-level via `MultiDiffView` or new `SelectableMultiDiffView`.

### 2c. sessionDiff.focusFile to pierre file navigation

`SessionDiffOverlay.vue:149-159` only sets `selectedIndex`. Add DOM-level scroll to file header (`diff --git a/<file>`) via `scrollIntoView()`.

### 2d. SessionDiffOverlay file list sidebar

Split/unified toggle exists (lines 59-68). Missing: persistent file list sidebar. Add left sidebar listing `filePatches` with click-to-select.

### 2e. File tree click-to-open-diff

`FileTreeView.vue` has no click handlers, no emits. Add DOM-level click listener on `containerRef` mapping rows to paths. New `@path-click` emit. Wire in `Timeline.vue:114-121`.

Risk: `@pierre/trees` may not expose row DOM with path attributes. Inspect rendered HTML structure first.

### 2f. Extract detailsDiffToUnifiedPatch to shared/

Server: `agent-runtime.ts:274-324`. Web: `App.vue:1255-1311`. Create `shared/src/diff/detailsToPatch.ts`. Align the `|| "file"` fallback divergence.

### Verification
- `bun run check && bun run build`
- Manual: select hunks then start session then confirm chips
- Manual: select hunks in promote then promote then confirm scoped
- Manual: `-N +N` badge scrolls overlay to file
- Manual: file tree click opens diff

---

## Session 3 — Project scope model fix

Architectural. The server's `currentProjectId` is a module-level singleton (`project-store.ts:33-37`). Highest leverage, highest risk.

### 3a. Eliminate silent global fallbacks

Make `projectPath` required on all routes that currently fall back to the global:

- `routes/fs.ts:102,113,119` — `activeProjectPath()` to require `?projectPath=`
- `routes/open.ts:115` — same
- `routes/agent.ts:80` (`mustProject`) — require `projectPath` in body
- `routes/sessions.ts:31` (`mustProject`) — require `?projectPath=`
- `services/git.ts:7` (`activeRepo`) — require `projectPath` arg
- `services/diff.ts:8` (`repoPath`) — require `projectPath` arg
- `services/session-resolver.ts:15` (`currentProject()`) — require `projectPath` arg

Keep `setCurrentProject` for desktop single-client convenience. Routes without `projectPath` return 400.

Frontend: update all API calls to include `projectPath` from `currentProject.value?.path`.

### 3b. Persist project provider/model overrides

`projectOverrides` Map (project-store.ts:30) is in-memory only. Persist to `<configDir>/project-overrides.json`. Load on boot.

### 3c. Project-level provider/model override UX

Backend `PATCH /api/projects/:id/provider` exists. Frontend needs: UI to set per-project provider/model, "Effective" label showing `override ?? default`, badge when override active.

### 3d. Project browsing beyond single-global

With 3a done, frontend browses multiple projects without server tracking a global. Remove remaining single-project UI assumptions.

### Verification
- `bun run check && bun run build && bun test`
- Manual: two browser tabs, different projects, no cross-contamination
- Manual: project override persists across restart
- Manual: effective provider/model label correct

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

If not done in Session 2f, do here.

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
Session 2 (no deps, benefits from shared/ extract in 2f)
   |
   ├──► Session 4 (4g = 2f; 4f same area)
   |
   ├──► Session 5 (5a uses index prune from session 1, already done)
   |
   └──► Session 3 (independent, can run any time)
```

- Session 2 should run next (no deps).
- Session 3 is independent, can run in parallel with 2.
- Session 4 should follow 2 and 3.
- Session 5 should follow 2 (uses shared patterns).

## Done
- Session 1: session list polish, API contracts, path/fs tests, session-index prune
- Session 6: agent file tree wiring (classifyToolResult tree branch + export parity)
- Onboarding tier 1+2+3: interactive signin cards, focus trap, readiness warnings, post-onboarding hint, corrupted flag file handling, update prompt z-index, docs update
