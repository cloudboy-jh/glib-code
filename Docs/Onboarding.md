# Onboarding and First-Run Flow (Current)

Last updated: 2026-05-04

## What exists today

This repo currently supports local development + local desktop shell. Hosted/cloud flows in older docs are not implemented in this codebase.

## Local dev onboarding

Requirements:

- Bun
- Git
- At least one provider API key configured in-app before starting agent sessions

Steps:

1. `bun install`
2. `bun run dev`
3. Open `http://127.0.0.1:5173`
4. Open or clone a git repo
5. Review diffs freely without a provider key
6. Add a provider key in Picker setup or Settings → Models before starting an agent session

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

Hosted account auth behavior is still placeholder:

- `GET /api/auth/session` -> `{ signedIn: false }`
- GitHub auth endpoint exists but returns `501`.

No hosted sign-in/onboarding path should be documented as shipped yet.

## GitTrix session storage

- Ephemeral session workspaces live under `<configDir>/gittrix-sessions/`.
- Agent writes stay in the ephemeral workspace until the user promotes selected changes.
