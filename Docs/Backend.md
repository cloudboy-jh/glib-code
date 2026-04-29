# Backend (Current Implementation)

Last updated: 2026-04-29

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

- `/api/agent/*` -> all 501
- `/api/sessions/*` -> empty list + mostly 501
- `/api/attachments/*` -> all 501
- `/api/term` -> 501

## Persistence

- Config root:
  - Windows: `%APPDATA%/glib-code`
  - macOS: `~/Library/Application Support/glib-code`
  - Linux: `$XDG_CONFIG_HOME/glib-code` or `~/.config/glib-code`
- Repo-local: `.glib/` with `.gitignore` of `*`

## Gaps to close

- Replace 501 routes with real agent/session/git mutation/terminal/attachments flows.
- Move current-project state from in-memory global to client/session-aware storage.
- Make diff sources consistent: if `branches`/`prs` are advertised, they need implementation.
