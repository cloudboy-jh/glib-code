# Onboarding and First-Run Flow (Current)

Last updated: 2026-04-30

## What exists today

This repo currently supports local development + local desktop shell. Hosted/cloud flows in older docs are not implemented in this codebase.

## Local dev onboarding

Requirements:

- Bun
- Git
- opencode CLI configured (`opencode auth list` should return at least one provider)

Steps:

1. `bun install`
2. `bun run dev`
3. Open `http://127.0.0.1:5173`

Backend server listens on `http://127.0.0.1:4273` in dev.

## Desktop onboarding

- Electron boots and spawns Bun server at `:4173`.
- Window loads `http://127.0.0.1:4173`.
- No desktop auth/sync flow is implemented yet.

## Runtime readiness

Endpoint:

- `GET /api/readiness`

Checks:

- `git`
- `opencode` + authenticated providers (source of truth for provider/model availability)
- `gh` (optional for future PR integrations)

This is the canonical dependency health report for startup UX.

Provider/model capability endpoint:

- `GET /api/providers`

If providers/models are unavailable there, UI provider/model controls must reflect that and block session creation/send.

## Auth state

Current auth behavior is placeholder:

- `GET /api/auth/session` -> `{ signedIn: false }`
- GitHub auth endpoint exists but returns `501`.

No hosted sign-in/onboarding path should be documented as shipped yet.
