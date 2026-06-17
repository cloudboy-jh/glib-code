---
title: glib-code
description: Portable source document for generating the full glib-code docs IA in another repo/agent run.
---

# glib-code documentation source (portable)

Use this single markdown file as source material for another agent to generate a Starlight docs site with the exact IA below.

This is intentionally opinionated and implementation-aware.

## IA target (must match)

Top-level nav:

- Introduction
- Why glib-code
- Getting Started

Concepts:

- Review-first loop
- Sessions
- Promote
- Provider/model authority
- GitTrix isolation
- Sandbox

Surfaces:

- Self-host
- Server
- Desktop
- Hosted

API Reference:

- Readiness & Health
- Auth
- Providers
- Projects
- Repo
- Diff
- Git
- FS
- Agent Sessions
- Sessions (metadata/diff/promote)
- Settings
- Keybindings
- Attachments
- Terminal
- Open in Editor
- Internal

Guides:

- Run locally
- GitTrix integration

---

## Introduction

glib-code is a review-first AI coding workspace where agents work in isolated GitTrix sessions instead of writing directly into your real repo.

Open a repo, start a session, let the agent work, review the diff, then promote only the files you accept.

Core loop: open repo -> start session -> agent edits isolated workspace -> review session diff -> promote accepted files -> durable repo changes.

## Architecture

```txt
Vue 3 + Vite (web/)
        |
        | typed RPC + SSE
        v
Hono server (server/)
   +-- agent-runtime
   |    +-- pi RPC client
   |    +-- sandbox (local or Cloudflare)
   +-- GitTrix adapter shim
        +-- durable repo (user project)
        +-- ephemeral workspace (<configDir>/gittrix-sessions/<id>/workspace)
```

Storage boundaries:

- Durable repo: user's real git repo. Agent tools do not write here directly during normal sessions.
- Ephemeral workspace: GitTrix-managed session workspace where agent edits land.
- Session metadata: repo-local `.glib/sessions` JSON docs and timelines.
- App config: OS app config directory for settings, provider keys, GitHub auth, session index, and GitTrix roots.

Provider keys live under app config, not the repo:

```
Windows: %APPDATA%/glib-code/pi/auth.json
macOS:   ~/Library/Application Support/glib-code/pi/auth.json
Linux:   $XDG_CONFIG_HOME/glib-code/pi/auth.json or ~/.config/glib-code/pi/auth.json
```

## Why glib-code

Most agent tools are prompt-first and review-later.

glib-code is review-first by design:

- inspect real diffs before and after agent work
- keep agent writes isolated from durable repo
- require explicit promotion of accepted output
- keep provider/model choice explicit, not ambient
- allow diff/project workflows without provider keys

## Getting Started

1. Open or clone a repository.
2. Choose **Diffs** or **Session** entry mode.
3. In Diffs mode, review working tree/commit diffs.
4. Start or continue a session.
5. Let the agent work in isolated GitTrix workspace.
6. Review session-produced diff.
7. Promote approved files back to durable repo.

Requirements: Bun 1.x, Git, a provider API key for agent sessions.

Commands:

```bash
bun install
bun run dev        # server + web
bun run dev:desktop # server + web + Electron
```

Defaults:

- API: `http://127.0.0.1:4273`
- Web: `http://127.0.0.1:5173`

---

## Concepts

### Review-first loop

Core loop:

1. Start from real repo state
2. Run agent in isolation
3. Review diff
4. Promote accepted output
5. Keep durable repo clean

### Sessions

Session = unit of agent work + timeline + isolated workspace mapping.

Session timeline includes user turns, assistant output, tool calls, errors, and turn lifecycle events. Agent runtime uses pi as an RPC subprocess in a sandbox. Event types (AgentEvent union): `session_start`, `user_turn`, `turn_start`, `turn_end` (reason: stop|aborted|error), `step_start`, `step_end`, `text_part` (keyed by monotonic `partId`), `tool_call` (with `tool`, `input`, `output`, `resultType`, optional `artifact`), `error` (named with code/source), `aborted`.

Session metadata is stored under repo-local `.glib/sessions` and includes GitTrix mapping in `SessionMeta`. Session IDs are indexed in app config (`sessions-index.json`). Session routes resolve by index first, then requested `projectPath`, then current project fallback.

### Promote

Promote is explicit transfer from ephemeral session workspace to durable repo.

Current flow:

- compute session diff
- select files (all or subset)
- commit promote payload
- optionally push when upstream/backing mode allows

Current protections:

- overlap checks against dirty durable files
- stash-and-continue path for local durable repos
- handled failure envelopes for UI-safe recovery
- structured conflict detection with 409 response on baseline drift

### Provider/model authority

Provider/model capabilities come from runtime (pi), not static UI catalogs.

Design rules:

- provider auth is app-managed (`<configDir>/pi/auth.json`)
- model availability reflects runtime truth
- missing auth blocks agent execution, not project/diff browsing
- GitHub durable auth uses app-managed device OAuth tokens, then `GITHUB_TOKEN`/`GH_TOKEN`, then `gh auth token`

### GitTrix isolation

GitTrix provides durable/ephemeral boundary.

- durable: local repo (or configured GitHub durable adapter)
- ephemeral: GitTrix-managed session workspace for agent edits
- promote: controlled copy/commit back to durable

Current state:

- local sessions prefer git-backed ephemeral workspaces
- `.git`-less ephemeral directories are not used for git-aware agent turns
- durable fallback behavior exists for old/non-git session metadata

### Sandbox

Sandbox owns where pi (the agent runtime) runs.

- `LocalSandbox`: pi runs as a subprocess on the local machine. Used for self-host and desktop modes.
- `CloudflareSandbox`: pi runs in a Cloudflare worker. Used for hosted/future remote modes.

Session cwd is set to the GitTrix ephemeral path when git-backed and `.git` exists; otherwise falls back to durable repo path. Pi RPC process respawns between turns if needed.

---

## Surfaces

### Self-host

`bun run dev` runs the Bun API server and Vite frontend on the same machine.

- API server: `http://127.0.0.1:4273`
- Web app: `http://127.0.0.1:5173`
- Filesystem access: local machine only
- Agent execution: local pi subprocess in a sandbox
- Durable storage: local git repo or GitHub durable adapter
- Ephemeral storage: local GitTrix workspace by default

### Server

Bun + Hono API that can run as a normal service. The server host owns filesystem and agent execution.

- API server: Bun/Hono
- UI: built web app or separate frontend host
- Filesystem access: server host only
- Agent execution: server host
- Durable storage: repos available to the server process
- Security: do not expose broadly without auth and filesystem scoping

### Desktop

Electron shell wrapping the same web UI. Starts or connects to the local backend.

- Dev: `bun run dev:desktop` runs server + web + Electron in parallel
- Production: Electron starts Bun backend on `:4273` and loads built web app from `web/dist/index.html`
- Native integrations: folder picker via IPC bridge (`glibDesktop.pickProjectDirectory()`)

### Hosted

Hosted glib-code does not directly touch user's local filesystem. The intended future split:

- Hosted UI + control plane on glibcode.com
- Desktop bridge for local filesystem and local agent execution
- Optional GitHub durable adapter for cloud projects
- Optional Cloudflare/GitTrix ephemeral adapter for hosted workspaces
- Explicit sync/promotion boundaries between hosted workspace and durable repo

---

## API Reference

### Readiness & Health

- `GET /api/readiness` — 30s in-memory cache, checks git/pi/gh, returns `ReadinessReport`
- `GET /api/health` — returns `{ ok, uptimeMs, now }`

### Auth

- `GET /api/auth/session` — GitHub auth status and account info
- `POST /api/auth/github` — verifies GitHub token for GitTrix durable operations
- `POST /api/auth/github/device/start` — starts GitHub device OAuth (requires `GITHUB_OAUTH_CLIENT_ID`)
- `POST /api/auth/github/device/poll` — polls device code exchange
- `DELETE /api/auth/github` — clears app-managed GitHub auth
- `POST /api/auth/signout` — clears app-managed GitHub auth

### Providers

- `GET /api/providers` — pi-discovered provider/model availability + current defaults
- `POST /api/providers/:id/auth` — saves API key to `<configDir>/pi/auth.json`
- `DELETE /api/providers/:id/auth` — removes API key
- `PATCH /api/providers/defaults` — updates default provider/model, validated against pi

### Projects

- `GET /api/projects/recents` — max 20 recents from config dir
- `GET /api/projects/candidates?q=...` — path autocomplete search
- `GET /api/projects/recents/status` — returns ok/missing_path/missing_git per recent
- `POST /api/projects/open` — returns `{ needsInit: true }` if no `.git`
- `POST /api/projects/init` — `git init` at path, creates `.glib/`
- `POST /api/projects/create` — creates dir, writes starter `.gitignore`
- `POST /api/projects/clone` — clones from URL or local path
- `DELETE /api/projects/recents/:id` — removes from recents list
- `POST /api/projects/recents/:id/forget` — removes from recents + forgets project
- `PATCH /api/projects/:id/provider` — validates against pi capabilities, stored in memory (not persistent across restarts)

### Repo

- `GET /api/repo/current` — returns current project info (in-memory, process scoped)
- `POST /api/repo/switch` — switches current project by ID

### Diff

- `GET /api/diff/sources` — static list: uncommitted/enabled, commits/enabled, branches/disabled, prs/disabled
- `GET /api/diff/items?source=&limit=&projectPath=` — diff items for a source
- `GET /api/diff/files?source=&ref=&projectPath=` — changed files list
- `GET /api/diff/hunks?source=&ref=&file=&projectPath=` — hunks for a specific file
- `POST /api/diff/pack` — full patch + stats `{ files, hunks, additions, deletions }`
- `POST /api/diff/branch-compare` — **501 Not Implemented** (UI-inaccessible in v1)

`uncommitted` packing uses `git diff HEAD` (includes staged tracked changes). Untracked file packing synthesizes a new-file diff.

### Git

All endpoints implemented:

- `GET /api/git/status` — includes upstream, ahead/behind, dirty buckets, canPush
- `GET /api/git/branches` — list branches
- `GET /api/git/log?limit=` — default limit 50
- `GET /api/git/commit/:sha` — single commit detail
- `POST /api/git/stage` — rejects protected `.glib/**` paths
- `POST /api/git/unstage`
- `POST /api/git/discard` — rejects protected `.glib/**` paths
- `POST /api/git/commit` — rejects empty messages, nothing-to-commit, protected paths
- `POST /api/git/push` — requires upstream, blocks detached head
- `POST /api/git/pull` — returns structured NO_UPSTREAM, DETACHED_HEAD, PULL_CONFLICT
- `POST /api/git/stash` — ignores `.glib/` changes, includes untracked
- `POST /api/git/checkout` — blocks on dirty tree with DIRTY_TREE payload
- `POST /api/git/branches` — create branch, optional checkout

### FS

- `GET /api/fs/tree?path=` — nested `{ name, path, type, children }`, excludes `.git`
- `GET /api/fs/paths` — flat relative paths, excludes `.git` and `.glib/`
- `GET /api/fs/read?path=` — UTF-8 file content, path-escape blocked by `inRepo()` check

### Settings

- `GET /api/settings` — stored in `<configDir>/settings.json`
- `PATCH /api/settings` — partial update
- `POST /api/settings/reset` — reset to defaults

### Keybindings

- `GET /api/keybindings` — stored in `<configDir>/keybindings.json`
- `PUT /api/keybindings` — full replace
- `POST /api/keybindings/reset` — reset to defaults

### Agent Sessions

- `POST /api/agent/sessions` — creates session + GitTrix workspace, returns session meta
- `POST /api/agent/sessions/:id/send` — sends prompt, runs pi RPC, broadcasts events. Body includes `prompt`, optional context/attachments, and `projectPath`
- `GET /api/agent/sessions/:id/stream?projectPath=&replay=` — SSE stream with event replay
- `DELETE /api/agent/sessions/:id/turn?projectPath=` — aborts active turn
- `DELETE /api/agent/sessions/:id?projectPath=` — deletes session, evicts GitTrix workspace

### Sessions (metadata/diff/promote/export)

- `GET /api/sessions` — scoped to current project; `?scope=all` for cross-project
- `GET /api/sessions/:id?projectPath=` — session detail
- `GET /api/sessions/:id/export?format=markdown|pi-jsonl` — session export
- `GET /api/sessions/:id/diff?projectPath=` — GitTrix diff patch + file list
- `GET /api/sessions/:id/stats?projectPath=` — cost + token usage
- `POST /api/sessions/:id/fork` — fork a session
- `POST /api/sessions/:id/promote?projectPath=` — promote selected changes, returns structured conflicts on baseline drift (409)
- `POST /api/sessions/:id/evict` — force-evict GitTrix workspace
- `POST /api/sessions/:id/rename` — rename session
- `POST /api/sessions/:id/compact` — compact session in pi
- `PATCH /api/sessions/:id?projectPath=` — update title/status/model/provider
- `DELETE /api/sessions/:id?projectPath=` — delete session

### Attachments

- `POST /api/attachments` — multipart file upload
- `GET /api/attachments/:id` — read/download
- `DELETE /api/attachments/:id` — remove

### Terminal

- `GET /api/term` — WebSocket upgrade. Protocol: `hello`/`run`/`ping` from client; `ready`/`ack`/`output`/`exit`/`error`/`pong` from server. Shell resolved from env/platform (zsh/bash/sh/pwsh).

### Open in Editor

- `POST /api/open/editor` — opens file/project in vscode/cursor/zed/obsidian. Resolves ephemeral path if sessionId provided.

### Internal

- `POST /api/internal/evict` — Hono cron route. Evicts expired GitTrix sessions.

---

## Guides

### Run locally

Requirements:

- Bun 1.x
- Git
- provider API key for agent sessions

Commands:

```bash
bun install
bun run dev        # server + web
bun run dev:desktop # server + web + Electron
bun run build      # build all workspaces: shared -> server -> web -> desktop
bun run check      # typecheck all workspaces
```

Per-workspace:

```bash
bun run --cwd server dev      # backend only on :4273
bun run --cwd web dev         # frontend only via Vite
bun run --cwd desktop build   # tsc then electron .
```

Defaults:

- API: `http://127.0.0.1:4273`
- Web: `http://127.0.0.1:5173`

Config paths:

- macOS: `~/Library/Application Support/glib-code/`
- Linux: `$XDG_CONFIG_HOME/glib-code/` or `~/.config/glib-code/`
- Windows: `%APPDATA%/glib-code/`

### GitTrix integration

GitTrix provides the durable/ephemeral boundary. glib-code consumes GitTrix as a library (`gittrix` npm package).

- start session workspace from durable repo context
- run agent writes only in ephemeral workspace
- review produced diff
- promote selected files back to durable

Adapter defaults:

- Self-host durable: local repo behavior pointed at the user repo
- Self-host ephemeral: git-backed local worktree under `<configDir>/gittrix-sessions/<id>/workspace`, with clone fallback
- Optional durable: GitHub adapter using the opened repo's `origin` and app-managed GitHub auth
- Optional ephemeral: Cloudflare Artifacts adapter using `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`

---

## Repository map

```txt
glib-code/
├── server/     # Bun + Hono API, GitTrix orchestration, pi RPC runtime
│   ├── src/
│   │   ├── routes/       # 16 route groups (auth, projects, repo, diff, git, fs, agent, sessions, settings, keybindings, providers, attachments, term, open, internal, readiness/health)
│   │   ├── services/     # Implementation: git, session-store, agent-runtime, gittrix-service, settings-store, project-store, pi-rpc, sandbox, session-resolver
│   │   └── lib/          # Utilities: log, paths, route-error, atomic-write, project-path
│   └── ARCHITECTURE.md
├── web/        # Vue 3 + Vite frontend
│   ├── src/
│   │   ├── views/        # PickerView, SessionView, DiffView
│   │   ├── composables/  # useApiClient, useSessionOrchestrator, useSessionStreaming, usePickerSessions, useGlobalShortcuts, useSlashCommands
│   │   ├── components/   # app/, diff/, picker/, session/, settings/, shared/, ui/
│   │   └── lib/          # theme.ts, utils.ts
│   └── App.vue           # Main orchestrator component
├── desktop/    # Electron shell for packaged local app
│   └── src/             # main.ts (spawns backend, loads web UI), preload.ts (IPC bridge)
├── shared/     # Shared types, schemas, theme presets, event contracts
│   └── src/
│       ├── events/agent.ts   # AgentEvent union, ToolName, ToolResultType, TokenUsage
│       ├── schemas/readiness.ts  # ReadinessReport Zod schema
│       └── theme/presets.ts  # THEME_PRESETS (28 themes), ThemeTokens type
├── scripts/    # Workspace dev orchestrator
├── Docs/       # Living docs + implementation checklists (Architecture, SPEC, Backend, Frontend, Agent, Onboarding, next-steps, session-smoke-test, T3 UI parity)
└── assets/     # Wordmark logo, demo GIF, theme cycle GIF
```

## Overall status

Operationally complete for core beta loop:

- diff-first and session-first entry flows are functional
- project-scoped and global session listing both work
- session lifecycle APIs are wired and exercised in UI
- GitTrix isolation is active for normal local session creation
- promote supports guarded mutation paths and optional push
- provider auth and model selection are runtime-driven via pi
- settings/keybindings persistence implemented
- all git mutation routes implemented (stage/unstage/discard/commit/pull/checkout/create-branch)
- attachments API implemented (upload/read/delete)
- terminal WebSocket transport implemented
- auth routes implemented (GitHub device OAuth flow)
- FS routes implemented (tree/paths/read)

Primary active gaps:

- hunk-level session promote selection
- `/api/diff/branch-compare` not implemented
- `scope=all` listing performance and pagination/limits
- path normalization edge-case coverage
- telemetry for session-list latency and empty-result causes
- project provider/model overrides in-memory only (not persisted across restarts)
- current-project state is single process-global (not client/session-scoped)
- frontend polish: session list consistency, command palette capability gating, diff overlay parity
- Cloudflare Artifacts adapter hardening
- multi-tab/reload recovery edge cases

## Product principles

- review first
- isolate agent edits
- explicit promote to durable git
- runtime-truth provider/model authority
- avoid hidden side effects