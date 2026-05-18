# Onboarding and First-Run Flow (Current)

Last updated: 2026-05-18

## What exists today

This repo currently supports local development + local desktop shell. Hosted/cloud flows in older docs are not implemented in this codebase.

## Local dev onboarding

Requirements:

- Bun
- Git
- pi CLI installed locally for desktop/local agent sessions
- At least one provider API key configured in-app before starting agent sessions

Steps:

1. `bun install`
2. `bun run dev`
3. Open `http://127.0.0.1:5173`
4. Open or clone a git repo
5. Review diffs freely without a provider key
6. Add a provider key in Picker setup or Settings → Models before starting an agent session
7. Use Settings → GitTrix to choose Local or GitHub durable storage before promoting session changes

Backend server listens on `http://127.0.0.1:4273` in dev.

## Desktop onboarding

- Run `bun run dev:desktop` for local desktop development.
- The dev stack starts the backend on `http://127.0.0.1:4273`, Vite on `http://127.0.0.1:5173`, and Electron.
- Electron loads the Vite app in dev and opens DevTools.
- Vite uses strict port `5173`; stale dev processes must be stopped instead of letting Vite drift to another port.
- Production Electron starts the backend on `:4273` and loads `web/dist/index.html` after `bun run build`.
- No desktop auth/sync flow is implemented yet.

## Runtime readiness

Endpoint:

- `GET /api/readiness`

Checks:

- `git`
- pi provider capability + authenticated providers
- pi CLI availability for local RPC runtime work
- `gh` (optional for future PR integrations)

This is the canonical dependency health report for startup UX.

Provider/model capability endpoint:

- `GET /api/providers`

If providers/models are unavailable there, UI provider/model controls must reflect that and block session creation/send.

## Auth state

Provider auth behavior:

- `POST /api/providers/:id/auth` saves provider API key
- `DELETE /api/providers/:id/auth` removes provider API key
- `GET /api/providers` reflects authenticated providers/models
- Keys are saved under glib-code app config at `<configDir>/pi/auth.json`
- glib-code does not read other apps' auth stores
- RPC runtime injects the selected key into the pi subprocess environment instead of writing it into sandbox disk.

GitHub account auth behavior in local/desktop:

- `GET /api/auth/session` reports whether app-managed GitHub auth, `GITHUB_TOKEN`, `GH_TOKEN`, or `gh auth token` is available.
- `POST /api/auth/github` verifies GitHub auth for GitTrix GitHub durable operations.
- `POST /api/auth/github/device/start` and `POST /api/auth/github/device/poll` support in-app GitHub device OAuth when `GITHUB_OAUTH_CLIENT_ID` or `GH_OAUTH_CLIENT_ID` is configured.
- App-managed GitHub tokens are stored under `<configDir>/auth/github.json` and are checked before environment or `gh` fallback tokens.
- Users can also sign in by running `gh auth login` locally or by launching glib-code with `GITHUB_TOKEN`/`GH_TOKEN` set.

No hosted browser OAuth sign-in/onboarding path should be documented as shipped yet.

## GitTrix session storage

- Ephemeral session workspaces live under `<configDir>/gittrix-sessions/`.
- Local ephemeral session workspaces are git-backed worktrees with clone fallback.
- Agent writes stay in the ephemeral workspace until the user commits all or selected changes through promote.
- Local durable promote blocks overlapping dirty durable files, offers stash-and-continue, and can push when the branch has an upstream.
- GitHub durable promote uses app-managed GitHub auth first, then environment/`gh` fallback tokens.
- Hosted sandboxes install pi inside the sandbox automatically; hosted deployment/sync is not shipped yet.

## Local session validation

Before calling local sessions ready, run the short checklist in `Docs/session-smoke-test.md`.
