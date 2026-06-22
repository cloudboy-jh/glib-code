# API Contracts

Last updated: 2026-06-22

## `/api/sessions`

### `GET /api/sessions`

Returns sessions for the **current project** (server-side global `currentProjectId`).

- If no project is open, returns `[]`.
- Sessions are read from `<repoPath>/.glib/sessions/*.json`.
- Response: `SessionMeta[]` sorted by `updatedAt` descending.

### `GET /api/sessions?scope=all`

Returns sessions aggregated across **all known projects**. Merges sessions from:
1. The current project (`getCurrentProjectId()`)
2. All registered projects (`listRegisteredProjects()`)
3. All recent projects (`getRecents()`)

Deduplicates by `canonicalProjectPath(projectPath)::sessionId`. Response: `SessionMeta[]` sorted by `updatedAt` descending.

No pagination. No caching. Reads every session JSON file on every call.

### `?projectPath=` override

All `/:id` sub-routes accept `?projectPath=<path>` as an explicit project override, bypassing the global `currentProjectId` fallback. This is used by the frontend to target sessions across projects without switching the server's global active project.

Sub-routes that accept `?projectPath=`:
- `GET /:id`
- `GET /:id/export`
- `DELETE /:id`
- `GET /:id/diff`
- `POST /:id/promote`
- `POST /:id/evict`
- `PATCH /:id`
- `GET /:id/stats`
- `POST /:id/rename`
- `POST /:id/compact`
- `GET /:id/boundary`
- `POST /:id/discard`

If `projectPath` is omitted, the server falls back to `getCurrentProjectId()` (via `resolveSession`). This fallback is the subject of Session 3 (project scope model fix).

### `POST /:id/fork`

Does **not** accept `?projectPath=` — uses `mustProject()` (global `currentProjectId`) only.

## `/api/projects`

| Method | Path | Notes |
|---|---|---|
| `GET /recents` | File-backed `recents.json`, sorted by `lastOpenedAt` desc. |
| `GET /candidates?q=` | Shells out to `zoxide query -l [q]`. |
| `GET /default-clone-dir` | Picks first existing of `~/proj`, `~/repos`, `~/code`, `~/Developer`, `~/dev`, else `$HOME`. |
| `GET /recents/status` | Returns `{ id, status: "ok"|"missing_path"|"missing_git" }` per recent. |
| `POST /open` | Body `{ path }`. Validates git, sets current project, adds to recents. |
| `POST /init` | Body `{ path }`. `git init` + open. |
| `POST /create` | Body `{ parent, name }`. mkdir + git init + open. |
| `POST /clone` | Body `{ url, destination }`. Returns 201. |
| `DELETE /recents/:id` | Removes from recents; clears `currentProjectId` if it matches. |
| `POST /recents/:id/forget` | Wipes `<path>/.glib` then removes the recent. |
| `PATCH /:id/provider` | Body `{ provider?, model? }`. Validates against pi capabilities. In-memory only (Session 3b will persist). |

## `/api/repo`

| Method | Path | Notes |
|---|---|---|
| `GET /current` | Returns the current project object or `null`. |
| `POST /switch` | Body `{ id }`. Sets `currentProjectId` without re-opening. |

## `/api/providers`

| Method | Path | Notes |
|---|---|---|
| `GET /` | Returns `{ ok, error?, defaultProvider, defaultModel, providers: ProviderCapability[] }`. |
| `POST /:id/auth` | Body `{ apiKey }`. Stores key in pi `authStorage` (in-memory). |
| `DELETE /:id/auth` | Removes key. 404 if not stored (idempotent on frontend). |
| `PATCH /defaults` | Body `{ defaultProvider?, defaultModel? }`. Persists to `providers.json`. |

## `/api/readiness`

Returns `ReadinessReport` with checks for `git`, `pi`, `gh`. Cached 30s. `pi.providers` lists provider IDs with usable auth.
