# Sessions Plan

Six-session plan to close out the remaining work on glib-code. Grounded in actual codebase state as of 2026-06-22.

---

## Session 1 — Session list polish + contract docs + path tests

Quick wins. No architectural changes.

### 1a. Polish session list presentation (picker vs sidebar)

The picker (`RecentList.vue`) and sidebar (`LeftSidebar.vue`) render the same session data with inconsistent presentation.

- **Timestamp opacity:** picker `text-muted-foreground/75` (RecentList.vue:126) vs sidebar `/70` (LeftSidebar.vue:57, 104). Align to `/70`.
- **Status field:** picker's session data type includes `status` (RecentList.vue:157) but template never renders it. Sidebar renders a colored dot. Add status dot to picker session rows.
- **Title line-height:** picker inherits default leading, sidebar forces `leading-none`. Align to `leading-none`.
- **"Show more" control:** picker is full-width bordered button at 11px, sidebar is tiny unbordered inline link at 10px. Keep picker's bordered style (modal surface), upgrade sidebar's to 11px typography.
- **Deduplicate `canonicalizePath`:** three copies (usePickerSessions.ts:14, RecentList.vue:231, LeftSidebar.vue:268). Export from `usePickerSessions.ts`, import in both components.

### 1b. Document `/api/sessions` contract

- `GET /api/sessions` — scoped to `getCurrentProjectId()`. Returns `[]` if no project.
- `GET /api/sessions?scope=all` — aggregates across current project + registered projects + recents. No pagination.
- Query param `projectPath` accepted on many sub-routes as override.

Write into `Docs/api-contracts.md` (new file).

### 1c. Path normalization tests

After dedup in 1a, test the single `canonicalizeProjectPath` export. Edge cases: drive casing, slash style, trailing slash, mixed.

Test file: `web/src/composables/usePickerSessions.test.ts`.

### 1d. `/api/fs/paths` endpoint tests

Endpoint at `server/src/routes/fs.ts:111-117` calls `flattenPaths` which recursively walks, skipping `.git` and `.glib`. Tests: skip dirs, trailing `/` on directories, empty repo, nested flatten.

Test file: `server/src/routes/fs.test.ts` (new).

### 1e. Session-index hygiene

Index (`sessions-index.json`) only self-heals lazily in `getSessionById`. Add startup reconciliation sweep that walks the index, removes entries whose session files no longer exist. Gate behind once-per-boot flag.

File: `server/src/services/session-store.ts` (add `pruneStaleIndexEntries()` called from `index.ts` boot).

### Verification
- `bun run --cwd web check && bun run --cwd server check`
- `bun run --cwd web build && bun run --cwd server build`
- `bun test`
- Manual: picker and sidebar visual consistency

---

## Session 2 — Diff workbench + hunk selection + file tree

Frontend-heavy. The data model for hunks/multi-file already exists end-to-end — only the producer UI is missing. May split into 2a/2b.

### 2a. Widen DiffWorkbench emit + multi-file selection

- `DiffWorkbench.vue:330` emits `{ source; ref?; file? }`. Widen to include `files?: string[]` and `hunks?`.
- File picker dropdown (DiffWorkbench.vue:109-176) only single-select. Add checkboxes, `selectedFiles` state.
- `emitStartSessionFromDiff()` (DiffWorkbench.vue:838-845) sends `files` array.

### 2b. Hunk selection UI

- `DiffView.vue` (shared, 139 lines) is purely presentational. Add `@hunk-toggle` emit on `@@` header click.
- `DiffWorkbench.vue` tracks `selectedHunksByFile`.
- Selected hunks highlighted, unselected dimmed.
- Same pattern in promote dialog (`App.vue:334-456`) — currently file-level checkboxes only. Add hunk-level via `MultiDiffView` or new `SelectableMultiDiffView`.

### 2c. sessionDiff.focusFile → pierre file navigation

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
- Manual: select hunks → start session → confirm chips
- Manual: select hunks in promote → promote → confirm scoped
- Manual: `-N +N` badge → overlay scrolls to file
- Manual: file tree click → diff opens

---

## Session 3 — Project scope model fix

Architectural. The server's `currentProjectId` is a module-level singleton (`project-store.ts:33-37`). Highest leverage, highest risk.

### 3a. Eliminate silent global fallbacks

Make `projectPath` required on all routes that currently fall back to the global:

- `routes/fs.ts:102,113,119` — `activeProjectPath()` → require `?projectPath=`
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
- Manual: no providers → palette disables `session.new`
- Manual: turn timeout → timeline shows timeout
- Manual: diff patch headers show real filenames

---

## Session 5 — Scale + perf + branch compare + git UX

Backend perf + missing git features.

### 5a. Optimize scope=all aggregation

`listSessionsAcrossProjects` (sessions.ts:36-58) reads every session JSON on every call + re-indexes (N disk writes). Cache listing 10s TTL + invalidation on create/delete. Stop re-indexing in `listSessions` — move to background sweep. Build `updatedAt` into index for cheap sorting.

### 5b. Pagination for scope=all

Add `?limit=` and `?offset=`. Default 50. Return `{ sessions, total, hasMore }` or `X-Total-Count` header.

### 5c. Implement /api/diff/branch-compare

Stub returns 501 (diff.ts:41). Implement `git diff base...head`. Reuse `diffFiles`/`diffHunks`/`packDiff`. Update `/sources` to `branches: { enabled: true }`.

### 5d. Harden FS for large repos + binary files

- `flattenPaths`: use `git ls-files` instead of manual walk (git-aware, skips ignored). Max path count 10,000 with truncation.
- `/fs/read`: size limit 1MB, binary detection (null bytes in first 8KB), return `{ ok: false, binary: true }` for binaries.

### 5e. Inline commit-detail in history rows

Currently modal only (DiffWorkbench.vue:267, 272-288). Add inline expandable row: click → expand author/date/subject/files inline. Keep modal for full detail.

### 5f. Branch management surface

Only free-text checkout input exists (DiffWorkbench.vue:226-237). `GET /git/branches` exists but unused. Add branch dropdown, switch/create, current-branch indicator.

### 5g. Structured pull-conflict rendering

`describeGitError` (DiffWorkbench.vue:447-455) flattens to comma-joined string. Replace with structured modal (like promote `BASELINE_CONFLICT` at App.vue:472-484): list conflicted files with click-to-open-diff, abort/continue guidance.

### Verification
- `bun run check && bun run build && bun test`
- Manual: large repo file tree loads fast
- Manual: branch compare renders
- Manual: pull conflict → structured modal with file links
- Manual: inline commit detail expansion

---

## Session 6 — Agent file tree wiring

Single focused change. Everything downstream is already wired.

### 6a. Add resultType:'tree' branch to classifyToolResult

`agent-runtime.ts:326-401` has branches for error/diff/json/code/terminal but no tree. Add:

```ts
if (result.details?.tree) {
  const tree = result.details.tree as { paths?: string[]; gitStatus?: Record<string,string> };
  if (Array.isArray(tree.paths)) {
    return {
      output: raw,
      resultType: 'tree',
      summary: `${tree.paths.length} paths`,
      artifact: { tree: { paths: tree.paths, gitStatus: tree.gitStatus ?? {} } }
    };
  }
}
```

### 6b. Convention for pi tool result payload

Either pi ships a built-in `list_files`/`tree` tool with `details.tree`, or this repo defines a custom tool (no tool-definition infrastructure exists yet). Ship the `classifyToolResult` branch now; pi tool added whenever.

### 6c. Export parity

`session-export.ts:67, 121-137` drops `artifact` and `resultType`. Add them so tree artifacts survive markdown/pi-jsonl export.

### 6d. Scope contract

Per `Docs/Frontend.md:161-165`, agent trees should be scoped (touched paths + ancestors). If pi can compute scoped set, send in `details.tree.paths`. Otherwise ship unscoped, add scoping later.

### Verification
- `bun run check && bun run build`
- Manual: agent tool emits tree → renders in timeline via FileTreeView
- Manual: export session → tree artifact survives

---

## Dependencies

```
Session 1 (no deps) ──┐
                      ├──► Session 2 (uses shared/ extract from 2f)
Session 3 (no deps) ──┘    │
                          ├──► Session 4 (4g = 2f; 4f same area)
                          │
                          ├──► Session 5 (5a uses index prune from 1e)
                          │
                          └──► Session 6 (no deps, benefits from 2f)
```

- Sessions 1 and 3 can run in parallel.
- Session 2 should follow 1.
- Session 4 should follow 2 and 3.
- Session 5 should follow 1.
- Session 6 is independent.

## Done this sitting
- Session 1 (all sub-tasks)
- Session 6 (6a + 6c)
