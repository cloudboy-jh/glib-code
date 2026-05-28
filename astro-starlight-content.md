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

- Providers
- Agent
- Sessions
- Diff

Guides:

- Run locally
- GitTrix integration

---

## Introduction

glib-code is a review-first coding workflow for shipping agent-written changes without losing control of durable git state.

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

Vue/Vite app for project picker, diff workbench, sessions, and promote UI.

Key UX points:

- mode selection on project open (Diffs vs Session)
- inline mode cards in recent projects
- typed tool-call rendering in timeline
- diff rendering through Pierre (`@pierre/diffs`)
- in-app destructive confirmations (session delete)
- stale-session recovery actions (reload/new replacement)

### Server

Bun/Hono API for sessions, agent runtime, diff, providers, and promote.

Current responsibilities:

- session metadata/event persistence
- SSE replay + stream
- agent event normalization
- structured tool result typing (`resultType`, `summary`, `artifact`)
- GitTrix session orchestration
- centralized session resolution + route error envelopes

### Desktop

Electron shell wrapping web/server workflow with native integrations (e.g., folder picker).

---

## API Reference

### Providers

- `GET /api/providers`
- `PATCH /api/providers/defaults`
- `POST /api/providers/:id/auth`
- `DELETE /api/providers/:id/auth`

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
- `GET /api/sessions/:id/diff?projectPath=...`
- `POST /api/sessions/:id/promote?projectPath=...`

### Diff

- `GET /api/diff/sources`
- `GET /api/diff/items`
- `GET /api/diff/files`
- `GET /api/diff/hunks`
- `POST /api/diff/pack`

---

## Guides

### Run locally

Requirements:

- Bun
- Git
- pi runtime/CLI
- provider key for agent sessions

Commands:

```bash
bun install
bun run dev
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
├── web/
├── server/
├── shared/
├── desktop/
├── scripts/
└── Docs/
```

## Overall status

Operationally complete for core beta loop:

- diff-first and session-first entry flows are functional
- project-scoped and global session listing both work
- session lifecycle APIs are wired and exercised in UI
- GitTrix isolation is active for normal local session creation
- promote supports guarded mutation paths and optional push

Primary active gaps:

- document sessions list scope contract centrally
- add path normalization edge-case coverage (drive casing/slash/trailing slash)
- harden `scope=all` listing performance and add pagination/limits
- add telemetry for session-list latency and empty-result causes
- finish active hunk/multi-file context wiring in diff workbench
- finalize `/api/term` websocket lifecycle and frontend terminal swap-over

## Product principles

- review first
- isolate agent edits
- explicit promote to durable git
- runtime-truth provider/model authority
- avoid hidden side effects
