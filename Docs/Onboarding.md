# glib-code — onboarding.md

> Distribution surfaces, first-run flows, and auth. Everything between "user discovers glib-code" and "user sees the Picker."

Scope: the three surfaces glib-code ships on, their auth models, readiness checks, and first-run UX. No pixel-level UI decisions beyond what's structurally required — see `frontend.md`.

---

## Three surfaces

glib-code ships as three products sharing one codebase.

| Surface | Who runs the server | Where repos live | Account | Cost |
|---|---|---|---|---|
| **Self-host** | User, on their box | User's local filesystem | None | Free forever |
| **Desktop** | User, via Electron | User's local filesystem | Optional (enables sync) | Free |
| **Hosted (glibcode.com)** | Us, on Cloudflare | Two modes: user's machine (bridge) or glib storage (R2) | Required | Paid (free tier at v1) |

The **server code is the same** across all three. What differs is:

- **Host** — Electron vs plain Bun vs Cloudflare Workers
- **Persistence backend** — local FS vs local FS vs D1 + R2
- **Auth** — none vs optional vs required

All three speak the same `AppType` RPC contract. The frontend is one Vue app.

---

## Architectural consequence

The backend split is:

```
server/
├── core/                      — shared Hono routes + services
│   (projects, diff, git, agent, sessions, settings, keybindings)
│
└── adapters/
    ├── local/                 — fs-backed impls (desktop + self-host)
    │   ├── storage.ts         — reads .glib/ on disk
    │   ├── auth.ts            — no-op or optional GitHub OAuth
    │   └── repos.ts           — direct filesystem access
    │
    └── cloud/                 — D1 + R2 impls (hosted)
        ├── storage.ts         — D1 for session metadata, R2 for JSONL
        ├── auth.ts            — Cloudflare + GitHub OAuth
        ├── repos.ts           — R2-backed workspaces or bridge protocol
        └── bridge.ts          — WebSocket tunnel to desktop agent
```

Core routes are adapter-agnostic. The entry point picks an adapter at boot based on a build-time constant or environment flag.

This preserves the "one server" promise — the HTTP shape, event shape, and frontend don't change between surfaces. The storage/auth implementations swap out.

---

## Self-host flow

Simplest path. Audience: individual developers, privacy-conscious users, Linux users who dislike Electron, Jack.

### First launch

```
$ bun install -g glib-code
$ glib serve
  → starting on http://localhost:4173
  → opening browser...
```

Browser opens, user lands on the **Readiness screen** if checks fail, or the **Picker** if everything is ready.

### Readiness check

Before the Picker, the server runs:

```
GET /api/readiness
```

Returns:

```ts
type ReadinessReport = {
  ok: boolean;
  checks: {
    git:      { ok: boolean; version?: string; error?: string };
    opencode: { ok: boolean; version?: string; error?: string; providers?: string[] };
    gh:       { ok: boolean; version?: string; error?: string };   // optional
  };
};
```

- **`git`** — required. `git --version` must succeed.
- **`opencode`** — required. `opencode --version` succeeds AND `opencode auth list` returns ≥1 provider.
- **`gh`** — optional. Needed for PRs in Diff mode; if absent, the PRs source shows disabled with a hint.

If `ok: false`, the Readiness screen renders with copy-pasteable install commands per missing piece:

```
┌──────────────────────────────────────────────────────────┐
│ Almost there                                             │
├──────────────────────────────────────────────────────────┤
│ glib-code needs a few things before it can run.          │
│                                                          │
│  ✓  git                                                  │
│  ✗  opencode                                             │
│     Install:  curl -fsSL https://opencode.ai/install     │
│     Then:     opencode auth login                        │
│                                                          │
│  ✗  gh (optional, for pull request diffs)                │
│     Install:  brew install gh                            │
│                                                          │
│  [Recheck]                                               │
└──────────────────────────────────────────────────────────┘
```

Recheck re-hits `/api/readiness`. When required checks turn green, "Continue" routes to the Picker.

### No account, no sign-in

Self-host has no user concept. Settings, recents, and session transcripts live on disk under the OS config dir + each repo's `.glib/`. Nothing syncs anywhere.

### GitHub via `gh`

The `gh` CLI handles GitHub auth. We shell out to it; we don't implement OAuth ourselves in self-host. Users run `gh auth login` once and forget about it.

---

## Desktop flow

Electron app. Same as self-host under the hood, plus **optional** sign-in to sync state across devices via glibcode.com.

### First launch

1. Electron boots, spawns Bun server, opens BrowserWindow.
2. Readiness screen runs first (same as self-host).
3. Once ready, a one-time **Welcome** overlay before routing to Picker:

```
┌──────────────────────────────────────────────────────────┐
│ Welcome to glib-code                                     │
├──────────────────────────────────────────────────────────┤
│ Review-first AI coding.                                  │
│                                                          │
│ Do you want to sign in?                                  │
│                                                          │
│ Signed-in users get:                                     │
│   • Recents and settings synced across devices           │
│   • Session transcripts backed up to glibcode.com        │
│   • Ability to hop onto glibcode.com and bridge back     │
│     to this machine                                      │
│                                                          │
│ Everything works without signing in.                     │
│                                                          │
│  [Sign in with GitHub]    [Continue without signing in]  │
└──────────────────────────────────────────────────────────┘
```

"Continue without signing in" → self-host behavior, local only. User can sign in later from Settings → Account.

### Sign-in flow

GitHub OAuth via Cloudflare Workers backend at `https://glibcode.com/auth/github`.

1. Electron opens the system browser to `https://glibcode.com/auth/github?device=desktop&port=<loopback>`.
2. User completes OAuth on github.com.
3. Worker handles callback, creates/finds the user in D1, issues a JWT.
4. Worker redirects to `http://localhost:<port>/auth/callback?token=<jwt>`.
5. Electron's local server receives the token, stores it in the OS keychain, frontend switches to signed-in state.

The same token is used for:
- Syncing recents, settings, and session metadata to glibcode.com
- GitHub API calls (the GitHub OAuth token is stored server-side in D1, keyed by user)
- Registering as a bridge target when the user visits glibcode.com from another device

### Sync protocol

- Writes are **local-first**. Changes hit disk, then enqueue to a sync queue.
- Queue drains to `PATCH /api/sync/{recents,settings,sessions}` on the Worker.
- Conflicts resolve last-write-wins per key, using D1 timestamps.
- No real-time collab — sync is eventual.

Signed-in state is always optional. If the backend is unreachable, desktop falls back to local-only with a muted "offline" badge. Nothing blocks.

---

## Hosted flow (glibcode.com)

Fully web. No install required. Cloudflare-native: Pages for static, Workers for server logic, D1 for user/session metadata, R2 for transcripts and cloud workspaces.

### Landing + sign-up

glibcode.com serves a landing page at `/` for signed-out users and the full app at `/app` after sign-in. GitHub OAuth only (v1).

- New user → GitHub OAuth → D1 row created → `/app`.
- Returning user → token cookie valid → `/app`.

### Workspace choice per session

This is the one thing hosted has that the others don't. When creating a new session, the user picks where the work runs:

```
┌──────────────────────────────────────────────────────────┐
│ New session                                              │
├──────────────────────────────────────────────────────────┤
│ Where should this session run?                           │
│                                                          │
│  ● My machine (bridge)                                   │
│    Uses your desktop app as a bridge.                    │
│    Your files never leave your computer.                 │
│    Requires: desktop app running + signed in.            │
│                                                          │
│    Status: ● Connected (jack's MacBook Pro)              │
│                                                          │
│  ○ glib cloud                                            │
│    glib clones your repo into secure storage.            │
│    Runs opencode server-side. Free tier: 3 repos.        │
│                                                          │
│  [ Continue ]                                            │
└──────────────────────────────────────────────────────────┘
```

### Bridge mode

User's own desktop app hosts the server; glibcode.com is a rendering client over a tunnel.

- Desktop app, on sign-in, opens an outbound WebSocket to `wss://glibcode.com/bridge`.
- Worker registers the desktop's connection keyed by user ID.
- When the glibcode.com frontend calls `/api/projects` etc., the Worker routes the request through the bridge WebSocket to the desktop server and returns the response.
- Streaming endpoints (SSE for agent, WS for terminal) are passed through as virtual tunnels multiplexed over the same bridge WS.

Bridge drops → glibcode.com shows an offline indicator with options: "Wait for bridge" or "Switch to glib cloud."

### Cloud mode

Repos live in R2. opencode runs in a Durable Object per active session with the workspace mounted.

- User picks a GitHub repo from their synced list (populated via GitHub OAuth token).
- Worker clones into R2 under `users/<uid>/workspaces/<repoId>/`.
- Session start spins up a DO, checks out the workspace to ephemeral disk, spawns opencode.
- opencode events stream back to the frontend using the same `AgentEvent` shape.
- Session end: DO pushes changes back to R2. A "Push to GitHub" action pushes the working branch to the user's remote; PR creation stays manual.

Cloud mode has compute + storage cost. v1 ships a simple free tier (3 cloud repos, monthly minute cap). Paid tier TBD.

### opencode providers in cloud mode

Cloud DOs ship with opencode pre-installed. The user doesn't install anything locally. They **do** need to bring a provider key (Anthropic, OpenRouter, etc.) — configured via Settings → Providers, stored encrypted in D1 per user, injected into the DO's opencode config on session start.

Bridge mode uses the user's local opencode, so provider setup happens once via `opencode auth login` on their machine — identical to self-host.

---

## Auth architecture summary

| Surface | glib account | GitHub auth | opencode provider |
|---|---|---|---|
| Self-host | None | `gh auth login` | `opencode auth login` |
| Desktop (local) | None | `gh auth login` | `opencode auth login` |
| Desktop (signed in) | GitHub OAuth via glibcode.com | Same OAuth token powers PR access | `opencode auth login` on machine |
| Hosted / Bridge | Required | OAuth at sign-in | `opencode auth login` on user's desktop |
| Hosted / Cloud | Required | OAuth at sign-in | Provider key entered in glib UI, stored encrypted in D1 |

**One thing glib-code NEVER owns in any mode:** the model-provider API keys themselves. In local/bridge modes, they live in opencode's own config. In cloud mode, they live encrypted in D1 and are only decrypted inside the DO at session start. glib has no "read an API key" code path outside the DO.

---

## Readiness matrix

| Check | Self-host | Desktop (local) | Hosted / Bridge | Hosted / Cloud |
|---|---|---|---|---|
| `git` | Required | Required | Required on desktop | Pre-installed |
| `opencode` | Required | Required | Required on desktop | Pre-installed |
| opencode provider | Required | Required | Required on desktop | Configured via glib UI → DO |
| `gh` | Optional | Optional | Optional on desktop | Pre-installed |
| glib account | — | Optional | Required | Required |

---

## First-run flow per surface

**Self-host:**
1. `glib serve` → browser opens
2. Readiness screen if anything missing → install + recheck
3. Picker

**Desktop:**
1. Launch app → Readiness screen if anything missing → install + recheck
2. Welcome overlay → Sign in or Continue
3. Picker

**Hosted:**
1. Visit glibcode.com → marketing landing
2. Sign in with GitHub → OAuth → `/app`
3. Empty state: "Start your first session" → Bridge or Cloud choice
4. **Bridge**: prompt to install/open desktop app → pairing (same GitHub account) → bridge connects → Picker-equivalent with bridged filesystem
5. **Cloud**: pick a GitHub repo → clone into R2 → Picker-equivalent with that repo loaded

---

## Backend additions this implies

Beyond what's in `backend.md`:

### New routes

```
GET    /api/readiness                        → ReadinessReport
GET    /api/auth/session                     → { signedIn: boolean, user?: User }
POST   /api/auth/github                      (desktop: opens system browser)
POST   /api/auth/signout

# Hosted / Worker only
GET    /auth/github                          (OAuth entry)
GET    /auth/github/callback
GET    /api/sync/recents    · PATCH /api/sync/recents
GET    /api/sync/settings   · PATCH /api/sync/settings
GET    /api/sync/sessions   · POST  /api/sync/sessions/:id

# Bridge
WS     /bridge                                (desktop → worker tunnel)
GET    /api/bridges                          → BridgeStatus[]   (for the UI)

# Cloud mode
GET    /api/workspaces                       → CloudWorkspace[]
POST   /api/workspaces                       { repoUrl, ref? } → CloudWorkspace
DELETE /api/workspaces/:id
POST   /api/providers                        { provider, key } → { ok: true }
                                             // stored encrypted in D1
```

### New services

- **`readiness`** — shells out to `git --version`, `opencode --version`, `opencode auth list`, `gh --version`. Caches for 30s.
- **`auth`** — GitHub OAuth flow, token storage (OS keychain on desktop, D1 on hosted), session validation.
- **`sync`** — local ↔ cloud reconciliation for recents, settings, session metadata.
- **`bridge`** (desktop) — outbound WS to glibcode.com, request routing.
- **`bridge`** (worker) — accepts desktop connections, routes incoming HTTP from hosted frontend to the right desktop.
- **`cloud-workspace`** (worker) — R2 clone/push, DO lifecycle for cloud mode sessions.

---

## Out of scope (v1)

- Real-time collab (multiple users on one session)
- SSO / enterprise auth
- Team workspaces
- Paid tiers (free tier only at v1, pricing decided later)
- Mobile-first (glibcode.com may render, but no mobile design)
- Offline for hosted
- Automatic PR creation from cloud mode (v1: push branch, user opens PR on github.com)
- Non-GitHub providers (GitLab, Bitbucket) — post-v1
