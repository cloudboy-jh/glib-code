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

Surfaces:

- Web
- Server
- Desktop

API Reference:

- Readiness & Health
- Providers
- Projects
- Agent
- Sessions
- Diff
- Git
- Settings
- Attachments
- Terminal

Guides:

- Run locally
- GitTrix integration

---

## Introduction

glib-code is a review-first AI coding workspace where agents work in isolated GitTrix sessions instead of writing directly into your real repo.

Open a repo, start a session, let the agent work, review the diff, then promote only the files you accept.

It is currently in a solid beta state: core diff/session/promote behavior is functional, isolation boundaries are enforced, and day-to-day local usage is reliable.

## Architecture

```txt
Developer -> Web/Desktop -> Server -> Provider/Model -> Agent Session
Agent Session -> Ephemeral Workspace -> Review Diff -> Promote -> Durable Repo
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

Current behavior:

- create: `POST /api/agent/sessions`
- send: `POST /api/agent/sessions/:id/send`
- stream: `GET /api/agent/sessions/:id/stream?projectPath=...&replay=...`
- abort: `DELETE /api/agent/sessions/:id/turn?projectPath=...`
- delete: `DELETE /api/agent/sessions/:id`

Session timeline includes user turns, assistant output, tool calls, errors, and turn lifecycle events.

Current reliability baseline:

- stream/send/hydrate/diff/promote include active `projectPath`
- server-side session resolver centralizes lookup behavior
- stale sessions surface compact recovery actions instead of timeline spam
- replay/reconnect handling is in place for normal refresh/reopen flows

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
- baseline conflict detection with structured error response

### Provider/model authority

Provider/model capabilities come from runtime (pi), not static UI catalogs.

Design rules:

- provider auth is app-managed
- model availability reflects runtime truth
- missing auth blocks agent execution, not project/diff browsing

### GitTrix isolation

GitTrix provides durable/ephemeral boundary.

- durable: local repo (or configured durable adapter)
- ephemeral: session workspace for agent edits
- promote: controlled copy/commit back to durable

Current state:

- local sessions prefer git-backed ephemeral workspaces
- `.git`-less ephemeral directories are not used for git-aware agent turns
- durable fallback behavior exists for old/non-git session metadata

---

## Surfaces

### Web

Vue 3 + Vite app for project picker, diff workbench, sessions, and promote UI.

Key UX points:

- mode selection on project open (Diffs vs Session)
- inline mode cards in recent projects
- typed tool-call rendering in timeline
- diff rendering through Pierre (`@pierre/diffs`)
- in-app destructive confirmations (session delete)
- stale-session recovery actions (reload/new replacement)

### Server

Bun + Hono API for sessions, agent runtime, diff, providers, projects, settings, and promote.

Current responsibilities:

- session metadata/event persistence
- SSE replay + stream
- agent event normalization
- structured tool result typing (`resultType`, `summary`, `artifact`)
- GitTrix session orchestration
- centralized session resolution + route error envelopes
- project open/init/create/forget and recents
- provider discovery and auth
- settings and keybindings persistence

### Desktop

Electron shell wrapping web/server workflow with native integrations (e.g., folder picker).

---

## API Reference

### Readiness & Health

- `GET /api/readiness`
- `GET /api/health`

### Providers

- `GET /api/providers`
- `POST /api/providers/:id/auth`
- `DELETE /api/providers/:id/auth`
- `PATCH /api/providers/defaults`

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

### Agent

- `POST /api/agent/sessions`
- `POST /api/agent/sessions/:id/send`
- `GET /api/agent/sessions/:id/stream?projectPath=...&replay=...`
- `DELETE /api/agent/sessions/:id/turn?projectPath=...`
- `DELETE /api/agent/sessions/:id`

### Sessions

- `GET /api/sessions`
- `GET /api/sessions?scope=all`
- `GET /api/sessions/:id?projectPath=...`
- `GET /api/sessions/:id/export?format=...`
- `POST /api/sessions/:id/fork`
- `PATCH /api/sessions/:id`
- `DELETE /api/sessions/:id`
- `GET /api/sessions/:id/diff?projectPath=...`
- `POST /api/sessions/:id/promote?projectPath=...`
- `POST /api/sessions/:id/evict`

### Diff

- `GET /api/diff/sources`
- `GET /api/diff/items`
- `GET /api/diff/files`
- `GET /api/diff/hunks`
- `POST /api/diff/pack`

### Git

- `GET /api/git/status`
- `POST /api/git/push`
- `POST /api/git/stash`
- `GET /api/git/branches`
- `GET /api/git/log?limit=...`
- `POST /api/git/stage` (not implemented)
- `POST /api/git/unstage` (not implemented)
- `POST /api/git/discard` (not implemented)
- `POST /api/git/commit` (not implemented)
- `POST /api/git/pull` (not implemented)
- `POST /api/git/checkout` (not implemented)
- `POST /api/git/branches` (not implemented)
- `GET /api/git/commit/:sha` (not implemented)

### Settings

- `GET /api/settings`
- `PATCH /api/settings`
- `POST /api/settings/reset`

### Attachments

- `POST /api/attachments` — multipart file upload
- `GET /api/attachments/:id` — read/download
- `DELETE /api/attachments/:id` — remove

### Terminal

- `GET /api/term` — WebSocket upgrade. Protocol: `hello`/`run`/`ping` from client; `ready`/`ack`/`output`/`exit`/`error`/`pong` from server.

---

## Guides

### Run locally

Requirements:

- Bun 1.x
- Git
- pi CLI/runtime for agent sessions
- provider key for agent sessions

Commands:

```bash
bun install
bun run dev        # server + web
bun run dev:desktop # server + web + Electron
```

Defaults:

- API: `http://127.0.0.1:4273`
- Web: `http://127.0.0.1:5173`

### GitTrix integration

Use GitTrix as isolation boundary:

- start session workspace from durable repo context
- run agent writes only in ephemeral workspace
- review produced diff
- promote selected files back to durable

---

## Repository map

```txt
glib-code/
├── server/     # Bun + Hono API, GitTrix orchestration, pi runtime bridge
├── web/        # Vue 3 + Vite frontend, diff workbench, session UI, settings
├── desktop/    # Electron shell for packaged local app
├── shared/     # Shared types, schemas, theme presets, event contracts
├── scripts/    # Workspace dev orchestrator
└── Docs/       # Living docs + implementation checklists
```

## Overall status

Operationally complete for core beta loop:

- diff-first and session-first entry flows are functional
- project-scoped and global session listing both work
- session lifecycle APIs are wired and exercised in UI
- GitTrix isolation is active for normal local session creation
- promote supports guarded mutation paths and optional push
- provider auth and model selection are runtime-driven via pi
- settings persistence and keybindings are implemented

Primary active gaps:

- `/api/term` websocket lifecycle and frontend terminal swap-over
- `/api/attachments` upload/read/delete routes
- remaining git mutation routes (stage/unstage/discard/commit/pull/checkout)
- `/api/diff/branch-compare`
- hunk-level session promote selection
- `scope=all` listing performance and pagination/limits
- path normalization edge-case coverage (drive casing/slash/trailing slash)
- telemetry for session-list latency and empty-result causes
- Cloudflare Artifacts adapter hardening

## Product principles

- review first
- isolate agent edits
- explicit promote to durable git
- runtime-truth provider/model authority
- avoid hidden side effects
