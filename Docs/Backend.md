# glib-code — backend.md

> Everything the frontend talks to. Hono on Bun, typed RPC, subprocesses for opencode + git + pty. Runs identically under Electron and in a plain browser.

Scope: API surface, service boundaries, persistence, subprocess management, streaming transports, hosts. No UI decisions here — see `frontend.md`.

---

## Stack

- **Runtime**: Bun
- **HTTP framework**: Hono
- **Typed client**: `hc<AppType>` exported from `server/src/index.ts`, consumed by `web/`
- **Validation**: Zod, via `@hono/zod-validator`
- **Agent**: `opencode run --format json` subprocess per turn
- **Git**: `simple-git`
- **PRs**: `gh` CLI
- **Terminal**: `node-pty` (Bun subprocess API where supported, Node fallback when necessary)
- **Streaming**: SSE for agent events, WebSocket for pty
- **Persistence**: JSONL per session under `<repo>/.glib/`, app state under OS user config dir

---

## Hosts

The server is the same binary in both. Only the launcher differs.

### Electron host (`desktop/`)

- Electron main (Node) boots, picks a free port, spawns `bun ../server/src/index.ts --port <port>` as a child process.
- When the server logs `ready`, Electron creates a `BrowserWindow` and loads `http://127.0.0.1:<port>`.
- Electron does not speak HTTP to the server itself — it just owns the window. All API calls come from the renderer.
- On quit, Electron SIGTERMs the Bun child.

### Browser host (`bun server/`)

- `bun server/src/index.ts --port <port?>` runs standalone.
- Hono serves `web/dist` at `/` and the API at `/api/*` from the same origin.
- User opens `http://localhost:<port>` in any browser.
- No packaging, no Electron, no native chrome. Same product.

Both hosts bind `127.0.0.1` by default. A `--host 0.0.0.0` flag exists for LAN use but is off by default (see Security).

---

## Repo layout

```
glib-code/
├── server/
│   ├── src/
│   │   ├── index.ts              — Hono app, exports AppType, CLI entry
│   │   ├── routes/
│   │   │   ├── projects.ts
│   │   │   ├── repo.ts
│   │   │   ├── diff.ts
│   │   │   ├── git.ts
│   │   │   ├── fs.ts
│   │   │   ├── agent.ts
│   │   │   ├── sessions.ts
│   │   │   ├── settings.ts
│   │   │   ├── keybindings.ts
│   │   │   └── term.ts
│   │   ├── services/
│   │   │   ├── projects.ts       — recents registry, .git detection, init
│   │   │   ├── git.ts            — simple-git wrapper
│   │   │   ├── diff.ts           — commits, hunks, pack, PR fetching
│   │   │   ├── opencode.ts       — subprocess manager, one per active turn
│   │   │   ├── sessions.ts       — JSONL reader/writer, transcript index
│   │   │   ├── settings.ts       — user settings read/write
│   │   │   ├── keybindings.ts    — JSON read/write, compile + resolve
│   │   │   ├── attachments.ts    — image storage, /attachments serving
│   │   │   └── pty.ts            — node-pty lifecycle per window/session
│   │   ├── middleware/
│   │   │   ├── static.ts         — serves web/dist in browser host
│   │   │   └── cors.ts
│   │   └── lib/
│   │       ├── paths.ts          — OS user config dir, repo .glib/ helpers
│   │       └── port.ts           — pick a free port
│   └── package.json
├── web/                          — Vue app, served by Hono at /
├── desktop/                      — Electron wrapper
└── shared/
    ├── src/
    │   ├── schemas/              — Zod schemas (single source of truth)
    │   ├── events.ts             — AgentEvent type
    │   └── theme/                — theme tokens and presets
    └── package.json
```

---

## Routes

### Projects

```
GET    /api/projects/recents                 → ProjectEntry[]
POST   /api/projects/open                    { path } → Project | { needsInit: true }
POST   /api/projects/init                    { path } → Project
POST   /api/projects/create                  { parent, name } → Project
DELETE /api/projects/recents/:id
POST   /api/projects/recents/:id/forget      (removes + nukes .glib/)
```

`ProjectEntry`: `{ id, name, path, lastOpenedAt }`
`Project`: `{ id, name, path, branch, isGitRepo: true }` — the frontend never sees a project that isn't a git repo. The Initialize dialog converts non-repos before handoff.

### Repo

```
GET    /api/repo/current                     → Project
POST   /api/repo/switch                      { id } → Project
```

The server tracks the currently-open project per client (identified by a session cookie in browser host, by a window id in Electron host).

### Diff

Heart of the product. Routes return hierarchical structures matching the drill-down model.

```
GET    /api/diff/sources                     → DiffSource[]
                                               // uncommitted, commits, branches, prs

GET    /api/diff/items                       { source, ref?, limit?, before? }
                                               → DiffItem[]

GET    /api/diff/files                       { items: DiffItemRef[] }
                                               → DiffFile[]

GET    /api/diff/hunks                       { items: DiffItemRef[], file }
                                               → DiffHunk[]

POST   /api/diff/pack                        { selection: DiffSelection }
                                               → { diff: string, stats }
                                               // produces the unified diff sent as agent context

POST   /api/diff/branch-compare              { a, b } → DiffItem
```

`DiffSelection` captures the full cross-level selection — a list of items, each with optional file filters, each file with optional hunk index filters. `pack` walks this structure and returns one unified-diff string. The frontend never assembles the diff text itself; it holds a selection object and hands it to `pack`.

PRs: `gh pr list` / `gh pr diff` under the hood. Abstracted behind `DiffSource` so a direct GitHub API implementation can replace it.

### Git

```
GET    /api/git/status                       → GitStatus
POST   /api/git/stage                        { paths } → GitStatus
POST   /api/git/unstage                      { paths } → GitStatus
POST   /api/git/discard                      { paths } → GitStatus
POST   /api/git/commit                       { message, paths? } → Commit
POST   /api/git/push                         → { ok, remote, ref }
POST   /api/git/pull                         → GitStatus

GET    /api/git/branches                     → Branch[]
POST   /api/git/checkout                     { branch } → Branch
POST   /api/git/branches                     { name, from? } → Branch

GET    /api/git/log                          { limit?, before?, ref? } → Commit[]
GET    /api/git/commit/:sha                  → Commit
```

Every mutation returns the new state for its surface — frontend updates without a follow-up GET.

### FS

```
GET    /api/fs/tree                          { path? } → TreeNode
GET    /api/fs/read                          { path } → { content, encoding }
```

Used by the composer's `@` file picker and by the "open in editor" action in the commit dialog.

### Agent

```
POST   /api/agent/sessions                   { projectId, model?, seed? }
                                               → { sessionId }
POST   /api/agent/sessions/:id/send          { prompt, context?, attachments? }
                                               → { turnId }   // 202, stream follows
GET    /api/agent/sessions/:id/stream        → SSE of AgentEvent
DELETE /api/agent/sessions/:id/turn          (aborts active turn, session survives)
DELETE /api/agent/sessions/:id               (kills session, preserves transcript)
```

- `context` is the unified-diff blob from `/api/diff/pack`. Optional.
- `attachments` is an array of uploaded image IDs (see Attachments route below). Each is substituted into the turn's payload to opencode according to opencode's multimodal input format.
- `seed` lets a newly-created session be pre-populated from an existing transcript — that's how "fork session" works.
- `send` returns immediately with a `turnId`; streaming happens on `/stream`, which the frontend connects to once per session and keeps open for its lifetime.

### Attachments (images)

```
POST   /api/attachments                      multipart: file
                                               → { id, contentType, size }
GET    /api/attachments/:id                  → image bytes (cached)
DELETE /api/attachments/:id                  (only unused ones)
```

Image uploads go here first, get an ID, then the ID is referenced in `/api/agent/sessions/:id/send`. Persisted under `<repo>/.glib/attachments/`. Serves with long cache headers keyed by ID (IDs are content-hashed). Unreferenced attachments are GC'd on session delete.

Max size and allowed content types enforced server-side and exposed via `/api/settings` so the composer can validate before upload.

### Sessions (transcripts)

```
GET    /api/sessions                         { projectId } → SessionSummary[]
GET    /api/sessions/:id                     → SessionTranscript
POST   /api/sessions/:id/fork                { atTurnId? } → { newSessionId }
DELETE /api/sessions/:id                     (removes JSONL file)
PATCH  /api/sessions/:id                     { title? } → SessionSummary
```

Transcripts are read from `.glib/sessions/*.jsonl`. The session sidebar hits `/api/sessions?projectId=…` on project open and refreshes on session create or turn completion.

### Settings

```
GET    /api/settings                         → Settings
PATCH  /api/settings                         Partial<Settings> → Settings
POST   /api/settings/reset                   → Settings
```

`Settings` includes: theme preset, timestamp format, default model, confirm-destroy toggles, opencode binary path override, image attachment limits, telemetry opt-in (off by default).

Persisted under OS user config dir:

- macOS: `~/Library/Application Support/glib-code/settings.json`
- Linux: `~/.config/glib-code/settings.json`
- Windows: `%APPDATA%/glib-code/settings.json`

### Keybindings

```
GET    /api/keybindings                      → ResolvedKeybindings
PUT    /api/keybindings                      { rules: KeybindingRule[] } → ResolvedKeybindings
POST   /api/keybindings/reset                → ResolvedKeybindings
```

- `GET` returns the *resolved* config — defaults merged with user overrides, compiled `when` clauses as ASTs. The frontend consumes this directly for event matching.
- `PUT` overwrites user rules. Invalid rules are rejected with structured errors; the service never writes a partially-valid file.
- File path: `<config-dir>/glib-code/keybindings.json`. Same shape as t3code's format — defaults defined server-side in `DEFAULT_KEYBINDINGS`, user rules layer on top, last-match-wins during resolution.

Both GUI (Settings modal) and direct file edits end up hitting `PUT` — the GUI writes the whole file via the API, and the file watcher triggers a reload when it changes externally, pushing an event so the frontend re-fetches.

### Term

```
GET    /api/term                             — WebSocket upgrade
                                               // client → server: { type: "stdin" | "resize" | ... }
                                               // server → client: { type: "stdout" | "exit" }
```

One pty per window/client. Opened lazily on first `⌘J`. Killed on drawer close.

---

## Services

### projects

Owns the recent-projects registry at `<config-dir>/recents.json`. Detects `.git`, runs `git init`, writes the minimal `.gitignore` on New Project. Pure fs/git operations, no cross-service deps.

### git

Thin `simple-git` wrapper. One `SimpleGit` instance per open project, cached by path. All routes under `/api/git` delegate here. No knowledge of opencode or diffs.

### diff

Owns the drill-down and the `pack` operation. Talks to `git` for commits/branches, shells out to `gh` for PRs. `pack` is the single place that serializes a `DiffSelection` into a unified-diff string — the one spot to change if the context format ever evolves.

### opencode

Subprocess manager. One `opencode run --format json` child per active turn.

Why per-turn rather than per-session:
- opencode's `run` subcommand is turn-oriented (one prompt in, stream out, exit).
- Keeping a long-lived opencode would require its interactive mode, which has a TUI and isn't designed for programmatic driving.
- Per-turn spawns are cheap (Bun startup + opencode startup are both fast).
- Aborts are trivial: SIGTERM the active child. No protocol state to clean up.

Service holds a `Map<sessionId, ActiveTurn>` where `ActiveTurn` tracks the child process, the line-splitter, and the SSE writer. `send` creates a turn, spawns opencode, pipes stdout through line parsing, emits each parsed event to both the SSE stream and the session's JSONL writer, closes when opencode exits.

Bun-specific note: `Bun.spawn(['opencode', 'run', '--format', 'json', prompt], { stdout: 'pipe', cwd: repoPath })` gives a native async-iterable over stdout. No manual stream plumbing.

### sessions

JSONL read/write for `<repo>/.glib/sessions/*.jsonl`. Append-only writer per session, full-file reader for transcript endpoints. Maintains an in-memory index of sessions per project so the sidebar can list without re-scanning the directory every request.

Session ID format: `<iso8601>_<shortid>` — sortable by filename, collision-resistant. Example: `2026-04-22T14-21-55_b2e1`.

### settings

Read/write `<config-dir>/settings.json`. Validates on read with the `Settings` Zod schema; missing fields get defaults. Writes are atomic (write to `settings.json.tmp`, rename). Exposes a change event stream internally so other services can react (e.g. opencode rereads its binary path override).

### keybindings

Owns `<config-dir>/keybindings.json`. Default rules defined inline in the service. User rules layered on read. Compile step parses each shortcut string into a `KeybindingShortcut` object and each `when` clause string into a `KeybindingWhenNode` AST. Resolution (last-match-wins) happens on the frontend against the compiled output; the server only compiles and serves.

Watches the file with `fs.watch` so external edits propagate without a restart.

### attachments

Multipart upload handler. Content-hashes the bytes, stores at `<repo>/.glib/attachments/<hash>.<ext>`. Returns the hash as the ID. `GET /api/attachments/:id` streams from disk with `Cache-Control: public, max-age=31536000, immutable`.

### pty

One `node-pty` instance per client. Created on first WebSocket connect to `/api/term`, killed on disconnect. cwd = current project path. `$SHELL` resolved with fallbacks.

`node-pty` is the Bun-compatibility wart. Options, in order of preference:
1. Use Bun's native subprocess API with PTY support if available at build time.
2. Use `@homebridge/node-pty-prebuilt-multiarch` (community fork, better prebuilt coverage).
3. Fall back to spawning the pty process in a Node child if the above breaks.

Decision made at implementation time, not spec time.

---

## Persistence

### Per-repo: `<repo>/.glib/`

```
.glib/
├── sessions/
│   ├── 2026-04-22T14-21-55_b2e1.jsonl
│   └── 2026-04-22T16-03-17_a1c9.jsonl
├── attachments/
│   └── <content-hash>.png
└── .gitignore                     ← contains just "*"
```

### Session JSONL

One file per session, append-only. Each line is a JSON event — same shape as the events streamed to the frontend (see `agent.md` for the schema). First line is always a `session_start` entry:

```jsonl
{"type":"session_start","id":"…","projectId":"…","branch":"main","model":"claude-opus-4.7","createdAt":"…"}
{"type":"user_turn","turnId":"t-01","prompt":"refactor auth","context":"<unified diff>","attachments":["<hash>"],"at":"…"}
{"type":"text_delta","turnId":"t-01","text":"I'll start by…"}
…
{"type":"turn_end","turnId":"t-01","at":"…"}
```

Format mirrors opencode's native event schema so transcripts are portable — jq-readable, potentially replayable.

`.glib/` is added to the repo's `.gitignore` on init/first-session-create. A belt-and-suspenders `.glib/.gitignore` with `*` prevents accidental commits.

### Global: `<config-dir>/glib-code/`

```
recents.json         ← recent projects list (capped at 20)
settings.json        ← user settings
keybindings.json     ← user keybindings (overrides defaults)
logs/
  main.log           ← structured logs, rotated daily, 7 days retained
```

`<config-dir>` resolves per-platform via standard OS paths (XDG on Linux, Application Support on macOS, AppData on Windows).

All writes are atomic (tmpfile + rename).

---

## Streaming transports

### Agent stream (SSE)

One `EventSource` per session on the frontend, opened when Session mode renders that session. Server writes `AgentEvent` JSON-encoded per message. Reconnect with `?since=<lastEventId>` — server replays from the session's JSONL from that point, then switches to live stream.

The SSE connection is independent of `send` requests — the client can `send` while the stream is open; events flow back on the same connection.

### Terminal (WebSocket)

Full-duplex. Client sends keystrokes and resize events, server sends pty output and exit events. WebSocket (not SSE) because the terminal needs input.

---

## Typed RPC

```ts
// server/src/index.ts
const app = new Hono()
  .route('/api/projects',    projectsRoutes)
  .route('/api/repo',        repoRoutes)
  .route('/api/diff',        diffRoutes)
  .route('/api/git',         gitRoutes)
  .route('/api/fs',          fsRoutes)
  .route('/api/agent',       agentRoutes)
  .route('/api/sessions',    sessionsRoutes)
  .route('/api/settings',    settingsRoutes)
  .route('/api/keybindings', keybindingsRoutes)
  .route('/api/attachments', attachmentsRoutes)
  .route('/api/term',        termRoutes);

export type AppType = typeof app;
```

Each sub-app uses chained `.get().post()` for full type inference. Zod validators on every body/param/query. `web/` imports `AppType` from `shared/` (re-exported) and constructs:

```ts
// web/src/lib/api.ts
import { hc } from 'hono/client';
import type { AppType } from '@glib-code/shared/app-type';
export const client = hc<AppType>(window.location.origin);
```

`window.location.origin` works uniformly in both hosts. In browser host, it's `http://localhost:<port>`. In Electron host, `BrowserWindow` loads the same URL, so the origin is identical. No Electron-specific injection.

---

## Process model

```
Electron host:
  electron main (Node)
  ├── BrowserWindow → loads http://127.0.0.1:<port>
  └── child_process: bun server/
           ├── Hono (listening)
           ├── opencode children (0..N, one per in-flight turn)
           ├── node-pty children (0..N, one per active terminal)
           └── gh children (ephemeral, for PR fetches)

Browser host:
  bun server/ (directly)
  ├── Hono (listening)
  ├── opencode children
  ├── node-pty children
  └── gh children
  User opens any browser tab.
```

No separate server process beyond `bun server/` in either host. No Docker. No background worker.

---

## Security

- Default bind: `127.0.0.1`. No LAN exposure unless user passes `--host 0.0.0.0`.
- Port is random per-launch in Electron (chosen by `server/src/lib/port.ts`, passed via argv).
- No auth inside the app — same-origin loopback is the security boundary. LAN host mode warns and requires an explicit `--allow-unauthenticated` flag (safety rail, not real auth).
- opencode credentials (API keys, OAuth tokens) live in opencode's own config. glib-code never reads or handles them.
- `/api/fs/read` clamps to the current project's path. No `../` escape.
- `/api/term`'s pty inherits the user's environment; it's equivalent to opening a shell. Not sandboxed, not meant to be.
- Attachments served with `Content-Disposition: inline` only for whitelisted image MIME types. Everything else is `attachment`.

---

## Observability

- Structured logs to `<config-dir>/logs/main.log`, rotated daily, 7 days retained.
- Error events fire a `toast` event over a dedicated SSE channel (`/api/events`) so the frontend can surface them without polling.
- opencode subprocess stderr is captured per-turn and logged with the `turnId` so crashed turns can be diagnosed.
- `/api/health` returns uptime + service status for self-host debugging.

---

## Out of scope (v1)

- Worktree environment (single cwd = project path for all sessions).
- Remote mode (Hono as a Cloudflare Worker; requires rearchitecting simple-git / node-pty / opencode).
- Auth (loopback-only, single user).
- Multi-window session sync (each window has its own current project; no coordination).
- MCP server config UI.
- Provider-specific integrations beyond opencode (no direct Anthropic/OpenAI paths).
- Plugin system.
