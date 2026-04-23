# T3 Component Parity Checklist (Locked Source + Scope Split)

Pinned source repo: `https://github.com/pingdotgg/t3code`

Pinned commit: `b8305afa29309e52045987caab91db9b7e481ac0`

Reference clone path: `C:\Users\johns\OneDrive\Desktop\t3code-ref`

---

## Scope lock (read this first)

- T3 parity is required for: app shell, sidebar/session surfaces, header/actions, composer, settings, overlays, keyboard behavior.
- Diff surface is **not** t3-column parity.
- Diff surface follows **glib-go style reader** using `@pierre/diffs` (TypeScript), with project + commit picker flow.

If a visual/interaction decision conflicts between t3 and glib diff spec:

- Use t3 for non-diff surfaces.
- Use glib diff spec for diff surfaces.

---

## 1) Canonical t3 files to mirror

- Root shell + route composition
  - `apps/web/src/routes/__root.tsx`
  - `apps/web/src/components/AppSidebarLayout.tsx`
  - `apps/web/src/routes/_chat.tsx`
  - `apps/web/src/routes/_chat.$environmentId.$threadId.tsx`

- Theme/tokens/global CSS
  - `apps/web/src/index.css`

- Primitive layer
  - `apps/web/src/components/ui/button.tsx`
  - `apps/web/src/components/ui/input.tsx`
  - `apps/web/src/components/ui/textarea.tsx`
  - `apps/web/src/components/ui/card.tsx`
  - `apps/web/src/components/ui/dialog.tsx`
  - `apps/web/src/components/ui/sheet.tsx`
  - `apps/web/src/components/ui/command.tsx`
  - `apps/web/src/components/ui/sidebar.tsx`
  - `apps/web/src/components/ui/tooltip.tsx`
  - `apps/web/src/components/ui/select.tsx`
  - `apps/web/src/components/ui/menu.tsx`
  - `apps/web/src/components/ui/scroll-area.tsx`
  - `apps/web/src/components/ui/toast.tsx`

- Feature components
  - `apps/web/src/components/Sidebar.tsx`
  - `apps/web/src/components/CommandPalette.tsx`
  - `apps/web/src/components/ChatView.tsx`
  - `apps/web/src/components/GitActionsControl.tsx`
  - `apps/web/src/components/ThreadTerminalDrawer.tsx`
  - `apps/web/src/components/settings/*`

- Keyboard behavior
  - `KEYBINDINGS.md`

---

## 2) Vue target map (first-pass decomposition)

- `web/src/components/session/SessionSidebar.vue` → t3 `Sidebar.tsx`
- `web/src/components/session/SessionHeader.vue` → t3 `ChatHeader` + `GitActionsControl.tsx`
- `web/src/components/session/Timeline.vue` → t3 `MessagesTimeline.tsx`
- `web/src/components/session/Composer.vue` → t3 `ChatComposer.tsx`
- `web/src/components/app/CommandPalette.vue` → t3 `CommandPalette.tsx`
- `web/src/components/app/TerminalDrawer.vue` → t3 `ThreadTerminalDrawer.tsx`
- `web/src/components/settings/SettingsModal.vue` → t3 `SettingsPanels.tsx`

---

## 3) Non-diff parity checklist

### Global
- [ ] Use pinned commit as single source of truth (no visual guessing).
- [ ] Keep Vue runtime; replicate structure/spacing/states 1:1.
- [ ] Keep shadcn-vue primitives only for base controls.
- [ ] Remove ad-hoc colors/radii/shadows not backed by tokens.
- [ ] Remove overlay effects not present in source.

### Typography + tokens
- [ ] UI/chat/body font hierarchy matches source.
- [ ] Code/diff/terminal surfaces use mono only.
- [ ] Port token values from source CSS variables.
- [ ] Match border/radius/shadow scales across components.
- [ ] Match muted foreground levels for timestamps/meta labels.

### Shell + sidebar + header
- [ ] Sidebar mount/collapse behavior matches source.
- [ ] Sidebar row density, grouping labels, and active state match source.
- [ ] Header height, border treatment, action order, and control sizing match source.

### Timeline + composer
- [ ] Empty state composition/weight matches source.
- [ ] Timeline card spacing, border opacity, and label styles match source.
- [ ] Composer dock/layout, placeholder, and action strip match source.

### Overlays + settings + terminal
- [ ] Command palette size/backdrop/list interaction matches source.
- [ ] Settings modal size/sections/field rhythm matches source.
- [ ] Terminal drawer docking/controls/typography matches source.

### Keyboard and focus behavior
- [ ] `cmd/ctrl+k` palette toggle.
- [ ] `cmd/ctrl+j` terminal toggle.
- [ ] `esc` closes top-most overlay first.
- [ ] Focus trap + focus return behavior matches source.

---

## 4) Diff surface contract (glib-go parity, not t3 columns)

- [ ] Replace any column-style diff shell with unified reader flow.
- [ ] Top controls: **Project picker** + **Commit picker**.
- [ ] Navigation: pick project → pick commit → file list → unified diff pane.
- [ ] Renderer: `@pierre/diffs` for unified hunks.
- [ ] Selection model: selected file/hunk context tracked for agent attach flow.
- [ ] Layout: single-reader surface, no side-by-side diff columns.

---

## 5) First set of implementation changes (now)

- [x] Split `web/src/App.vue` shell into parity-mapped Vue feature components only.
- [x] Normalize spacing/radius/typography tokens in `web/src/main.css` to t3 values.
- [x] Align `SessionSidebar.vue` structure/states to t3 `Sidebar.tsx` sections.
- [x] Align `SessionHeader.vue` actions/order/sizing to t3 header contract.
- [x] Align `Timeline.vue` block spacing + meta hierarchy to t3 timeline contract.
- [x] Align `Composer.vue` action strip + send control geometry to t3 composer contract.
- [x] Align `CommandPalette.vue` dimensions and key navigation behavior to t3 contract.
- [x] Align `SettingsModal.vue` section grouping and control rhythm to t3 settings contract.
- [x] Replace current diff shell with project+commit unified reader contract.

---

## 6) Acceptance gate

- [ ] Screenshot parity review complete for non-diff surfaces.
- [ ] Diff reader flow reviewed against glib-go contract.
- [ ] Build + typecheck pass.
- [ ] No placeholder-only behavior in primary UI paths.
