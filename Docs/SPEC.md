# glib-code — spec.md

> Terminal-native agent workspace. Review first, then prompt.

Repo: `cloudboy-jh/glib-code` · Domain: `glibcode.com`

---

## Thesis

Opencode, Claude Code, t3code, Cursor — they all make you prompt cold, then review what the agent did. glib-code inverts the loop:

**Browse git → select commits / files / hunks → send as context → prompt the agent.**

Diff is the *input* that structures the agent's work, not a review artifact of it. This is the only thing that matters about the product.

---

## Stack

- **Server runtime**: Bun
- **Server framework**: Hono
- **Frontend**: Vue 3 + Vite, shadcn-vue primitives
- **Typed RPC**: `hc<AppType>` exported from `server/`, consumed by `web/`
- **Agent**: `opencode run --format json` (BYO provider)
- **Diffs**: `@pierre/diffs`
- **Git**: `simple-git` + `gh` CLI for PRs
- **Terminal**: `xterm.js` + `node-pty` (pty via Bun subprocess when possible, Node fallback otherwise)
- **Streaming**: SSE for agent events, WebSocket for pty
- **Theme engine**: CSS variables + `.dark` class, ported from t3code. Preset list ported from glib (go version), minus `bento-rose`.
- **Persistence**: JSONL per session under `<repo>/.glib/sessions/`, app state under OS user config dir

---

## Two hosts, one server

The Hono server is the product. It runs in either of two hosts:

### Desktop (Electron)

`desktop/` spawns Bun running `server/` as a child process, then opens a `BrowserWindow` pointed at its local port. Electron exists only to package the app for distribution and provide native chrome. Electron's main process is Node (no choice — Chromium ships Node). The Bun server runs as a Node child, communicating over the same loopback HTTP the browser build uses.

### Browser (self-host)

`bun server/` standalone. User opens `http://localhost:<port>` in any browser. Identical experience to the Electron build — the Vue app has no knowledge of which host it's running in. This is the path for Jack's daily use, for anyone on Linux who dislikes Electron, and for running glib-code on a LAN box and pointing a laptop browser at it.

Both hosts share:

- Same `server/` code
- Same `web/` code
- Same state format (user config dir + `.glib/` in each repo)
- Same typed RPC contract

Electron is never "the shell." The server is the shell; Electron is one way to distribute it.

---

## Repo layout

Flat. Three apps, one shared package.

```
glib-code/
├── server/        ← Bun + Hono. The product.
├── web/           ← Vue 3 + Vite. Served by Hono at /.
├── desktop/       ← Electron wrapper. Spawns server, opens window.
└── shared/        ← Zod schemas, AppType re-export, theme tokens,
                     event types, anything used by 2+ apps.
```

Bun workspaces. One `bun.lock`. Each app has its own `package.json`.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Hono server (Bun)                        │
│                                                             │
│   HTTP + SSE + WS on 127.0.0.1:<port>                       │
│   ┌───────────────────────────────────────────────────┐     │
│   │  /api/projects  /api/repo  /api/diff  /api/git    │     │
│   │  /api/fs  /api/agent/*  /api/sessions  /api/term  │     │
│   │  /api/settings  /api/keybindings                  │     │
│   │  /            — serves web/ build                 │     │
│   └───┬─────────────────┬──────────────┬──────────────┘     │
│       │                 │              │                    │
│       ▼                 ▼              ▼                    │
│   simple-git        opencode         node-pty               │
│   + gh CLI          subprocess       subprocess             │
│                    (per turn)       (per window)            │
└─────────────────────────────────────────────────────────────┘
                    ▲
                    │
                    │ loopback HTTP + SSE + WS
                    │
        ┌───────────┴──────────────┐
        │                          │
┌───────┴────────┐        ┌────────┴────────┐
│ Electron host  │        │  Browser host   │
│ (desktop/)     │        │ (bun server/)   │
│                │        │                 │
│ BrowserWindow  │        │ Any browser tab │
│ loads http://  │        │ at http://…     │
└────────────────┘        └─────────────────┘
```

---

## Docs

- [`frontend.md`](./frontend.md) — layout, entry picker, Diff mode drill-down, Session mode, composer, theme engine, settings modal, component inventory
- [`backend.md`](./backend.md) — Hono routes, services, opencode subprocess model, settings + keybindings persistence, hosts (Electron + browser), transports
- [`agent.md`](./agent.md) — opencode event schema, AgentEvent wire format, transform rules, TimelineEntry reducer
- `build-order.md` — step-by-step build sequence referencing the above *(next)*

---

## Build order (high-level)

1. **Scaffold** — Bun workspaces, `server/` + `web/` + `desktop/` + `shared/`. One typed round-trip through `hc<AppType>` proves the wiring.
2. **Browser host first** — `bun server/` serves `web/` at `/` and JSON at `/api/*`. Open in Chrome. This is the dev inner loop forever.
3. **Picker** — Open existing / New project / Recent. `recents.json` under OS config dir, `.git` detection, `git init` flow.
4. **Git service** — `simple-git` wrapper, status/stage/commit/push/branches/log. No UI yet.
5. **Diff mode** — drill-down (Sources → Items → Files → Hunks), `@pierre/diffs` rendering, selection tray, `/api/diff/pack`. Branch compare. PRs via `gh`.
6. **Session shell** — sidebar, header (branch, model, git actions), empty timeline, composer without triggers.
7. **Agent v0** — opencode subprocess per turn, SSE stream, text-only message rendering.
8. **Agent v1** — work-log entries (tool calls), inline diffs after edits, abort.
9. **Context flow** — Diff selection → composer Context block → agent turn preamble → timeline `context-block` entry. The headline feature end-to-end.
10. **Session persistence** — JSONL writer, session list, fork, reconnect-with-replay.
11. **Composer triggers + image attachments** — `/` commands, `@` file refs, `#` PRs, drag-drop images with blob-preview → base64-on-send handoff (t3code's pattern).
12. **Theme engine + presets** — port t3code's CSS-var engine, ship glib-go's presets (minus `bento-rose`), theme picker in settings.
13. **Settings modal** — `⌘,` overlay. General, appearance, keybindings, advanced.
14. **Keybindings system** — JSON-file-backed, GUI record-shortcut per action, live `when`-clause resolver.
15. **Terminal drawer** — xterm.js + node-pty over WebSocket, theme synced from app CSS vars.
16. **Command palette** — `⌘K`, switch / new / git quick actions.
17. **Desktop packaging** — `desktop/` Electron shell, electron-builder for macOS / Windows / Linux. glibcode.com landing page. First release.

Multi-worktree, remote mode (Hono on Cloudflare), auto-update, MCP config UI — post-v1.

---

## What's out of scope for v1

See `frontend.md` and `backend.md` for full lists. Headlines:

- Multi-worktree / parallel agents
- Remote mode (Hono on Cloudflare Worker)
- Auto-update
- MCP server config UI
- Plugin system
- Light theme (`.dark` default, light preset lands post-v1)
- Multi-window session sync
