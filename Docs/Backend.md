# Backend (Current Implementation)

Last updated: 2026-05-02

## Server entry

- File: `server/src/index.ts`
- Runtime: Bun + Hono
- Default port: `4173` (supports `--port=`)
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
- Provider keys are managed through in-app provider auth routes.

### Health

- `GET /api/health`
- Returns `{ ok, uptimeMs, now }`.

### Projects

- `GET /api/projects/recents`
- `GET /api/projects/recents/status`
- `POST /api/projects/open`
- `POST /api/projects/init`
- `POST /api/projects/create`
- `DELETE /api/projects/recents/:id`
- `POST /api/projects/recents/:id/forget`

Behavior:

- Recents persisted in config dir (`recents.json`), max 20.
- Project id = SHA1 hash of resolved path (12 chars).
- `open` returns `{ needsInit: true }` if no `.git`.
- `create` writes a starter `.gitignore` and creates `.glib/.gitignore`.

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
- `POST /api/diff/branch-compare` (501)

Current behavior:

- Fully implemented for `uncommitted` and `commits`.
- `branches` and `prs` sources are listed but not implemented in services.
- `pack` returns full patch + simple stats `{ files, hunks, additions, deletions }`.

### Git

Implemented:

- `GET /api/git/status`
- `GET /api/git/branches`
- `GET /api/git/log`

Stubbed (`501`):

- stage/unstage/discard/commit/push/pull/checkout/create-branch/get-commit

### FS

- `GET /api/fs/tree?path=...`
- `GET /api/fs/read?path=...`

Notes:

- Path escape blocked by `inRepo()` check.
- `.git` directory hidden from tree listing.
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

- `GET /api/auth/session` returns `{ signedIn: false }`
- `POST /api/auth/github` is `501`
- `POST /api/auth/signout` returns `{ ok: true }`

## Session + agent routes

- `/api/agent/*` is implemented for create/send/stream/abort/delete.
- `/api/sessions/*` is implemented for list/read/fork/delete/patch plus GitTrix diff/promote/evict.
- Session metadata is stored under repo-local `.glib/sessions` and includes GitTrix mapping in `SessionMeta`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sessions` | Create a new session and initialize matching GitTrix session metadata. |
| `GET` | `/api/sessions` | List active sessions for the current project. Joins glib session metadata with `gittrix.listSessions()`. |
| `GET` | `/api/sessions/:id` | Get session detail and metadata. |
| `GET` | `/api/sessions/:id/diff` | Return full unified diff from GitTrix ephemeral vs durable baseline. |
| `POST` | `/api/sessions/:id/promote` | Promote selected changes to durable. On baseline drift, returns 409 with structured conflict payload. |
| `POST` | `/api/sessions/:id/evict` | Force-evict the GitTrix session workspace. |

## GitTrixService

`server/src/services/gittrix.ts` is the single owner of the `GitTrix` instance. Route handlers do not instantiate `GitTrix` directly.

Responsibilities:

- Create and hold singleton `GitTrix` instance.
- Initialize adapter-local session root under `<configDir>/gittrix-sessions`.
- Expose service API: `startSession`, `getSession`, `diff`, `promote`, `evict`.
- Persist mapping on `SessionMeta` (`gittrixSessionId`, `ephemeralPath`, `baselineSha`).

## Surface -> adapter wiring defaults

- Self-host
  - durable: `adapter-local` pointed at local repo
  - ephemeral: `adapter-local` path under `<configDir>/gittrix-sessions/<id>/workspace`
- Desktop (Electron)
  - Same adapter story as self-host; Electron only changes packaging/host process.
- Hosted (glibcode.com), bridge mode
  - durable + ephemeral both proxied to desktop adapter over WebSocket.
  - Hosted glib never directly touches user filesystem.
  - Latency expectation: `100ms+` round-trip for remote file operations; batching is required where possible.
- Hosted, glib cloud mode
  - durable: `adapter-github` (or `adapter-codestorage` once available)
  - ephemeral: GitTrix-managed cloud ephemeral adapter (`adapter-cloudflare` per GitTrix spec)
  - glib does not wire Cloudflare adapter internals directly; it consumes GitTrix library contracts.
  - Agent runtime runs in hosted worker runtime; writes persist through GitTrix ephemeral storage; promote updates durable GitHub target.

## Agent integration point

- Agent runtime is pi in-process library, not subprocess.
- `runTurn` executes with cwd set to the session's GitTrix ephemeral path.
- No tool-call interception route is required for file writes.

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

## Gaps to close

- Replace remaining 501 routes with real git mutation/terminal/attachments flows.
- Move current-project state from in-memory global to client/session-aware storage.
- Make diff sources consistent: if `branches`/`prs` are advertised, they need implementation.

## Out of scope (v1)

- glib-side conflict resolution UI (surface conflict payload, user resolves in terminal, re-promote)
- Multi-session-per-project simultaneously (one active session per project per user in v1)
- Cross-adapter promote chains (direct ephemeral -> durable only)
