# Frontend (Current Implementation)

Last updated: 2026-05-02

## App shell

- Entry: `web/src/App.vue`
- Framework: Vue 3 composition API
- Styling: Tailwind + shared theme tokens
- API target: currently hardcoded `http://127.0.0.1:4273/api` (still needs env switch)

Primary surfaces:

- Picker (no project open)
- Diff mode
- Session mode
- Command palette
- Settings modal
- Theme dialog
- Terminal drawer (UI-only simulation)

Home surface controls in Picker now include:

- Theme quick control
- GitTrix/settings quick control
- Model/settings quick control

## Data split (real vs mock)

Real API-backed:

- Recents list + recents status (`/projects/recents`, `/projects/recents/status`)
- Open/init/create/forget/remove project actions
- Diff history/files/patch loading (`/diff/items`, `/diff/files`, `/diff/pack`)

Still local/mock in frontend state:

- Session list/timeline lifecycle
- Composer send behavior (no backend streaming yet)
- Terminal output text
- Some project/session transitions are still UI-driven fallbacks

Now API-backed in settings plane:

- Provider/model capability list via `/api/providers` (pi-discovered)
- Default provider/model updates via `/api/providers/defaults`
- Provider auth key write/remove via `/api/providers/:id/auth`

## Picker flow

Files:

- `components/picker/PickerScreen.vue`
- `components/picker/RecentList.vue`
- `components/picker/OpenProjectDialog.vue`
- `components/picker/CloneRepoDialog.vue`
- `components/picker/ProjectOpenModeDialog.vue`

Capabilities:

- Open existing path
- Clone dialog and repo URL capture
- Recent list with status badges:
  - `ok`
  - `missing_path`
  - `missing_git`
- Project mode pick when opening (`diff` or `session`)
- Keyboard navigation (`j/k`, arrows, enter)

## Diff workbench

File: `components/diff/DiffWorkbench.vue`

Current behavior:

- Commit history view (`source=commits`)
- Open a selected commit diff
- Toggle to working tree (`source=uncommitted`)
- File picker for changed files
- Patch rendering via `DiffView.vue` and `@pierre/diffs`
- Start session from selected diff payload (`source/ref/file`)

Not implemented in UI yet:

- multi-source drilldown (`branches`, `prs`) as full UX
- hunk-level context selection
- multi-select and selection tray behavior

## Session surface

Files:

- `components/session/SessionSidebar.vue`
- `components/session/SessionHeader.vue`
- `components/session/Timeline.vue`
- `components/session/Composer.vue` (+ children)

Current state:

- Session shell/layout is in place.
- Timeline renders entries with simple message cards.
- Composer supports prompt typing and command trigger UI.
- Backend session + agent routes exist; remaining work is full UI data-plane parity and promote UX.

## Settings + keybindings

- Settings modal and theme picker are wired to local reactive settings and shared presets.
- Keybindings editor exists; backend keybindings API exists but full parity behavior still needs cleanup.

## Known frontend debts

- Remove remaining local mock session state and hydrate from `/api/sessions`.
- Replace any remaining local send simulation with `/api/agent/sessions/:id/send` + SSE stream.
- Remove hardcoded API base and use env/config.
- Wire real terminal WS when backend `/api/term` is implemented.
- Add project-level provider/model override UX with effective-state display.
- Add in-session diff/promote surface with conflict handling.
