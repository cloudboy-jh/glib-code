<template>
  <div class="h-screen w-screen overflow-hidden bg-background text-foreground">
    <div class="grid h-full grid-cols-[auto_1fr]">
      <div class="relative h-full border-r border-border/60 bg-card" :style="{ width: `${sidebarWidth}px` }">
        <SessionSidebar
          :sessions="sessions"
          :active-id="state.activeSessionId"
          :collapsed="state.sidebarCollapsed"
          :logo-wordmark-src="logoWordmarkSrc"
          :logo-icon-src="logoIconSrc"
          @select="selectSessionFromSidebar"
          @new="createSession"
          @go-home="goHome"
          @open-settings="state.settingsOpen = true"
          @toggle-collapse="toggleSidebarCollapse"
        />

        <button
          v-if="!state.sidebarCollapsed"
          type="button"
          class="absolute inset-y-0 -right-2 z-10 hidden w-4 cursor-col-resize bg-transparent transition-colors after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent hover:after:bg-border md:block"
          aria-label="Resize sidebar"
          @mousedown="startSidebarResize"
        />
      </div>

      <section :class="['grid h-full', currentProject ? 'grid-rows-[54px_1fr]' : 'grid-rows-[1fr]']">
        <SessionHeader
          v-if="currentProject"
          :title="activeSession?.title ?? 'No active session'"
          :project="currentProject.name"
          :branch="currentProject.branch"
          :model="settings.defaultModel"
          @diff-current="openCurrentSessionDiff"
          @diff-commits="openCommitsListDiff"
          @open-model="state.settingsOpen = true"
          @git-action="noop"
        />

        <main class="min-h-0">
          <template v-if="!currentProject">
            <div class="grid h-full place-items-center px-6">
              <PickerScreen
                :recents="recents"
                :logo-src="logoWordmarkSrc"
                :pending-project-path="pendingProjectOpen?.path ?? null"
                :pending-project-name="pendingProjectOpen?.name ?? ''"
                @open-project="state.openProjectDialogOpen = true"
                @open-clone="state.cloneDialogOpen = true"
                @open-palette="openCommandPalette"
                @open-theme="state.themeDialogOpen = true"
                @open-recent="openRecentProject"
                @remove-recent="removeRecentProject"
                @forget-recent="forgetRecentProject"
                @select-project-mode="finalizeProjectOpen"
                @cancel-project-mode="closeProjectOpenModeDialog"
              />
            </div>
          </template>

          <template v-else>
            <template v-if="state.mode === 'session'">
              <template v-if="activeSession">
                <div class="grid h-full grid-rows-[1fr_auto]">
                  <Timeline :entries="activeTimeline" />
                  <Composer :context="contextLabel" :prompt="forms.prompt" @update:prompt="forms.prompt = $event" @send="sendPrompt" @execute-command="runComposerCommand" />
                </div>
              </template>

              <template v-else>
                <div class="grid h-full place-items-center p-6">
                  <div class="max-w-xl rounded-xl border border-border/80 bg-card/55 p-6 text-center">
                    <h2 class="mb-2 text-lg font-semibold">No session started</h2>
                    <p class="mb-4 text-sm text-muted-foreground">Review diffs first or start a new session with the agent.</p>
                    <button class="h-9 rounded-md border border-border/80 bg-primary/90 px-4 text-sm font-semibold text-primary-foreground" @click="createSession">
                      Start session
                    </button>
                  </div>
                </div>
              </template>
            </template>

            <template v-else>
              <DiffWorkbench
                :current-project="currentProject"
                :diff-style="state.diffStyle"
                :theme-type="diffThemeType"
                :theme-preset="settings.themePreset"
                @update:diff-style="state.diffStyle = $event"
                @open-projects="goHome"
                @start-session-from-diff="startSessionFromDiff"
              />
            </template>
          </template>
        </main>
      </section>
    </div>

    <CommandPalette
      v-if="state.paletteOpen"
      :query="forms.palette"
      :commands="filteredPaletteCommands"
      :highlighted-index="state.paletteIndex"
      @close="state.paletteOpen = false"
      @run="runPalette"
      @update:query="updatePaletteQuery"
    />

    <SettingsModal
      v-if="state.settingsOpen"
      :settings="settings"
      :keybindings="keybindings"
      @close="state.settingsOpen = false"
      @update:theme="settings.themePreset = $event"
      @update:model="settings.defaultModel = $event"
      @update:keybinding="updateKeybinding"
    />

    <TerminalDrawer
      v-if="state.terminalOpen"
      :input="forms.terminal"
      :output="terminalOutput"
      @close="state.terminalOpen = false"
      @run="runTerminal"
      @update:input="forms.terminal = $event"
    />

    <OpenProjectDialog
      v-if="state.openProjectDialogOpen"
      :path="picker.openPath"
      @close="state.openProjectDialogOpen = false"
      @update:path="picker.openPath = $event"
      @open="openExistingProject"
    />

    <ThemeDialog
      v-if="state.themeDialogOpen"
      :model-value="settings.themePreset"
      @close="state.themeDialogOpen = false"
      @update:model-value="settings.themePreset = $event"
    />

    <CloneRepoDialog
      v-if="state.cloneDialogOpen"
      :url="picker.cloneUrl"
      :destination="picker.cloneDestination"
      @close="state.cloneDialogOpen = false"
      @update:url="picker.cloneUrl = $event"
      @update:destination="picker.cloneDestination = $event"
      @clone="cloneRepository"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import CommandPalette from './components/app/CommandPalette.vue';
import TerminalDrawer from './components/app/TerminalDrawer.vue';
import DiffWorkbench from './components/diff/DiffWorkbench.vue';
import CloneRepoDialog from './components/picker/CloneRepoDialog.vue';
import OpenProjectDialog from './components/picker/OpenProjectDialog.vue';
import PickerScreen from './components/picker/PickerScreen.vue';
import ThemeDialog from './components/picker/ThemeDialog.vue';
import SettingsModal from './components/settings/SettingsModal.vue';
import Composer from './components/session/Composer.vue';
import SessionHeader from './components/session/SessionHeader.vue';
import SessionSidebar from './components/session/SessionSidebar.vue';
import Timeline from './components/session/Timeline.vue';
import { applyTheme } from './lib/theme';
import { THEME_PRESETS } from '@glib-code/shared/theme/presets';
import type { ThemePreset } from '@glib-code/shared/theme/presets';
import logoIcon from '../../glibcode-iconlogo.png';
import logoWordmark from '../../glibcode-wordmark.png';

const logoIconSrc = logoIcon;
const logoWordmarkSrc = logoWordmark;
const SIDEBAR_WIDTH_KEY = 'glib-sidebar-width';
const SIDEBAR_EXPANDED_WIDTH = 288;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 380;
const API_BASE = 'http://127.0.0.1:4273/api';

type Session = {
  id: string;
  title: string;
  time: string;
  status: 'Working' | 'Completed';
  repo: string;
  project: string;
  projectPath: string;
};

type TimelineEntry = {
  id: string;
  kind: string;
  text: string;
  time: string;
  level?: 'info' | 'error';
};

type PendingProjectOpen = { name: string; path: string };
type RecentStatus = 'ok' | 'missing_path' | 'missing_git';
type RecentEntry = { id: string; name: string; path: string; lastOpenedAt: string; status: RecentStatus };

const currentProject = ref<{ id: string; name: string; branch: string; path: string } | null>(null);

const recents = reactive<RecentEntry[]>([]);

const picker = reactive({
  openPath: '',
  cloneUrl: '',
  cloneDestination: 'C:/repos'
});

const pendingProjectOpen = ref<PendingProjectOpen | null>(null);

const sessions = reactive<Session[]>([]);
const timelineBySessionId = reactive<Record<string, TimelineEntry[]>>({});
const sessionContextById = reactive<Record<string, string>>({});

const settings = reactive({
  themePreset: 'catppuccin-mocha' as ThemePreset,
  defaultModel: 'gpt-5.3-codex'
});

const keybindings = reactive([
  { command: 'palette.toggle', key: 'Ctrl+K' },
  { command: 'terminal.toggle', key: 'Ctrl+J' },
  { command: 'mode.diff', key: 'D' },
  { command: 'mode.session', key: 'S' }
]);

const state = reactive({
  mode: 'diff' as 'session' | 'diff',
  activeSessionId: '',
  sidebarCollapsed: false,
  sidebarWidth: SIDEBAR_EXPANDED_WIDTH,
  paletteOpen: false,
  paletteIndex: 0,
  settingsOpen: false,
  terminalOpen: false,
  openProjectDialogOpen: false,
  themeDialogOpen: false,
  cloneDialogOpen: false,
  diffStyle: 'split' as 'split' | 'unified'
});

const forms = reactive({
  prompt: '',
  palette: '',
  terminal: ''
});

const paletteCommands = [
  { id: 'mode.diff', label: 'Switch to Diff mode' },
  { id: 'mode.session', label: 'Switch to Session mode' },
  { id: 'picker.open', label: 'Open project picker' },
  { id: 'settings.open', label: 'Open settings' },
  { id: 'terminal.toggle', label: 'Toggle terminal drawer' },
  { id: 'session.new', label: 'Create new session' }
];

const activeSession = computed(() => sessions.find((s) => s.id === state.activeSessionId));

const activeTimeline = computed(() => {
  if (!state.activeSessionId) return [];
  return timelineBySessionId[state.activeSessionId] ?? [];
});

const contextLabel = computed(() => {
  if (state.mode !== 'session') return '';
  if (!currentProject.value) return '';
  const sessionContext = state.activeSessionId ? sessionContextById[state.activeSessionId] : '';
  if (sessionContext) return sessionContext;
  return currentProject.value.name;
});

const diffThemeType = computed<'dark' | 'light'>(() => {
  const background = THEME_PRESETS[settings.themePreset].background;
  const lightness = Number(background.split(' ')[2]?.replace('%', '') ?? '0');
  return lightness <= 50 ? 'dark' : 'light';
});

const filteredPaletteCommands = computed(() => {
  const q = forms.palette.trim().toLowerCase();
  const options = paletteCommands.filter((c) => currentProject.value || c.id === 'picker.open');
  if (!q) return options;
  return options.filter((c) => c.label.toLowerCase().includes(q) || c.id.includes(q));
});

const terminalOutput = computed(() => (forms.terminal ? `$ ${forms.terminal}\n\n(simulated output)` : 'No commands run yet.'));
const sidebarWidth = computed(() => (state.sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : state.sidebarWidth));

let stopSidebarResize: (() => void) | null = null;

function noop() {}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
}

function replaceRecents(next: RecentEntry[]) {
  recents.splice(0, recents.length, ...next);
}

async function hydrateRecents() {
  const rows = await apiGet<Array<{ id: string; name: string; path: string; lastOpenedAt: string }>>('/projects/recents');
  const statuses = await apiGet<Array<{ id: string; status: RecentStatus }>>('/projects/recents/status');
  const statusById = new Map(statuses.map((row) => [row.id, row.status]));
  replaceRecents(
    rows.map((row) => ({
      ...row,
      status: statusById.get(row.id) ?? 'ok'
    }))
  );
}

function clampSidebarWidth(width: number) {
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(width, SIDEBAR_MAX_WIDTH));
}

function toggleSidebarCollapse() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  if (!state.sidebarCollapsed) {
    state.sidebarWidth = clampSidebarWidth(state.sidebarWidth);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(state.sidebarWidth));
  }
}

function goHome() {
  currentProject.value = null;
  state.mode = 'diff';
  state.activeSessionId = '';
}

function closeProjectOpenModeDialog() {
  pendingProjectOpen.value = null;
}

function startSidebarResize(event: MouseEvent) {
  if (state.sidebarCollapsed) return;
  event.preventDefault();

  const startX = event.clientX;
  const startWidth = state.sidebarWidth;

  const onMouseMove = (moveEvent: MouseEvent) => {
    state.sidebarWidth = clampSidebarWidth(startWidth + (moveEvent.clientX - startX));
  };

  const onMouseUp = () => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(state.sidebarWidth));
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    stopSidebarResize = null;
  };

  stopSidebarResize = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    stopSidebarResize = null;
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function openProject(projectName: string, path: string, mode: 'diff' | 'session') {
  const id = currentProject.value?.path === path ? currentProject.value.id : `proj-${Date.now()}`;
  currentProject.value = { id, name: projectName, branch: 'main', path };

  const existingRecent = recents.find((r) => r.path === path);
  if (!existingRecent) {
    recents.unshift({ id: `r${recents.length + 1}`, name: projectName, path, lastOpenedAt: 'now', status: 'ok' });
  } else {
    existingRecent.status = 'ok';
    existingRecent.lastOpenedAt = 'now';
  }

  state.mode = mode;
  forms.prompt = '';
}

function queueProjectOpen(projectName: string, path: string) {
  state.openProjectDialogOpen = false;
  state.cloneDialogOpen = false;
  pendingProjectOpen.value = { name: projectName, path };

  const existingRecent = recents.find((r) => r.path === path);
  if (!existingRecent) {
    recents.unshift({ id: `pending-${Date.now()}`, name: projectName, path, lastOpenedAt: 'now', status: 'ok' });
  }
}

function finalizeProjectOpen(mode: 'diff' | 'session') {
  if (!pendingProjectOpen.value) return;
  openProject(pendingProjectOpen.value.name, pendingProjectOpen.value.path, mode);
  if (mode === 'session' && !activeSession.value) {
    createSession();
  }
  closeProjectOpenModeDialog();
  state.openProjectDialogOpen = false;
  state.cloneDialogOpen = false;
}

async function resolveProjectOpen(path: string) {
  const normalizedPath = path.trim();
  if (!normalizedPath) return { ok: false as const, reason: 'missing_path' as const };

  try {
    const opened = await apiPost<{ id?: string; name?: string; path?: string; branch?: string; needsInit?: boolean }>('/projects/open', {
      path: normalizedPath
    });
    if (opened.needsInit) return { ok: false as const, reason: 'missing_git' as const };
    return {
      ok: true as const,
      name: opened.name ?? normalizedPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'project',
      path: opened.path ?? normalizedPath
    };
  } catch {
    if (import.meta.env.DEV) {
      return {
        ok: true as const,
        name: normalizedPath.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'project',
        path: normalizedPath
      };
    }
    return { ok: false as const, reason: 'missing_path' as const };
  }
}

async function openExistingProject() {
  const path = picker.openPath.trim();
  if (!path) return;
  const opened = await resolveProjectOpen(path);
  if (!opened.ok) return;
  queueProjectOpen(opened.name, opened.path);
  void hydrateRecents();
}

async function openRecentProject(path: string) {
  const opened = await resolveProjectOpen(path);
  if (!opened.ok) {
    void hydrateRecents();
    return;
  }
  const recent = recents.find((r) => r.path === path);
  if (recent) recent.status = 'ok';
  queueProjectOpen(recent?.name ?? opened.name, opened.path);
  void hydrateRecents();
}

async function removeRecentProject(id: string) {
  try {
    await apiDelete(`/projects/recents/${id}`);
    await hydrateRecents();
  } catch {
    const index = recents.findIndex((row) => row.id === id);
    if (index >= 0) recents.splice(index, 1);
  }
}

async function forgetRecentProject(id: string) {
  try {
    await apiPost(`/projects/recents/${id}/forget`, {});
    await hydrateRecents();
  } catch {
    const index = recents.findIndex((row) => row.id === id);
    if (index >= 0) recents.splice(index, 1);
  }
}

function cloneRepository() {
  const url = picker.cloneUrl.trim();
  const destination = picker.cloneDestination.trim();
  if (!url || !destination) return;

  const rawName = url.replace(/\.git$/i, '').split('/').filter(Boolean).pop() ?? 'repo';
  queueProjectOpen(rawName, `${destination.replace(/\\/g, '/')}/${rawName}`);
}

function openCommandPalette() {
  state.paletteOpen = true;
  forms.palette = '';
  state.paletteIndex = 0;
}

function openCurrentSessionDiff() {
  if (!currentProject.value) return;
  state.mode = 'diff';
}

function openCommitsListDiff() {
  if (!currentProject.value) return;
  state.mode = 'diff';
}

function createSession(options?: { title?: string; context?: string; initialEntries?: TimelineEntry[] }) {
  if (!currentProject.value) return;
  const normalizedPath = currentProject.value.path.replace(/\\/g, '/');
  const repoName = currentProject.value.name.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? currentProject.value.name;
  const projectName = normalizedPath.split('/').filter(Boolean).pop() ?? currentProject.value.name;
  const id = `s${sessions.length + 1}`;
  sessions.unshift({
    id,
    title: options?.title ?? 'New session',
    time: 'now',
    status: 'Working',
    repo: repoName,
    project: projectName,
    projectPath: normalizedPath
  });
  timelineBySessionId[id] = options?.initialEntries ?? [];
  sessionContextById[id] = options?.context ?? '';
  state.activeSessionId = id;
  state.mode = 'session';
}

async function startSessionFromDiff(payload: { source: 'commit' | 'uncommitted'; ref?: string; file?: string }) {
  if (!currentProject.value) return;
  const packBody: Record<string, unknown> = { source: payload.source === 'commit' ? 'commits' : 'uncommitted' };
  if (payload.source === 'commit' && payload.ref) packBody.ref = payload.ref;
  if (payload.file) packBody.file = payload.file;
  const packed = await apiPost<{ diff: string }>('/diff/pack', packBody);
  const context = payload.source === 'commit' && payload.ref
    ? `commit ${payload.ref.slice(0, 7)}`
    : 'working tree changes';
  createSession({
    title: `Session from ${context}`,
    context,
    initialEntries: [{
      id: 'e1',
      kind: 'Context',
      text: packed.diff?.trim() || 'No diff context available.',
      time: 'now',
      level: 'info'
    }]
  });
}

function selectSessionFromSidebar(sessionId: string) {
  const session = sessions.find((entry) => entry.id === sessionId);
  if (!session) return;

  state.activeSessionId = sessionId;

  if (!currentProject.value || currentProject.value.path !== session.projectPath) {
    const sessionPath = session.projectPath || `C:/repos/${session.project || session.repo || 'project'}`;
    const recentName = recents.find((recent) => recent.path === sessionPath)?.name;
    const projectName = recentName || session.repo || session.project || 'project';
    openProject(projectName, sessionPath, 'session');
    return;
  }

  state.mode = 'session';
}

function sendPrompt() {
  if (!state.activeSessionId || !forms.prompt.trim()) return;
  const list = timelineBySessionId[state.activeSessionId] ?? (timelineBySessionId[state.activeSessionId] = []);
  list.push({ id: `e${list.length + 1}`, kind: 'User', text: forms.prompt, time: 'now', level: 'info' });
  forms.prompt = '';
}

function runTerminal() {
  if (!forms.terminal.trim()) return;
  forms.terminal = `${forms.terminal}`;
}

function runPalette(id: string) {
  if (id === 'mode.diff' && currentProject.value) state.mode = 'diff';
  if (id === 'mode.session' && currentProject.value) state.mode = 'session';
  if (id === 'picker.open') {
    currentProject.value = null;
    state.mode = 'diff';
    state.activeSessionId = '';
  }
  if (id === 'settings.open') state.settingsOpen = true;
  if (id === 'terminal.toggle') state.terminalOpen = !state.terminalOpen;
  if (id === 'session.new') createSession();
  state.paletteOpen = false;
}

function updatePaletteQuery(value: string) {
  forms.palette = value;
  state.paletteIndex = 0;
}

function updateKeybinding(command: string, key: string) {
  const row = keybindings.find((k) => k.command === command);
  if (row) row.key = key;
}

function runComposerCommand(command: string) {
  if (command === 'help') {
    openCommandPalette();
    return;
  }

  if (command === 'models' || command === 'model') {
    state.settingsOpen = true;
    return;
  }

  if (command === 'themes' || command === 'theme') {
    state.themeDialogOpen = true;
    return;
  }

  if (command === 'new' || command === 'clear') {
    createSession();
    return;
  }

  if (command === 'sessions' || command === 'resume' || command === 'continue') {
    state.mode = 'session';
    if (!activeSession.value) createSession();
    return;
  }

  if (command === 'diff') {
    if (!currentProject.value) return;
    state.mode = 'diff';
    return;
  }

  if (command === 'session') {
    if (!currentProject.value) return;
    state.mode = 'session';
    if (!activeSession.value) createSession();
    return;
  }

  if (command === 'undo' || command === 'redo' || command === 'share' || command === 'init') {
    openCommandPalette();
  }
}

function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    state.paletteOpen = !state.paletteOpen;
    if (state.paletteOpen) {
      forms.palette = '';
      state.paletteIndex = 0;
    }
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
    event.preventDefault();
    state.terminalOpen = !state.terminalOpen;
    return;
  }

  if (event.key === 'Escape') {
    if (state.paletteOpen) {
      state.paletteOpen = false;
      return;
    }
    if (state.settingsOpen) {
      state.settingsOpen = false;
      return;
    }
    if (state.themeDialogOpen) {
      state.themeDialogOpen = false;
      return;
    }
    if (pendingProjectOpen.value) {
      closeProjectOpenModeDialog();
      return;
    }
    if (state.cloneDialogOpen) {
      state.cloneDialogOpen = false;
      return;
    }
    if (state.openProjectDialogOpen) {
      state.openProjectDialogOpen = false;
      return;
    }
    if (state.terminalOpen) {
      state.terminalOpen = false;
    }
    return;
  }

  if (!state.paletteOpen) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    state.paletteIndex = Math.min(state.paletteIndex + 1, Math.max(filteredPaletteCommands.value.length - 1, 0));
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    state.paletteIndex = Math.max(state.paletteIndex - 1, 0);
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    const cmd = filteredPaletteCommands.value[state.paletteIndex];
    if (cmd) runPalette(cmd.id);
  }
}

onMounted(() => {
  applyTheme(settings.themePreset);
  const storedSidebarWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  if (storedSidebarWidth) {
    const parsedWidth = Number(storedSidebarWidth);
    if (!Number.isNaN(parsedWidth)) {
      state.sidebarWidth = clampSidebarWidth(parsedWidth);
    }
  }
  void hydrateRecents().catch(() => undefined);
  window.addEventListener('keydown', onGlobalKeydown);
});

watch(
  () => settings.themePreset,
  (next) => applyTheme(next)
);

onUnmounted(() => {
  stopSidebarResize?.();
  window.removeEventListener('keydown', onGlobalKeydown);
});
</script>
