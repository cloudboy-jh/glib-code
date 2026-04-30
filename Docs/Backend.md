# Backend (Current Implementation)

Last updated: 2026-04-30

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
  - `opencode --version`
  - `opencode auth list`
  - `gh --version`
- 30s in-memory cache.
- Uses shared schema type `ReadinessReport` from `shared/src/schemas/readiness.ts`.
- Provider readiness is derived from shared opencode capability discovery.

### Providers

- `GET /api/providers`
- `PATCH /api/providers/defaults`

Behavior:

- Backed by opencode capability discovery service (`opencode auth list` + model discovery).
- Returns dynamic provider/model availability and current backend-selected defaults.
- No static provider/model catalog in backend.
- No backend key-write endpoints; auth is opencode-owned.

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

## Placeholder route groups (not implemented yet)

- `/api/agent/*` -> implemented create/send/stream/abort/delete with subprocess + SSE
- `/api/sessions/*` -> implemented list/read/fork/delete/patch on repo-local `.glib/sessions`
- `/api/attachments/*` -> all 501
- `/api/term` -> 501

## GitTrix-backed session routes (target wiring)

All session routes are typed Hono RPC. The `/api/sessions/:id/write` endpoint is internal-only and not exposed to renderer clients.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/sessions` | Create a new session. Body: `{ task, durableRef, ephemeralAdapter? }`. Calls `gittrix.startSession()`. Returns `{ glibSessionId, gittrixSessionId, workingDirRef }`. |
| `GET` | `/api/sessions` | List active sessions for the current project. Joins glib session metadata with `gittrix.listSessions()`. |
| `GET` | `/api/sessions/:id` | Get session detail. Returns metadata + current `session.diff()` summary. |
| `GET` | `/api/sessions/:id/diff` | Full diff for the session in the format `@pierre/diffs` consumes. Backed by `session.diff()`. |
| `POST` | `/api/sessions/:id/promote` | Promote selected hunks/files to durable. Body: `{ selector: { hunks?, files? }, strategy: 'branch' \| 'commit' \| 'pr', branchName?, commitMessage?, prTitle?, prBody? }`. Returns `{ sha, branch?, prUrl? }` or structured conflict payload. |
| `POST` | `/api/sessions/:id/evict` | Force-evict a session without promoting. Calls `session.evict()`. |
| `POST` | `/api/sessions/:id/write` | Internal route used by opencode tool-result handler for write/edit events. Body: `{ path, content }`. Routes to `session.write()`. |

## GitTrixService

Add `server/services/gittrix.ts` as the single owner of the `GitTrix` instance and session mapping layer. Route handlers do not instantiate `GitTrix` directly.

Responsibilities:

- Create and hold singleton `GitTrix` instance.
- Configure adapters by surface/runtime mode.
- Maintain `glibSessionId <-> gittrixSessionId` mapping.
- Expose service API: `startSession`, `getSession`, `listSessions`, `diff`, `write`, `promote`, `evict`.

Session metadata table (same state backend as other glib state; SQLite for self-host/desktop, D1 for hosted):

```txt
sessions:
  glib_session_id        primary key
  gittrix_session_id     foreign reference
  project_id
  task                   text from creation
  durable_ref            adapter + path
  ephemeral_adapter      name
  baseline_sha           captured at session start
  created_at
  last_active
  status                 active | promoted | evicted | conflicted
```

## Surface -> adapter wiring defaults

- Self-host
  - durable: `adapter-local` pointed at local repo
  - ephemeral: `adapter-local` tmp path under `~/.glib/sessions/<id>/`
- Desktop (Electron)
  - Same adapter story as self-host; Electron only changes packaging/host process.
- Hosted (glibcode.com), bridge mode
  - durable + ephemeral both proxied to desktop adapter over WebSocket.
  - Hosted glib never directly touches user filesystem.
  - Latency expectation: `100ms+` per `session.write` round-trip; batch writes where opencode permits.
- Hosted, glib cloud mode
  - durable: `adapter-github` (or `adapter-codestorage` once available)
  - ephemeral: GitTrix-managed cloud ephemeral adapter (`adapter-cloudflare` per GitTrix spec)
  - glib does not wire Cloudflare adapter internals directly; it consumes GitTrix library contracts.
  - opencode runs in Durable Object; writes persist through Cloudflare-backed ephemeral storage via GitTrix; promote updates durable GitHub target.

## opencode subprocess integration point

When a `tool_use` event arrives for write/edit tools, subprocess handling calls `gittrixService.write(sessionId, path, content)` instead of writing directly to disk. This is the promote-gate safety boundary.

Read/bash/other tool operations remain unchanged and operate in the ephemeral working directory exposed by the active GitTrix session.

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

- Wire GitTrixService boundary for session.write/promote/evict.
- Replace remaining 501 routes with real git mutation/terminal/attachments flows.
- Move current-project state from in-memory global to client/session-aware storage.
- Make diff sources consistent: if `branches`/`prs` are advertised, they need implementation.

## Out of scope (v1)

- glib-side conflict resolution UI (surface conflict payload, user resolves in terminal, re-promote)
- Multi-session-per-project simultaneously (one active session per project per user in v1)
- Cross-adapter promote chains (direct ephemeral -> durable only)
