# glib-code — frontend.md

> The product is the loop: **review diffs → select context → send to agent**.
> Everyone else makes you prompt cold. glib-code makes you review first.

Scope: every pixel the user sees. Layout, components, navigation, composer, diff mode, session view, terminal, settings, keybindings, theme engine. No backend in this doc.

---

## Thesis

Opencode, Claude Code, t3code, Cursor — they all structure the loop the same way:

1. Open the app
2. Type a prompt
3. Agent does stuff
4. Review what changed

glib-code inverts steps 1–4:

1. Open the app
2. **Browse git — commits, branches, PRs, uncommitted**
3. **Select what's interesting: whole commits, single files, individual hunks**
4. **Send that selection to the agent as grounded context**
5. Type the actual ask with context already attached
6. Agent works from a pre-loaded mental model of the repo

Diff is not a review artifact of the agent's work. Diff is the **input** that structures the agent's work. This is the only thing that matters about the UI.

---

## Entry points

Before any repo is open, glib-code shows a single landing screen — the **Picker**. This is the first-run surface and the "no project open" surface. Reachable anytime via `⌘O` or by clicking the project name in the top bar.

Three paths from here, no nesting.

```
┌─────────────────────────────────────────────────────────────┐
│  [▢] glib-code                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                                             │
│     ┌──────────────────┐      ┌──────────────────┐          │
│     │  Open existing   │      │   New project    │          │
│     │                  │      │                  │          │
│     │  Pick a folder   │      │  Create a git    │          │
│     │  with a .git dir │      │  repo from       │          │
│     │                  │      │  scratch         │          │
│     └──────────────────┘      └──────────────────┘          │
│                                                             │
│     Recent                                                  │
│     ─────────────────────────────────────────               │
│     • cloudboy-jh/glib-code           2 hours ago           │
│     • cloudboy-jh/shipwrkrs           yesterday             │
│     • zyris/ld6                       3 days ago            │
│     • zyris/magi                      last week             │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ⌘O Open   ⌘N New   ⌘K Command                              │
└─────────────────────────────────────────────────────────────┘
```

### Open existing

Native folder picker. User picks a directory. glib-code checks for `.git`:

- **Has `.git`** — adds to Recent, lands the user in **Diff mode** for that repo.
- **No `.git`** — dialog: "This folder isn't a git repo. Initialize one?" with `Initialize` or `Cancel`. On Initialize, runs `git init`, then continues as above.

### New project

Two-step dialog:

1. **Parent directory** — native picker for where to create the project.
2. **Project name** — single input, validated against existing sibling folders.

On confirm, glib-code:

1. Creates the folder at `<parent>/<name>`
2. Runs `git init` inside it
3. Writes a minimal `.gitignore` (`.glib/`, `node_modules/`, `.env*`, `dist/`, `build/`)
4. Adds the new repo to Recent
5. Lands the user in **Session mode** with an empty session — there's nothing to diff yet, so Diff mode would be empty. Session mode is the natural starting point for "I have an idea, help me build it."

The user's first move from here is typically to prompt the agent to scaffold. That's a natural, unforced first turn — no template picker, no scaffolding assumptions baked into glib. The agent is the scaffolder.

### Recent

List of previously-opened repos, newest first. Each row:

- Display name (`<org>/<repo>` if inferable from path, otherwise folder name)
- Relative timestamp
- Right-click menu: Open, Open in file manager, Remove from recents, Forget this project (removes + clears its `.glib/` state)

Clicking a Recent row opens it:

- If the directory still exists and has `.git` → Diff mode
- If the directory still exists without `.git` → same Initialize prompt as Open existing
- If the directory no longer exists → toast "Folder no longer exists" and the row dims, still removable

Recent is capped at 20 entries. Beyond that, oldest drops off.

### Picker keybinds

| Key | Action |
|---|---|
| `⌘O` | Open existing (skips straight to folder picker) |
| `⌘N` | New project |
| `j / k` | Move through Recent |
| `enter` | Open highlighted Recent |
| `⌫` | Remove highlighted Recent from list |

### Project switching mid-session

The Picker is also how you switch projects. Clicking the project name in the top bar from anywhere returns you here. The Command Palette (`⌘K`) has "Switch project..." which opens a compact Popover version of the Picker (Recent only, no big buttons) for faster switching.

---

## Shape

Two top-level modes. Keyboard-first, both reachable from anywhere once a project is open.

| Mode | Key | What it is |
|---|---|---|
| **Diff** | `d` | Git browser. Commits, branches, PRs, uncommitted. Select → Send. |
| **Session** | `s` | Agent chat. Sidebar of sessions, main pane with timeline + composer. |

Everything else (terminal, settings, project switcher) is a drawer or dialog, not a mode.

Default landing for a repo: **Diff**. Because that's the thesis.

---

## Global chrome

```
┌─────────────────────────────────────────────────────────────┐
│  [▢] glib-code   •   repo: cloudboy-jh/glib-code   •   main │  ← top bar
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                     (mode content)                          │
│                                                             │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  d Diff   s Session   ⌘J Term   ⌘K Command                  │  ← footer
└─────────────────────────────────────────────────────────────┘
```

- **Top bar**: app mark, project picker (click the repo name to open a dialog), current branch badge. Collapses to just the mark + repo on narrow widths.
- **Footer**: persistent keybind hints. Non-clicky, non-decorative, functional. Never hidden.
- **Terminal drawer**: slides up from the bottom edge over the footer. `⌘J` toggle. Covers the mode content, footer stays visible above it.
- **Command palette**: `⌘K` anywhere. Actions, session switch, project switch, settings.

No left sidebar by default — the sidebar only exists inside Session mode (for the session list). Diff mode owns the full viewport.

---

## Diff mode (the main event)

### Navigation model

**Drill-down, one level fills the viewport.** Not three panes side-by-side, not a file tree. You move into depth, not across space. Breadcrumbs at the top, current level below.

```
Level 0 → Sources        (what are we diffing?)
Level 1 → Items          (commits / PRs / branch compares)
Level 2 → Files          (files changed in the selection)
Level 3 → Hunks          (hunks within a file)
```

You can multi-select at **any level** and send the union to the agent. The selection travels with you as you drill — pick a commit, drill into its files, deselect one, drill into a file, select only two of its four hunks. The breadcrumb always reflects where you are; the selection counter (top-right) always reflects what's queued.

### Level 0 — Sources

The landing screen of Diff mode. Big buttons, one per source:

- **Uncommitted** — working tree + staged changes
- **Commits** — git log on current branch
- **Branches** — pick any two refs, see `A..B`
- **Pull requests** — remote PRs (GitHub for v1, abstracted for later)
- **Worktree** — _stubbed for v1, shown disabled with "soon" badge_

One click enters Level 1 for that source.

### Level 1 — Items

List of commits / PRs / branch comparisons, depending on source. Each item row shows:

- Checkbox (selection)
- Title (commit subject / PR title / `A..B`)
- Metadata (author, time, stats: `+142 −37`)
- File count badge

Keyboard: `j/k` to move, `space` to select, `enter` to drill into that item's files. Ctrl+A to select all, Esc to clear selection.

"Uncommitted" is a special Level 1 — a single synthetic item containing all current changes. One entry, drill in immediately.

### Level 2 — Files

Files changed in the currently-drilled-into item (or union of items if multi-selected).

```
breadcrumb:  Commits / e3f7a12 "refactor auth" / Files
selection:   2 files selected

  ☐  internal/auth/auth.go                          +24 −11
  ☑  internal/auth/middleware.go                    +87 −3
  ☑  internal/auth/session.go                       +12 −0
  ☐  internal/auth/auth_test.go                     +19 −5
```

Same keybinds as Level 1. `enter` drills into hunks.

### Level 3 — Hunks

The diff itself, rendered with `@pierre/diffs`, but with per-hunk checkboxes in the gutter. This is the *only* place `@pierre/diffs` is used — it's the review surface, nothing else.

```
breadcrumb:  Commits / e3f7a12 / middleware.go / Hunks
selection:   2 hunks selected

  ☐  @@ -14,6 +14,8 @@
       func authMiddleware(next http.Handler) ...
        ...

  ☑  @@ -42,0 +44,15 @@
       + // new session validation
       + func validateSession(r *http.Request) ...
        ...

  ☑  @@ -89,3 +106,0 @@
       - legacyAuth(w, r)
        ...
```

Same keybinds. `space` on a hunk toggles its inclusion.

### The selection tray

Persistent bottom bar inside Diff mode (above the footer, below the viewport). Shows what's queued and the send action.

```
  3 hunks · 2 files · 1 commit                [New session ⏎] [Add to current ⌘⏎]
```

- **New session** — opens Session mode with a new session, diff packet attached as Context, composer focused.
- **Add to current** — if a Session is active, attach to that session's composer. Dimmed if no current session.
- Both land the user in Session mode with the Context block already populated and the cursor in the empty prompt field.

---

## Session mode

```
┌────────────┬────────────────────────────────────────────┐
│  Sessions  │  Session header                            │
│            │  ─ branch toolbar · model · actions ─      │
│  • now     ├────────────────────────────────────────────┤
│  • 14:21   │                                            │
│  • y'day   │  Timeline                                  │
│  • older   │  (messages · work-log · inline diffs)      │
│            │                                            │
│  [+ New]   │                                            │
│            │                                            │
│            ├────────────────────────────────────────────┤
│            │  ▸ Context (3 hunks, 2 files)  [×]         │
│            │  ┌────────────────────────────────────┐    │
│            │  │ prompt...                          │    │
│            │  │                                    │    │
│            │  └────────────────────────────────────┘    │
│            │  /  @  #   ·  model ▾          [Send ⏎]    │
└────────────┴────────────────────────────────────────────┘
```

### Session list (left sidebar)

- Grouped by recency (Now / Today / Yesterday / Older).
- Each row: truncated first-user-message as title, relative time, branch name if non-default.
- `+ New` button creates a blank session on the current branch.
- Sidebar width persisted, collapsible to a rail (icon only) via drag or `⌘\`.

### Session header

One horizontal row. Left to right:

- **Branch toolbar** — current branch name, click to open branch picker (search, switch, create).
- **Worktree toggle** — `local` / `worktree` pill. v1 hides worktree behind a flag (see Out of scope).
- **Model picker** — current model slug, click to pick. Opencode-sourced list.
- **Git actions button** — primary: contextual label (`Commit`, `Commit + Push`, `Push`, `Create PR`), dropdown: all actions. Matches t3code's `GitActionsControl` behavior closely.
- **Session menu** (⋯) — rename, delete, fork.

### Timeline

Not a message list. A list of **timeline entries**, three kinds:

- `message` — user or assistant text, markdown-rendered. Streaming assistant messages highlight as they arrive.
- `work-log` — collapsed tool calls grouped by type. `Read 3 files`, `Edited auth.go`, `Ran tests (exit 0)`. Expandable to show the tool input/output. Edits show an inline `@pierre/diffs` block when expanded.
- `context-block` — the Context packet that was attached when the user sent. Shows as a collapsed card: "Context: 3 hunks, 2 files from e3f7a12." Expand to see the diff inline.

Rendered in turn order. Auto-scrolls to bottom while streaming, stops auto-scroll if user scrolls up.

### Composer

This is where the thesis lives in pixels. The composer has **two stacked regions**:

1. **Context block** (above prompt, collapsible): shows what diff is attached. Each attached item has an `×` to remove. Empty when no diff is attached — in that case the region collapses to zero height.
2. **Prompt field**: multi-line text editor, autocomplete triggers.

```
  ▸ Context: 3 hunks, 2 files from e3f7a12 "refactor auth"  [×]

  ┌──────────────────────────────────────────────────────┐
  │ walk me through why validateSession is being called  │
  │ twice in the middleware path                         │
  │                                                      │
  └──────────────────────────────────────────────────────┘
    /  @  #                model: claude-opus-4.7 ▾     [Send ⏎]
```

Triggers:

- `/` — slash commands (`/clear`, `/fork`, `/model`, custom project scripts)
- `@` — file reference (project file picker, fuzzy search)
- `#` — PR reference (if GitHub connected)

Attachments:

- **Diff context** (the main path, from Diff mode) — shown in the Context block above the prompt.
- **Images** — drag-and-drop into the composer, or paste from clipboard. Up to N images per turn (limit configurable in settings). On drop, images get blob URLs for instant preview; on send, they're uploaded to `/api/attachments` and the returned IDs ride in the turn payload. Pattern follows t3code exactly: optimistic blob preview → server upload → preview URL handoff to stable `/api/attachments/:id` after confirm.

Image attachment UI lives in a thin strip between the Context block and the prompt field, only visible when attachments exist:

```
  ▸ Context: 3 hunks from e3f7a12                  [×]

  [img1] [img2] [+ add]        ← only when images attached

  ┌──────────────────────────────────────────────────┐
  │ prompt...                                        │
  └──────────────────────────────────────────────────┘
```

Enter sends. Shift+Enter for newline. `⌘K` focuses the prompt from anywhere in Session mode.

### Sending a message with context

When the user hits Send:

1. The attached diff becomes the first thing in the turn's context — inlined as a raw unified-diff code block with a preamble line: `User attached the following diff as context:`.
2. The user's prompt text follows on a new line.
3. After the turn completes, the context-block lives in the timeline permanently as a `context-block` entry. It's not re-sent in subsequent turns (opencode handles conversation context from there).

---

## Terminal drawer

`⌘J` to toggle. Slides up from the bottom edge, fixed ~40% viewport height, resizable via a drag handle at its top edge.

- xterm.js inside.
- Spawned with `$SHELL` at the current project's cwd (not worktree for v1).
- One pty per window. Closing the drawer kills the pty — this is a "quick command" terminal, not a persistent shell. A "keep alive" option is post-v1.
- Theme synced from app CSS vars (background, foreground, ANSI palette).
- Keybinds inside xterm take precedence when focused; `⌘J` and global shortcuts always bypass.

---

## Command palette (`⌘K`)

Single input at the top, list below. Fuzzy-matched actions:

- Switch session / switch project
- Jump to Diff / Session / Terminal
- Git: stage all · discard · commit · push
- Session: new · fork · clear · delete
- Settings

Scoped suggestions when the palette is opened from a context — e.g. inside a session, "git actions for this branch" appear first.

---

## Settings

A modal overlay, reachable from anywhere with `⌘,`. Covers everything the user can tune.

### Shape

Centered modal, ~720px wide, ~560px tall, dimmed backdrop. Left rail of sections, right pane of controls. Esc or clicking the backdrop closes. Changes save immediately (no "Save" button) — each control is wired directly to `PATCH /api/settings` or the corresponding resource endpoint.

```
┌─────────────────────────────────────────────────────────┐
│  Settings                                           [×] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  General         │   Theme                              │
│  Appearance      │   [preset dropdown        ▾]         │
│  Keybindings     │                                      │
│  Agent           │   Timestamp format                   │
│  Advanced        │   ○ Locale  ● 24-hour  ○ 12-hour     │
│                  │                                      │
│                  │   Confirm before deleting sessions   │
│                  │   [●───] on                          │
│                  │                                      │
│                  │   …                                  │
│                  │                                      │
└─────────────────────────────────────────────────────────┘
```

### Sections

**General** — default model for new sessions, confirm-destroy toggles, timestamp format.

**Appearance** — theme preset picker (dropdown listing all ported presets). Preview swatch next to each option. Changing the preset swaps CSS variables instantly, no reload.

**Keybindings** — the config surface (see below).

**Agent** — opencode binary path override (blank = use `$PATH`), enable/disable assistant streaming (token-by-token vs buffered), max image attachment size.

**Advanced** — data location paths (read-only), reset settings to defaults, reset keybindings to defaults, open logs folder, telemetry opt-in (off by default).

---

## Keybindings

Two surfaces: the **defaults the app ships with** (documented below) and the **config UI** (Settings → Keybindings) where the user can rebind them.

### Default shortcuts

Global:

| Key | Action | Command |
|---|---|---|
| `d` | Diff mode | `mode.diff` |
| `s` | Session mode | `mode.session` |
| `⌘J` | Toggle terminal | `terminal.toggle` |
| `⌘K` | Command palette | `palette.open` |
| `⌘\` | Toggle session sidebar | `session.sidebar.toggle` |
| `⌘,` | Settings | `settings.open` |
| `⌘O` | Open project (to Picker) | `project.open` |
| `⌘N` | New session (in Session mode) | `session.new` |
| `Esc` | Close drawer / dialog / palette / exit selection | `ui.dismiss` |

Diff mode:

| Key | Action | Command |
|---|---|---|
| `j / k` | Move selection | `diff.move` |
| `space` | Toggle select | `diff.select.toggle` |
| `enter` | Drill into item | `diff.drill.in` |
| `backspace` | Drill out | `diff.drill.out` |
| `⌘A` | Select all at current level | `diff.select.all` |
| `⏎` | Send to new session | `diff.send.new` |
| `⌘⏎` | Add to current session | `diff.send.current` |

Session mode:

| Key | Action | Command |
|---|---|---|
| `⌘⏎` | Send message | `composer.send` |
| `↑` (empty prompt) | Edit last user message | `composer.edit.last` |
| `⌘D` | Open current session's diff in Diff mode | `session.open.diff` |

### Config flow — GUI

Settings → Keybindings lists every action with its current shortcut and a "Record" button. Clicking Record captures the next key combo and writes it to the config. A "Reset this" link on each row restores the default. A "Reset all" button at the bottom wipes user overrides.

Each row also shows the `when` clause in a small caption (e.g. `when: !composerFocus` for `d`). Power users can edit `when` clauses by clicking them — opens a single-line input with syntax hints.

### Config flow — JSON file

Power users can edit `<config-dir>/glib-code/keybindings.json` directly. Format matches t3code's:

```json
{
  "version": 1,
  "rules": [
    { "key": "cmd+j", "command": "terminal.toggle" },
    { "key": "cmd+shift+n", "command": "session.new", "when": "mode == 'session'" }
  ]
}
```

The server watches the file; external edits propagate without a restart. Invalid rules are rejected with a toast showing the error. The GUI writes the same file — no separate config path.

### Resolver behavior

Rules are evaluated last-match-wins. `when` clauses reference frontend context (`composerFocus`, `terminalFocus`, `terminalOpen`, `mode`, etc.). Unknown keys in `when` evaluate to false. Duplicate bindings are valid — the last one wins at event time.

---

## Theme engine

Ported from t3code. The implementation is simple and well-proven — we copy its structure rather than design one.

### How it works

- Every visual property is a CSS variable defined on `:root` and `.dark`.
- Theme switching = toggling the `.dark` class on `document.documentElement` and/or swapping a data attribute like `data-theme="tokyo-night"`.
- xterm.js theme is *derived* from the app CSS vars at runtime: `terminalThemeFromApp()` reads `getComputedStyle(document.body)` and constructs an `ITheme` object (background, foreground, cursor, 16 ANSI colors). Re-derived on theme change so terminal never drifts from app.
- `@pierre/diffs` theme variables (`--diffs-bg`, `--diffs-bg-addition-override`, `--diffs-bg-deletion-override`) are bridged via `color-mix` to the app tokens. One less thing to re-theme per preset.
- Diff worker pool re-inits on theme change so syntax highlighting in diffs stays in sync.

### Token set

Every preset defines the same set. This is the contract — any new preset must fill all of these.

**Structural**
- `--bg` — app background
- `--bg-raised` — cards, composer, context block, modals
- `--bg-sunken` — code blocks, diff gutter, inputs
- `--border` — 1px separators
- `--border-strong` — focus ring, selection outline

**Text**
- `--fg` — primary text
- `--fg-dim` — secondary text, metadata, timestamps
- `--fg-muted` — placeholder, disabled

**Semantic**
- `--accent` — selection, primary action, brand
- `--accent-fg` — text on accent
- `--success` — additions, passed states
- `--destructive` — deletions, destructive actions
- `--warning` — dirty state, warnings

**Terminal** (derived from app tokens when possible, can be overridden per-preset)
- `--term-bg`, `--term-fg`, `--term-cursor`
- `--term-ansi-0` through `--term-ansi-15`

### Typography

Typography is *not* themed. Same type stack for all presets — presets change color, not font. This is by design: brand identity stays consistent across presets.

- **Heading**: DM Sans 700/800
- **UI**: IBM Plex Mono 500/600/700
- **Body / markdown prose**: IBM Plex Mono 500
- **Code / diff / terminal**: IBM Plex Mono 500
- Minimum weight everywhere: 500. No thin type.

### Presets

Ported from glib (the go version). Any preset that glib-go shipped, glib-code ships — except `bento-rose`, which is cut.

Preset list lives in `shared/theme/presets.ts`. Each preset is a plain object mapping token names to values. Adding a new preset is one file, no build step. User-chosen preset is stored in settings and applied at app boot.

v1 ships the full ported preset list. Light mode (toggling `.dark` off) is post-v1 — v1 all presets are dark.

### Density + borders

Not themed, constant across presets.

- Base spacing unit: 4px
- Row height (lists): 28px
- Composer max visible height: 12 rows before internal scroll
- Session sidebar default width: 260px
- Top bar height: 40px
- Footer height: 28px
- No border-radius on structural blocks (panels, cards, composer)
- 2px radius on interactive pills (branch badge, model picker, badges)
- 1px border for all separators — no shadows

---

## Component inventory

The actual atomic list to build, v1 only. `*` = shadcn-vue base, customized.

### Primitives

- `Button*`, `IconButton*`
- `Input*`, `Textarea*`
- `Checkbox*`, `Switch*`, `Radio*`, `Select*`
- `Pill`, `Badge`
- `Dialog*`, `Sheet*`, `Popover*`, `Tooltip*`, `Modal`
- `Breadcrumb`, `KeyHint` (renders `⌘K` style hints)
- `Spinner`, `Toast*`

### App chrome

- `TopBar` — app mark + project picker + branch badge
- `Footer` — keybind hints
- `CommandPalette` — ⌘K surface
- `TerminalDrawer` — xterm.js host

### Picker (entry)

- `PickerScreen` — the three-path landing (Open / New / Recent)
- `RecentList` — list rows with right-click context menu
- `NewProjectDialog` — parent-dir picker + name input

### Diff mode

- `DiffSourceGrid` — Level 0, source buttons
- `ItemList` — Level 1, commits/PRs/branch-compares (generic, fed by source)
- `FileList` — Level 2, files + stats + selection checkboxes
- `HunkList` — Level 3, `@pierre/diffs` with gutter checkboxes
- `SelectionTray` — bottom bar with counts and send buttons
- `BranchCompareDialog` — pick A and B refs

### Session mode

- `SessionSidebar` — session list, grouped
- `SessionHeader` — branch toolbar + model + git actions + menu
- `BranchToolbar` — current branch + picker (mirrors t3code's structure)
- `BranchPicker` — search + switch + create
- `ModelPicker` — opencode model list
- `GitActionsControl` — quick action + dropdown
- `CommitDialog` — file checkboxes + message + default-branch protection
- `Timeline` — ordered timeline entries
- `MessageEntry` — user / assistant message rendering
- `WorkLogEntry` — collapsed tool call group
- `ContextBlockEntry` — attached diff in timeline
- `Composer` — context region + attachment strip + prompt field + trigger menu + send
- `ContextBlock` — collapsible attached-diff card (used in composer and timeline)
- `AttachmentStrip` — image thumbnails with remove buttons, drag-drop target
- `ComposerTriggerMenu` — `/ @ #` autocomplete popover
- `InlineDiff` — small `@pierre/diffs` instance for timeline expansions

### Settings

- `SettingsModal` — ⌘, overlay, section rail + detail pane
- `ThemePicker` — preset dropdown with live preview swatches
- `KeybindingsEditor` — row-per-action list with record button + when-clause caption
- `ShortcutRecorder` — key capture input

### Shared

- `DiffView` — `@pierre/diffs` wrapper with theme sync
- `MarkdownView` — chat markdown rendering with code blocks
- `EmptyState` — empty-list placeholder
- `ErrorBoundary` — toast-on-throw wrapper

---

## Open questions (flagged, not decisions)

1. **Model picker source of truth** — do we read opencode's config for the model list, or maintain a glib-side list that passes through to opencode? Likely the former, since BYO provider.
2. **PR source in Diff mode** — GitHub API with user token, or shell out to `gh`? v1 probably `gh` because it's already installed for the target user.
3. **Session rename** — auto-title from first user message (like t3code), or manual-only? Auto + manual override is probably right.
4. **Diff mode "watch" mode** — when uncommitted changes update on disk, does Level 2/3 refresh live? Probably yes via fs watcher, but adds scope.
5. **Session-to-Diff deep link** — `⌘D` in session opens the session's touched files in Diff mode. Nice-to-have for v1, not essential.

---

## Out of scope (v1)

- Worktree environment mode (`local` only — worktree toggle shows but is disabled with "soon")
- Plan sidebar / proposed-plan entries (t3code has this, we don't yet)
- Pull request creation flow (we show PR diffs, we don't create PRs)
- Light theme (all preset ports are dark; light mode lands post-v1)
- Remote mode (running Hono on Cloudflare Worker for browser-only hosted use)
- Multi-project open simultaneously
- Auto-update (handled post-v1 via electron-updater)
- MCP server config UI
- Plugin system
