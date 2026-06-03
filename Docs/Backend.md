# Backend (Current Implementation)

Last updated: 2026-06-03

For product-level topology and runtime/storage boundaries, see `Docs/Architecture.md`. This document covers backend route and service implementation details.

## Server entry

- File: `server/src/index.ts`
- Runtime: Bun + Hono
- Default dev port: `4273` (supports `--port=`)
- API route mounting lives in `server/src/routes/index.ts`.
- Mounted route groups:
  - `/api/readiness`
  - `/api/health`
  - `/api/auth`
  - `/api/projects`
  - `/api/repo`
  - `/api/diff`
  - `/api/git`
  - `/api/fs`
  - `/api/agent`
  - `/api/sessions`
  - `/api/settings`
  - `/api/keybindings`
  - `/api/attachments`
  - `/api/term`
  - `/api/providers`

## Implemented routes

### Readiness

- `GET /api/readiness`
- Checks:
  - `git --version`
  - pi/provider capability availability
  - `gh --version`
- 30s in-memory cache.
- Uses shared schema type `ReadinessReport` from `shared/src/schemas/readiness.ts`.
- Provider readiness is derived from pi capability discovery.

### Providers

- `GET /api/providers`
- `PATCH /api/providers/defaults`
- `POST /api/providers/:id/auth`
- `DELETE /api/providers/:id/auth`

Behavior:

- Backed by pi capability discovery service.
- Returns dynamic provider/model availability and current backend-selected defaults.
- No static provider/model catalog in backend.
- Provider keys are managed through in-app provider auth routes and stored under `<configDir>/pi/auth.json`.
- Unsupported OAuth credentials are rejected as unusable for providers that require API keys.

### Health

- `GET /api/health`
- Returns `{ ok, uptimeMs, now }`.

### Projects

- `GET /api/projects/recents`
- `GET /api/projects/candidates?q=...`
- `GET /api/projects/recents/status`
- `POST /api/projects/open`
- `POST /api/projects/init`
- `POST /api/projects/create`
- `DELETE /api/projects/recents/:id`
- `POST /api/projects/recents/:id/forget`
- `PATCH /api/projects/:id/provider`

Behavior:

- Recents persisted in config dir (`recents.json`), max 20.
- Project id = SHA1 hash of resolved path (12 chars).
- `open` returns `{ needsInit: true }` if no `.git`.
- `create` writes a starter `.gitignore` and creates `.glib/.gitignore`.
- `candidates` searches likely local project paths for picker autocomplete.
- Project provider/model overrides are validated against pi capabilities and stored in process memory for session creation. Frontend override UX is not wired yet.

### Repo

- `GET /api/repo/current`
- `POST /api/repo/switch`

Current project is in-memory only (server process scoped).

### Diff

- `GET /api/diff/sources`
- `GET /api/diff/items`
- `GET /api/diff/files`
- `GET /api/diff/hunks`
- `POST /api/diff/pack`
- `POST /api/diff/branch-compare` (501, UI-inaccessible in v1)

Current behavior:

- Fully implemented for `uncommitted` and `commits`.
- `branches` and `prs` sources are listed as disabled because branch compare/source-control support is not implemented.
- `pack` returns full patch + simple stats `{ files, hunks, additions, deletions }`.
- `uncommitted` packing uses `git diff HEAD` so staged tracked changes are included.
- Untracked file packing synthesizes a new-file diff so selected untracked file content can be shown and sent as context.

### Git

Implemented:

- `GET /api/git/status`
- `GET /api/git/branches`
- `GET /api/git/log`
- `POST /api/git/push`
- `POST /api/git/stash`
- `POST /api/git/stage`
- `POST /api/git/unstage`
- `POST /api/git/discard`
- `POST /api/git/commit`
- `POST /api/git/pull`
- `POST /api/git/checkout`
- `POST /api/git/branches` (create branch)
- `GET /api/git/commit/:sha`

Behavior:

- `status` includes upstream, ahead/behind, dirty file buckets, and `canPush`.
- `push` requires an upstream-backed branch and returns branch/upstream/SHA metadata.
- `stash` ignores `.glib/` changes, includes untracked files, and returns `stash@{0}` when it creates a new stash.
- stage/commit/discard operations reject protected `.glib/**` paths.
- checkout rejects over a dirty working tree with structured `DIRTY_TREE` payload.
- pull returns structured `NO_UPSTREAM`, `DETACHED_HEAD`, or `PULL_CONFLICT` payloads.

### FS

- `GET /api/fs/tree?path=...`
- `GET /api/fs/paths`
- `GET /api/fs/read?path=...`

Notes:

- `tree` returns nested `{ name, path, type, children }` JSON.
- `paths` returns flat `{ ok: true, paths: string[] }` of relative paths for the file tree component. Directories get a trailing `/`. Excludes `.git` and `.glib/`.
- Path escape blocked by `inRepo()` check.
- `.git` and `.glib/` directories hidden from tree/paths listings.
- Read returns UTF-8 only today.

### Settings

- `GET /api/settings`
- `PATCH /api/settings`
- `POST /api/settings/reset`

Stored in config dir `settings.json`.

### Keybindings

- `GET /api/keybindings`
- `PUT /api/keybindings`
- `POST /api/keybindings/reset`

Stored in config dir `keybindings.json`.

### Auth

- `GET /api/auth/session` returns GitHub auth status and account info when available.
- `POST /api/auth/github` verifies that a GitHub token is available for GitTrix GitHub durable operations.
- `POST /api/auth/github/device/start` starts GitHub device OAuth. Requires `GITHUB_OAUTH_CLIENT_ID` or `GH_OAUTH_CLIENT_ID`.
- `POST /api/auth/github/device/poll` exchanges an approved device code and stores the token under app config.
- `DELETE /api/auth/github` clears app-managed GitHub auth.
- `POST /api/auth/signout` clears app-managed GitHub auth and returns `{ ok: true }`.

GitHub token resolution order for durable GitHub operations:

1. App-managed token at `<configDir>/auth/github.json`.
2. `GITHUB_TOKEN` or `GH_TOKEN` environment variable.
3. `gh auth token`.

## Session + agent routes

- `/api/agent/*` is implemented for create/send/stream/abort/delete.
- `/api/sessions/*` is implemented for list/read/fork/delete/patch plus GitTrix diff/promote/evict.
- Session metadata is stored under repo-local `.glib/sessions` and includes GitTrix mapping in `SessionMeta`.
- Session IDs are indexed in app config (`sessions-index.json`). Session routes resolve by index first, then requested `projectPath`, then current project fallback.
- Frontend sends `projectPath` on session-scoped calls to avoid stream/send failures when current-project state or the index drifts.
- `server/src/services/session-resolver.ts` centralizes session lookup, path normalization, and durable cwd fallback decisions.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/agent/sessions` | Create a new agent session and initialize matching GitTrix session metadata. |
| `POST` | `/api/agent/sessions/:id/send` | Persist user turn, broadcast it, and run pi through the configured runtime. Body includes `prompt`, optional context/attachments, and `projectPath`. |
| `GET` | `/api/agent/sessions/:id/stream?projectPath=...` | Replay + stream canonical agent events over SSE. |
| `DELETE` | `/api/agent/sessions/:id/turn?projectPath=...` | Abort the active turn. |
| `GET` | `/api/sessions` | List active sessions for the current project. Joins glib session metadata with `gittrix.listSessions()`. |
| `GET` | `/api/sessions/:id?projectPath=...` | Get session detail and metadata. |
| `GET` | `/api/sessions/:id/diff?projectPath=...` | Return full unified diff plus changed file metadata from GitTrix ephemeral vs durable baseline. |
| `POST` | `/api/sessions/:id/promote?projectPath=...` | Promote selected changes to durable. On baseline drift, returns 409 with structured conflict payload. |
| `POST` | `/api/sessions/:id/evict` | Force-evict the GitTrix session workspace. |

## GitTrix service

`server/src/services/gittrix-service.ts` is the single owner of the `GitTrix` instance. Route handlers do not instantiate `GitTrix` directly.

Responsibilities:

- Create and hold singleton `GitTrix` instances keyed by project, branch, durable provider, and ephemeral provider.
- Initialize local session root under `<configDir>/gittrix-sessions` or Cloudflare working root under `<configDir>/gittrix-cloudflare-ephemeral`.
- Expose service API: `startSession`, `getSession`, `diff`, `promote`, `evict`.
- Persist mapping on `SessionMeta` (`gittrixSessionId`, `ephemeralPath`, `baselineSha`, `isGitBacked`, `workspaceKind`).

## Surface -> adapter wiring defaults

- Self-host
  - durable: local repo adapter behavior pointed at the user repo
  - ephemeral: git-backed local worktree under `<configDir>/gittrix-sessions/<id>/workspace`, with clone fallback
  - optional durable: GitHub adapter using the opened repo's `origin` and app-managed GitHub auth before `GITHUB_TOKEN`, `GH_TOKEN`, or `gh auth token`
  - optional ephemeral: Cloudflare Artifacts adapter using `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`
- Desktop (Electron)
  - Same adapter story as self-host; Electron only changes packaging/host process.
  - Dev desktop relies on the normal backend at `:4273`; production Electron starts the Bun backend on `:4273` before loading the built web UI.
- Hosted (glibcode.com), bridge mode
  - durable + ephemeral both proxied to desktop adapter over WebSocket.
  - Hosted glib never directly touches user filesystem.
  - Latency expectation: `100ms+` round-trip for remote file operations; batching is required where possible.
- Hosted, glib cloud mode
  - durable: GitHub adapter
  - ephemeral: GitTrix-managed Cloudflare Artifacts adapter
  - glib does not wire Cloudflare adapter internals directly; it consumes GitTrix library contracts.
- Agent runtime runs pi inside a hosted sandbox. GitTrix still owns ephemeral storage and promote; sandbox-to-Artifacts sync is separate hosted work.

## Agent integration point

- Agent runtime uses pi RPC subprocesses unconditionally.
- `runTurn` executes with cwd set to the session's GitTrix ephemeral path only when session metadata says it is git-backed and `.git` exists; otherwise it falls back to the durable repo path.
- Agent prompts include repo/session metadata so the model can distinguish durable repo, actual cwd, GitTrix ephemeral workspace, and baseline SHA.
- `/api/agent/*` routes stay thin; `agent-runtime.ts` owns runtime/sandbox lifecycle.
- If the pi RPC process exits between turns, `agent-runtime.ts` respawns pi inside the existing sandbox path.
- No tool-call interception route is required for file writes.
- pi events are normalized into shared `AgentEvent` records for timeline replay and SSE.
- RPC prompt completion waits for `agent_end`; `turn_end` is only one model/tool cycle and does not end the glib turn.
- Text chunk `partId`s are monotonic per server process, not wall-clock based, so same-millisecond pi deltas are not dropped by frontend dedupe.
- Assistant error messages from pi are surfaced as canonical `error` events.

## Eviction daemon + telemetry

Eviction daemon:

- Hono cron route: `POST /api/internal/evict`
- Runs every N minutes
- Calls `gittrix.evictExpired()` and adapter-specific `evict(beforeTimestamp)` for adapters without native TTL
- Native-TTL adapters own their eviction behavior

Telemetry events forwarded from GitTrix event surface:

- `session.start`
- `session.write`
- `session.commit`
- `session.promote`
- `session.evict`
- `error`

Surface sinks:

- self-host/desktop: local logs
- hosted: configured analytics/observability backend

## Persistence

- Config root:
  - Windows: `%APPDATA%/glib-code`
  - macOS: `~/Library/Application Support/glib-code`
  - Linux: `$XDG_CONFIG_HOME/glib-code` or `~/.config/glib-code`
- Repo-local: `.glib/` with `.gitignore` of `*`
- Session index: `<configDir>/sessions-index.json`
- Provider keys: `<configDir>/pi/auth.json`

## Server module boundaries

- `server/src/routes/index.ts`: single API route mounting point.
- `server/src/services/settings-store.ts`: settings, provider defaults, keybindings.
- `server/src/services/project-store.ts`: recents, current project, registered projects, project overrides.
- `server/src/services/session-store.ts`: session docs, event logs, app-level session index.
- `server/src/services/agent-runtime.ts`: live pi/sandbox/turn lifecycle.
- `server/src/services/gittrix-service.ts`: GitTrix adapter lifecycle, diff, promote, evict.

## Gaps to close

- Replace remaining 501 routes with real git mutation/terminal/attachments flows.
- Move current-project state from in-memory global to client/session-aware storage.
- Make diff sources consistent: if `branches`/`prs` are advertised, they need implementation.
- Standardize API error envelopes across all route groups.

## Out of scope (v1)

- glib-side conflict resolution UI (surface conflict payload, user resolves in terminal, re-promote)
- Multi-session-per-project simultaneously (one active session per project per user in v1)
- Cross-adapter promote chains (direct ephemeral -> durable only)
