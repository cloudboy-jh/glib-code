# Sessions Plan

Remaining work on glib-code. Sessions 1, 2, 3, 4, and 6 are done. Grounded in actual codebase state as of 2026-06-23.

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
Session 5 (5a uses index prune from session 1, already done; reuses shared diff patterns from Session 2)
```

- Session 5 can run next.

## Done
- Session 1: session list polish, API contracts, path/fs tests, session-index prune
- Session 2: diff workbench multi-file + per-file hunk selection (FileList checkboxes, HunkList, SelectionTray wired); widened startSessionFromDiff payload; SessionDiffOverlay file-list sidebar + focusFile refocus; FileTreeView path-click to open diff (via @pierre/trees onSelectionChange); extracted detailsDiffToUnifiedPatch to shared/src/diff/detailsToPatch.ts (server + web)
- Session 3 — project scope model fix (complete):
  - 3a (staged, 3 commits): (1) frontend `useApiClient` always injects `projectPath` into scoped requests (idempotent, skips self-resolving routes), with injection unit tests; (2) backend `git.ts`/`diff.ts`/`fs.ts`/`open.ts`/`sessions.ts`/`agent.ts` honor `projectPath` first; (3) strict flip via `fallbackProjectPath()` — explicit `projectPath` always wins, global fallback only when exactly one project is registered (single-client/desktop), so 2+ projects without `projectPath` refuse to guess. Eliminates cross-tab contamination. Tests updated for explicit scoping.
  - 3b + 3c: persist per-project provider/model overrides to `<configDir>/project-overrides.json` with patch/clear semantics + boot load; `GET /api/projects/:id/provider` returns override/defaults/effective; Settings → Models "Project override" section; project-store persistence tests.
  - 3d: scoping is by `path` (always correct); client `activeSessionIdByProject` id-map is internally consistent; override UX degrades gracefully when a project lacks a server id.
- Session 4 — capability gating + runtime hygiene (complete):
  - 4a: palette commands carry `disabled`/`disabledReason`; `session.new` disabled when no authed providers, `mode.diff`/`mode.session` disabled when no project open; CommandPalette renders disabled rows muted with reason sub-line and blocks click; `runPalette` defensive guard. (4c per-turn timeout dropped — provider/pi already handle long runs.)
  - 4b: verified clean — only mock/demo refs are in test files + intentional `?demo=onboarding` dev flag; `/api/diff/branch-compare` 501 is the documented stub for Session 5c.
  - 4d: `GET /api/sessions` logs scope/projectCount/sessionCount/latencyMs via `log("server", ...)`.
  - 4e: readiness caches git/pi/gh version strings separately (1h TTL, parallel `Promise.all` fetch); 30s readiness cache reuses cached versions on recompute.
  - 4f: `classifyToolResult` takes tool `input` as third arg; falls back to `input.filePath`/`input.path` when `result.details.filePath` is empty, matching App.vue:1321.
  - Test runner fix: root `test` script runs `bun test shared server desktop` + `bun run --cwd web test` (Vitest with jsdom) separately. All 212 tests green.
- Session 6: agent file tree wiring (classifyToolResult tree branch + export parity)
- Onboarding tier 1+2+3: interactive signin cards, focus trap, readiness warnings, post-onboarding hint, corrupted flag file handling, update prompt z-index, docs update
