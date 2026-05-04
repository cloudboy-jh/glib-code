# Backend (Current Implementation)

Last updated: 2026-05-04

## Server entry

- File: `server/src/index.ts`
- Runtime: Bun + Hono
- Default dev port: `4273` (supports `--port=`)
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

- `GET /api/auth/session` returns GitHub local auth status from `GITHUB_TOKEN`, `GH_TOKEN`, or `gh auth token`.
- `POST /api/auth/github` verifies that a GitHub token is available for GitTrix GitHub durable operations.
- `POST /api/auth/signout` returns `{ ok: true }`

## Session + agent routes

- `/api/agent/*` is implemented for create/send/stream/abort/delete.
- `/api/sessions/*` is implemented for list/read/fork/delete/patch plus GitTrix diff/promote/evict.
- Session metadata is stored under repo-local `.glib/sessions` and includes GitTrix mapping in `SessionMeta`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/agent/sessions` | Create a new agent session and initialize matching GitTrix session metadata. |
| `POST` | `/api/agent/sessions/:id/send` | Persist user turn, broadcast it, and run pi in the session ephemeral workspace. |
| `GET` | `/api/agent/sessions/:id/stream` | Replay + stream canonical agent events over SSE. |
| `DELETE` | `/api/agent/sessions/:id/turn` | Abort the active turn. |
| `GET` | `/api/sessions` | List active sessions for the current project. Joins glib session metadata with `gittrix.listSessions()`. |
| `GET` | `/api/sessions/:id` | Get session detail and metadata. |
| `GET` | `/api/sessions/:id/diff` | Return full unified diff from GitTrix ephemeral vs durable baseline. |
| `POST` | `/api/sessions/:id/promote` | Promote selected changes to durable. On baseline drift, returns 409 with structured conflict payload. |
| `POST` | `/api/sessions/:id/evict` | Force-evict the GitTrix session workspace. |

## GitTrixService

`server/src/services/gittrix.ts` is the single owner of the `GitTrix` instance. Route handlers do not instantiate `GitTrix` directly.

Responsibilities:

- Create and hold singleton `GitTrix` instances keyed by project, branch, durable provider, and ephemeral provider.
- Initialize local session root under `<configDir>/gittrix-sessions` or Cloudflare working root under `<configDir>/gittrix-cloudflare-ephemeral`.
- Expose service API: `startSession`, `getSession`, `diff`, `promote`, `evict`.
- Persist mapping on `SessionMeta` (`gittrixSessionId`, `ephemeralPath`, `baselineSha`).

## Surface -> adapter wiring defaults

- Self-host
  - durable: local repo adapter behavior pointed at the user repo
  - ephemeral: local workspace adapter behavior under `<configDir>/gittrix-sessions/<id>/workspace`
  - optional durable: GitHub adapter using the opened repo's `origin` and `GITHUB_TOKEN`, `GH_TOKEN`, or `gh auth token`
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
  - Agent runtime runs in hosted worker runtime; writes persist through GitTrix ephemeral storage; promote updates durable GitHub target.

## Agent integration point

- Agent runtime is pi in-process library, not subprocess.
- `runTurn` executes with cwd set to the session's GitTrix ephemeral path.
- No tool-call interception route is required for file writes.
- pi events are normalized into shared `AgentEvent` records for timeline replay and SSE.
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
- Provider keys: `<configDir>/pi/auth.json`

## Gaps to close

- Replace remaining 501 routes with real git mutation/terminal/attachments flows.
- Move current-project state from in-memory global to client/session-aware storage.
- Make diff sources consistent: if `branches`/`prs` are advertised, they need implementation.
- Standardize API error envelopes across all route groups.

## Out of scope (v1)

- glib-side conflict resolution UI (surface conflict payload, user resolves in terminal, re-promote)
- Multi-session-per-project simultaneously (one active session per project per user in v1)
- Cross-adapter promote chains (direct ephemeral -> durable only)
