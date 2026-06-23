# Sessions Plan

All planned sessions complete. Grounded in actual codebase state as of 2026-06-23.

---

## Done
- Session 1: session list polish, API contracts, path/fs tests, session-index prune
- Session 2: diff workbench multi-file + per-file hunk selection (FileList checkboxes, HunkList, SelectionTray wired); widened startSessionFromDiff payload; SessionDiffOverlay file-list sidebar + focusFile refocus; FileTreeView path-click to open diff (via @pierre/trees onSelectionChange); extracted detailsDiffToUnifiedPatch to shared/src/diff/detailsToPatch.ts (server + web)
- Session 3 — project scope model fix (complete):
  - 3a (staged, 3 commits): (1) frontend `useApiClient` always injects `projectPath` into scoped requests (idempotent, skips self-resolving routes), with injection unit tests; (2) backend `git.ts`/`diff.ts`/`fs.ts`/`open.ts`/`sessions.ts`/`agent.ts` honor `projectPath` first; (3) strict flip via `fallbackProjectPath()` — explicit `projectPath` always wins, global fallback only when exactly one project is registered (single-client/desktop), so 2+ projects without `projectPath` refuse to guess. Eliminates cross-tab contamination. Tests updated for explicit scoping.
  - 3b + 3c: persist per-project provider/model overrides to `<configDir>/project-overrides.json` with patch/clear semantics + boot load; `GET /api/projects/:id/provider` returns override/defaults/effective; Settings → Models "Project override" section; project-store persistence tests.
  - 3d: scoping is by `path` (always correct); client `activeSessionIdByProject` id-map is internally consistent; override UX degrades gracefully when a project lacks a server id.
- Session 4 — capability gating + runtime hygiene (complete):
  - 4a: palette commands carry `disabled`/`disabledReason`; `session.new` disabled when no authed providers, `mode.diff`/`mode.session` disabled when no project open; CommandPalette renders disabled rows muted with reason sub-line and blocks click; `runPalette` defensive guard. (4c per-turn timeout dropped — provider/pi already handle long runs.)
  - 4b: verified clean — only mock/demo refs are in test files + intentional `?demo=onboarding` dev flag; `/api/diff/branch-compare` 501 was the documented stub for Session 5c.
  - 4d: `GET /api/sessions` logs scope/projectCount/sessionCount/latencyMs via `log("server", ...)`.
  - 4e: readiness caches git/pi/gh version strings separately (1h TTL, parallel `Promise.all` fetch); 30s readiness cache reuses cached versions on recompute.
  - 4f: `classifyToolResult` takes tool `input` as third arg; falls back to `input.filePath`/`input.path` when `result.details.filePath` is empty, matching App.vue:1321.
  - Test runner fix: root `test` script runs `bun test shared server desktop` + `bun run --cwd web test` (Vitest with jsdom) separately. All 212 tests green.
- Session 5 — scale + perf + branch compare + git UX (complete):
  - 5a: `listSessions` no longer re-indexes every session on every call (removed N disk writes); `listSessionsAcrossProjects` cached 10s TTL with invalidation on create/delete/fork via `invalidateSessionListCache()` (called from sessions.ts + agent.ts).
  - 5b: `GET /api/sessions?scope=all` supports `?limit=` + `?offset=` with `X-Total-Count` + `X-Has-More` headers. Without limit/offset returns full array (backward compatible).
  - 5c: `/api/diff/branch-compare` implemented — `git diff base...head` via `branchCompare()` which validates both refs, reuses `packDiff("branches", "base...head")`. `diffFiles`/`diffHunks`/`packDiff` all handle `source="branches"` with `ref="base...head"`. `/sources` flips `branches.enabled` to true.
  - 5d: `flattenPaths` uses `git ls-files` (git-aware, skips ignored) with 10k path cap + truncation; falls back to manual walk if git fails. `/fs/read` enforces 1MB size limit (413) and binary detection (null bytes in first 8KB → `{ ok: false, binary: true }`).
  - 5e: inline expandable commit detail in history view — "Detail" button toggles inline panel with sha/author/date/subject/files; "Full detail" button opens the existing modal.
  - 5f: branch dropdown in working view — loads `GET /git/branches`, shows current-branch indicator on the Branch button, lists branches with switch-on-click, keeps free-text checkout input below.
  - 5g: `describeGitError` no longer flattens PULL_CONFLICT/DIRTY_TREE to comma strings; opens structured modals with file list, click-to-open-diff for pull conflicts, abort-merge button, close. Matches promote `BASELINE_CONFLICT` pattern.
- Session 6: agent file tree wiring (classifyToolResult tree branch + export parity)
- Onboarding tier 1+2+3: interactive signin cards, focus trap, readiness warnings, post-onboarding hint, corrupted flag file handling, update prompt z-index, docs update
