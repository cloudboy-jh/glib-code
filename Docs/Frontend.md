# Frontend (Current Implementation)

Last updated: 2026-06-04

For product-level topology and runtime/storage boundaries, see `Docs/Architecture.md`. This document covers the current frontend implementation.

## App shell

- Entry: `web/src/App.vue`
- Framework: Vue 3 composition API
- Styling: Tailwind + shared theme tokens
- API target: `import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:4273/api'`

Primary surfaces:

- Picker (no project open)
- Diff mode
- Session mode
- Command palette
- Settings modal
- Theme dialog
- Terminal drawer (UI-only simulation until `/api/term` lands)

Home surface controls in Picker (always-visible grid):

- Theme → opens Settings modal at Appearance tab
- Editor → opens Settings modal at Integrations tab
- GitTrix → opens Settings modal at Git tab
- Model → opens Settings modal at Models tab
- Settings → opens Settings modal at default tab

Picker view hides the sidebar; sidebar only appears when a project is open.

## Data split (real vs mock)

Real API-backed:

- Recents list + recents status (`/projects/recents`, `/projects/recents/status`)
- Project candidate search and open/init/create/forget/remove project actions
- Diff history/files/patch loading (`/diff/items`, `/diff/files`, `/diff/pack`)

Still local/mock in frontend state:

- Terminal drawer output text; `/api/term` exists only as a 501 stub.
- Diff context bundles/chips are frontend-local until sent as prompt context.
- Project provider/model override UX is not wired even though the backend route exists.

Agent/session data-plane now API-backed:

- Session list hydration from `/api/sessions` (project-scoped in session workspace)
- Picker session catalog hydration from `/api/sessions?scope=all` (cross-project)
- Session create through `/api/agent/sessions`
- Prompt send through `/api/agent/sessions/:id/send`
- Timeline streaming through `/api/agent/sessions/:id/stream`
- Abort through `DELETE /api/agent/sessions/:id/turn`
- Session diff/promote through `/api/sessions/:id/diff` and `/api/sessions/:id/promote`
- Session send/stream/abort/hydrate/diff/promote calls include active session `projectPath` so the backend can resolve sessions after reloads, project switches, or stale index state.
- Local promote can stash dirty durable changes and push when the active branch has an upstream.

Now API-backed in settings plane:

- Provider/model capability list via `/api/providers` (pi-discovered)
- Default provider/model updates via `/api/providers/defaults`
- Provider auth key write/remove via `/api/providers/:id/auth`
- Active-provider key actions in Settings and session empty state
- GitHub device auth for GitHub durable mode via `/api/auth/github/device/start` and `/api/auth/github/device/poll`

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
- Inline diff source list when opening in diff mode: expands to show Working tree + last 20 commits, same pattern as the session list. Clicking an entry opens the project directly into that diff, bypassing the DiffWorkbench history screen. Commits are fetched lazily on first expand via `/diff/items?source=commits&limit=20&projectPath=...` and cached in `pickerCommitsByPath` for the session.

## Diff workbench

File: `components/diff/DiffWorkbench.vue`

Current behavior:

- Commit history view (`source=commits`)
- Open a selected commit diff
- Toggle to working tree (`source=uncommitted`)
- File picker for changed files
- Patch rendering via `DiffView.vue` and `@pierre/diffs`
- Start session from selected diff payload (`source/ref/file`)
- `openRequest` prop accepts `mode: 'commit' | 'uncommitted'` in addition to `'history'` and `'session'`. Passing `mode: 'commit'` with a `commitRef` jumps directly into that commit's diff, skipping the history list.
- The active workbench starts sessions from the currently opened file or the whole diff. Hunk/multi-file payload handling exists above the component, but the current selector UI is not wired in.
- Composer footer has icon buttons for file tree (FolderTree) and attach (Paperclip), plus a Send button. The tree button and `/tree` slash command push a full-repo file-tree artifact into the session timeline.
- Session diff modal uses `DiffView.vue` / `@pierre/diffs` for promote review.
- Session promote modal uses a full-width diff surface, optional header file picker for multi-file diffs, and `Commit all` / `Commit selected` actions.
- Diff mode hides the global session header; `DiffWorkbench` owns diff-specific controls.
- File picker opens as a viewport-safe overlay with internal scrolling.

Not implemented in UI yet:

- multi-source drilldown (`branches`, `prs`) as full UX
- hunk-level and multi-file context selection in the active diff workbench; stale `HunkList`/`SelectionTray` components are not currently mounted.

## Session surface

Files:

- `components/session/SessionSidebar.vue`
- `components/session/SessionHeader.vue`
- `components/session/Timeline.vue`
- `components/session/Composer.vue` (+ children)

Current state:

- Session shell/layout is in place.
- Timeline renders user/assistant/error entries plus compact expandable tool-call cards.
- Assistant text is rendered as full markdown via `marked` (GFM + line breaks) + `DOMPurify` sanitization into `v-html`. Handles bold, italic, inline code, links, headings, and lists. Styled via `.prose-agent` CSS class in `main.css`.
- Tool-call cards classify diff/code/json/terminal/tree/error output, hide raw payloads under Inspect, and render unified diffs with `DiffView.vue` / `@pierre/diffs`.
- Tool-call cards with `renderKind: 'tree'` render inline file-tree artifacts using `FileTreeView.vue` / `@pierre/trees`.
- Composer sends real prompts and supports `/tree` and `/stop`/`/abort` command handling.
- Session create/send/stream flows use backend agent routes.
- Session creation is guarded so repeated clicks or keyboard actions reuse the in-flight request instead of creating duplicate sessions.
- Session hydration closes streams for sessions outside the active project.
- Session stream failures are tracked outside the timeline. After repeated failures, the stream closes and the session is marked stale.
- Session infra/send failures show a compact banner with Reload sessions and New replacement actions instead of polluting the timeline.
- Composer disables only for stale sessions or in-flight sends and preserves draft text on failures.
- Composer drafts are scoped per session.
- Header shows a single-line session title with inline status pill plus compact controls (open in editor, model picker, rail reopen toggles). Repo/branch context was removed from the header and now lives in the right rail.
- Left sidebar groups sessions by current project / other projects, includes a search affordance wired to the command palette, and exposes Home / New session / Settings footer actions.
- Right rail is a promote-readiness surface, not an agent-status surface. It shows Session info (branch, state, baseline SHA), the ephemeral→durable boundary, promote history, and a footer with Diff(s) + Commit / Commit+Push actions.
- Boundary polling is boundary-only; the old `/plan` right-rail task-state surface was removed. Poll cadence still speeds up while the active session is running and now refreshes immediately on `turn_end` so touched files update as soon as the agent settles.
- Empty session state explains active model/provider key failures and offers key/model actions.

## File tree artifact

Files:

- `components/shared/FileTreeView.vue`
- `@pierre/trees` (vanilla model)

Behavior:

- Vue wrapper over the vanilla `FileTree` class from `@pierre/trees`, mirroring how `DiffView.vue` wraps `@pierre/diffs`.
- Owns a `FileTree` instance, renders into a ref'd host via `render({ containerWrapper })`, calls `cleanUp()` on unmount, re-renders on prop changes via `resetPaths()` + `setGitStatus()`.
- Props: `paths: string[]`, `gitStatus: Record<string, string>`, `themePreset`.
- Container height is computed from path count (22px compact row height), clamped 120–520px. Trees uses virtualized rendering and requires a concrete container height.
- Density: `compact`. Icons: `complete` with per-file-type colors. All directories start collapsed.
- Theme computed from glib-code's `THEME_PRESETS` tokens via `themeToTreeStyles()` (VS Code–style color keys) plus CSS variable overrides. No hardcoded per-preset map.
- Long path labels are rendered without the library's middle-truncation affordance in the glib wrapper; the tree host scrolls horizontally instead of clipping directory names with internal ellipsis markers.
- Three triggers with scope separation:
  - Composer footer "Tree" button → full repo tree (fetches `/api/fs/paths` + `/api/git/status`).
  - `/tree` slash command → same as button, full repo tree.
  - Agent-emitted `tool_call` with `resultType: 'tree'` and `artifact.tree` → scoped tree (touched paths + ancestor directories with git status badges).
- Same `FileTreeView.vue` component, two input shapes. Trigger decides scope. No user-facing scope toggle.
- Out of scope: persistent tree rail/sidebar, file editing, rename/drag/drop/context-menu, click-to-open-diff (not yet wired).

## Settings + keybindings

- Settings modal and theme picker are wired to local reactive settings and shared presets.
- Models tab manages provider keys and active model selection.
- GitTrix tab lets users select Local/GitHub durable modes, Local/Cloudflare Artifacts ephemeral modes, and the Commit promote strategy. GitHub durable mode requires GitHub sign-in; Cloudflare ephemeral mode is guarded by backend environment preflight.
- GitHub account card supports device sign-in, displays avatar/account when connected, and disconnects app-managed auth.
- Keybindings editor exists; backend keybindings API exists but full parity behavior still needs cleanup.

## Known frontend debts

- Validate picker keyboard navigation through mode -> session-choice -> session-list states.
- Verify overlay/key precedence (`Esc`, `Cmd/Ctrl+K`, `Cmd/Ctrl+J`) across picker/session/settings dialogs.
- Wire real terminal WS when backend `/api/term` is implemented.
- Add project-level provider/model override UX with effective-state display.
- Wire hunk/multi-file session context selection into the current full-width diff workbench without restoring the old side-panel.
- Add frontend regression coverage for duplicate create prevention, stale stream handling, session recovery actions, and projectPath-scoped sends.
