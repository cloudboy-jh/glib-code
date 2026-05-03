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
          @open-settings="openSettings('Models')"
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

      <section :class="['grid h-full min-h-0 min-w-0', currentProject ? 'grid-rows-[54px_1fr]' : 'grid-rows-[1fr]']">
        <SessionHeader
          v-if="currentProject"
          :title="activeSession?.title ?? 'No active session'"
          :project="currentProject.name"
          :branch="currentProject.branch"
          :model="settings.defaultModel"
          @diff-current="openCurrentSessionDiff"
          @diff-commits="openCommitsListDiff"
          @open-model="openSettings('Models')"
          @git-action="noop"
        />

        <main class="min-h-0 min-w-0 overflow-hidden">
          <template v-if="!currentProject">
            <div class="grid h-full place-items-center px-6">
              <PickerScreen
                :recents="recents"
                :providers="providerCapabilities.providers"
                :logo-src="logoWordmarkSrc"
                :pending-project-path="pendingProjectOpen?.path ?? null"
                :pending-project-name="pendingProjectOpen?.name ?? ''"
                :default-open-mode="settings.defaultOpenMode"
                @open-project="state.openProjectDialogOpen = true"
                @open-clone="state.cloneDialogOpen = true"
                @open-palette="openCommandPalette"
                @open-theme="state.themeDialogOpen = true"
                @open-gittrix="openSettings('Git')"
                @open-model="openSettings('Models')"
                @open-recent="openRecentProject"
                @remove-recent="removeRecentProject"
                @forget-recent="forgetRecentProject"
                @provider-auth-save="saveProviderAuth"
                @select-project-mode="finalizeProjectOpen"
                @cancel-project-mode="closeProjectOpenModeDialog"
              />
            </div>
          </template>

          <template v-else>
            <template v-if="state.mode === 'session'">
              <template v-if="activeSession">
                <div class="grid h-full min-h-0 min-w-0 grid-rows-[auto_1fr_auto] overflow-hidden">
                  <SessionContextCapsule
                    v-if="activeContextBundle"
                    :summary="activeContextSummary"
                    @view="state.contextViewerOpen = true"
                    @remove="removeActiveContext"
                    @back-to-diffs="state.mode = 'diff'"
                  />
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
      :providers="providerCapabilities.providers"
      :default-open-mode="settings.defaultOpenMode"
      :initial-tab="state.settingsTab"
      @close="state.settingsOpen = false"
      @update:theme="settings.themePreset = $event"
      @update:provider="updateDefaultProvider"
      @update:model="settings.defaultModel = $event"
      @update:keybinding="updateKeybinding"
      @update:open-mode="settings.defaultOpenMode = $event"
      @open-gittrix="openGitTrixFromSettings"
      @provider:add-auth="saveProviderAuth"
      @provider:remove-auth="removeProviderAuth"
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

    <div
      v-if="state.contextViewerOpen && activeContextBundle"
      class="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6"
      @click.self="state.contextViewerOpen = false"
    >
      <div class="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-2xl shadow-black/40">
        <div class="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div class="text-sm font-medium">Context payload · {{ activeContextSummary }}</div>
          <button class="rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground" @click="state.contextViewerOpen = false">Close</button>
        </div>
        <pre class="max-h-[75vh] overflow-auto p-4 text-xs leading-6 text-foreground/95">{{ activeContextBundle.payload }}</pre>
      </div>
    </div>
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
import SessionContextCapsule from './components/session/SessionContextCapsule.vue';
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

type ContextBundle = {
  id: string;
  sessionId: string;
  projectPath: string;
  sourceType: 'commit' | 'uncommitted' | 'selection';
  sourceRef?: string;
  selectedFile?: string;
  fileCount: number;
  charCount: number;
  payload: string;
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
type ProviderCapability = { id: string; hasAuth: boolean; modelIds: string[] };

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
const contextBundleBySessionId = reactive<Record<string, ContextBundle | undefined>>({});
const activeSessionIdByProject = reactive<Record<string, string>>({});

const settings = reactive({
  themePreset: 'catppuccin-mocha' as ThemePreset,
  defaultProvider: 'codex',
  defaultModel: 'gpt-5.3-codex',
  defaultOpenMode: 'diff' as 'diff' | 'session'
});

const providerCapabilities = reactive<{ ok: boolean; error?: string; providers: ProviderCapability[] }>({
  ok: false,
  error: undefined,
  providers: []
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
  settingsTab: 'Models' as 'Models' | 'Git' | 'Appearance' | 'Keybindings',
  terminalOpen: false,
  openProjectDialogOpen: false,
  themeDialogOpen: false,
  cloneDialogOpen: false,
  diffStyle: 'split' as 'split' | 'unified',
  contextViewerOpen: false
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
const activeContextBundle = computed(() => (state.activeSessionId ? contextBundleBySessionId[state.activeSessionId] : undefined));
const activeContextSummary = computed(() => {
  const ctx = activeContextBundle.value;
  if (!ctx) return '';
  const source = ctx.sourceType === 'commit' && ctx.sourceRef ? `commit ${ctx.sourceRef.slice(0, 7)}` : ctx.sourceType === 'uncommitted' ? 'working tree' : 'selection';
  const fileMeta = `${ctx.fileCount} file${ctx.fileCount === 1 ? '' : 's'}`;
  const sizeMeta = `${Math.max(1, Math.round(ctx.charCount / 1000))}k chars`;
  return `${source} · ${fileMeta} · ${sizeMeta}`;
});

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

function openSettings(tab: 'Models' | 'Git' | 'Appearance' | 'Keybindings' = 'Models') {
  state.settingsTab = tab;
  state.settingsOpen = true;
}

function openGitTrixFromSettings() {
  state.settingsOpen = false;
  if (currentProject.value) {
    state.mode = 'diff';
    return;
  }
  state.openProjectDialogOpen = true;
}

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

async function apiPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return response.json() as Promise<T>;
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

async function hydrateProviders() {
  const providers = await apiGet<{ ok: boolean; error?: string; defaultProvider: string; defaultModel: string; providers: ProviderCapability[] }>('/providers');
  providerCapabilities.ok = providers.ok;
  providerCapabilities.error = providers.error;
  providerCapabilities.providers = providers.providers;
  settings.defaultProvider = providers.defaultProvider;
  settings.defaultModel = providers.defaultModel;
}

async function saveProviderAuth(providerId: string, apiKey: string) {
  const key = apiKey.trim();
  if (!providerId || !key) return;
  await apiPost('/providers/' + encodeURIComponent(providerId) + '/auth', { apiKey: key });
  await hydrateProviders();
}

async function removeProviderAuth(providerId: string) {
  if (!providerId) return;
  await apiDelete('/providers/' + encodeURIComponent(providerId) + '/auth');
  await hydrateProviders();
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
  const normalizedPath = path.replace(/\\/g, '/');
  const id = normalizedPath;
  currentProject.value = { id, name: projectName, branch: 'main', path: normalizedPath };

  const existingRecent = recents.find((r) => r.path === path);
  if (!existingRecent) {
    recents.unshift({ id: `r${recents.length + 1}`, name: projectName, path, lastOpenedAt: 'now', status: 'ok' });
  } else {
    existingRecent.status = 'ok';
    existingRecent.lastOpenedAt = 'now';
  }

  state.mode = mode;
  state.activeSessionId = activeSessionIdByProject[id] ?? '';
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
  if (mode === 'session' && !state.activeSessionId) {
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
  activeSessionIdByProject[currentProject.value.id] = id;
  state.mode = 'session';
  persistSessionState();
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
  const diff = packed.diff?.trim() || 'No diff context available.';
  createSession({
    title: `Session from ${context}`,
    context,
    initialEntries: [{
      id: 'e1',
      kind: 'System',
      text: `Context attached: ${context} · ${payload.file ? 1 : 'selected'} file scope`,
      time: 'now',
      level: 'info'
    }]
  });

  if (state.activeSessionId && currentProject.value) {
    contextBundleBySessionId[state.activeSessionId] = {
      id: `ctx-${Date.now()}`,
      sessionId: state.activeSessionId,
      projectPath: currentProject.value.path,
      sourceType: payload.source,
      sourceRef: payload.ref,
      selectedFile: payload.file,
      fileCount: payload.file ? 1 : Math.max(1, (diff.match(/^diff --git /gm) ?? []).length),
      charCount: diff.length,
      payload: diff
    };
  }
  persistSessionState();
}

function selectSessionFromSidebar(sessionId: string) {
  const session = sessions.find((entry) => entry.id === sessionId);
  if (!session) return;

  state.activeSessionId = sessionId;
  if (currentProject.value) activeSessionIdByProject[currentProject.value.id] = sessionId;

  if (!currentProject.value || currentProject.value.path !== session.projectPath) {
    const sessionPath = session.projectPath || `C:/repos/${session.project || session.repo || 'project'}`;
    activeSessionIdByProject[sessionPath.replace(/\\/g, '/')] = sessionId;
    const recentName = recents.find((recent) => recent.path === sessionPath)?.name;
    const projectName = recentName || session.repo || session.project || 'project';
    openProject(projectName, sessionPath, 'session');
    return;
  }

  state.mode = 'session';
  persistSessionState();
}

function sendPrompt() {
  if (!state.activeSessionId || !forms.prompt.trim()) return;
  const list = timelineBySessionId[state.activeSessionId] ?? (timelineBySessionId[state.activeSessionId] = []);
  list.push({ id: `e${list.length + 1}`, kind: 'User', text: forms.prompt, time: 'now', level: 'info' });
  forms.prompt = '';
  persistSessionState();
}

function removeActiveContext() {
  if (!state.activeSessionId) return;
  if (!contextBundleBySessionId[state.activeSessionId]) return;
  contextBundleBySessionId[state.activeSessionId] = undefined;
  const list = timelineBySessionId[state.activeSessionId] ?? (timelineBySessionId[state.activeSessionId] = []);
  list.push({ id: `e${list.length + 1}`, kind: 'System', text: 'Context removed from session.', time: 'now', level: 'info' });
  persistSessionState();
}

function persistSessionState() {
  const snapshot = {
    sessions: JSON.parse(JSON.stringify(sessions)) as Session[],
    timelineBySessionId: JSON.parse(JSON.stringify(timelineBySessionId)) as Record<string, TimelineEntry[]>,
    sessionContextById: JSON.parse(JSON.stringify(sessionContextById)) as Record<string, string>,
    contextBundleBySessionId: JSON.parse(JSON.stringify(contextBundleBySessionId)) as Record<string, ContextBundle | undefined>,
    activeSessionIdByProject: JSON.parse(JSON.stringify(activeSessionIdByProject)) as Record<string, string>
  };
  localStorage.setItem('glib-session-state-v1', JSON.stringify(snapshot));
}

function hydrateSessionState() {
  const raw = localStorage.getItem('glib-session-state-v1');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as {
      sessions?: Session[];
      timelineBySessionId?: Record<string, TimelineEntry[]>;
      sessionContextById?: Record<string, string>;
      contextBundleBySessionId?: Record<string, ContextBundle | undefined>;
      activeSessionIdByProject?: Record<string, string>;
    };
    if (Array.isArray(parsed.sessions)) sessions.splice(0, sessions.length, ...parsed.sessions);
    Object.assign(timelineBySessionId, parsed.timelineBySessionId ?? {});
    Object.assign(sessionContextById, parsed.sessionContextById ?? {});
    Object.assign(contextBundleBySessionId, parsed.contextBundleBySessionId ?? {});
    Object.assign(activeSessionIdByProject, parsed.activeSessionIdByProject ?? {});
  } catch {
    // ignore bad local state
  }
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
  if (id === 'settings.open') openSettings('Models');
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

async function updateDefaultProvider(providerId: string) {
  const provider = providerCapabilities.providers.find((item) => item.id === providerId);
  if (!provider || !provider.hasAuth) return;
  const nextModel = provider.modelIds[0] ?? settings.defaultModel;
  const saved = await apiPatch<{ defaultProvider: string; defaultModel: string }>('/providers/defaults', {
    defaultProvider: providerId,
    defaultModel: nextModel
  });
  settings.defaultProvider = saved.defaultProvider;
  settings.defaultModel = saved.defaultModel;
}

watch(
  () => settings.defaultModel,
  async (nextModel, prevModel) => {
    if (!nextModel || !settings.defaultProvider) return;
    if (nextModel === prevModel) return;
    const provider = providerCapabilities.providers.find((item) => item.id === settings.defaultProvider);
    if (!provider) return;
    if (provider.modelIds.length > 0 && !provider.modelIds.includes(nextModel)) return;
    try {
      await apiPatch('/providers/defaults', {
        defaultProvider: settings.defaultProvider,
        defaultModel: nextModel
      });
    } catch {
      // keep UI responsive, next hydrate will reconcile
    }
  }
);

function runComposerCommand(command: string) {
  if (command === 'help') {
    openCommandPalette();
    return;
  }

  if (command === 'models' || command === 'model') {
    openSettings('Models');
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
  hydrateSessionState();
  applyTheme(settings.themePreset);
  const storedSidebarWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  if (storedSidebarWidth) {
    const parsedWidth = Number(storedSidebarWidth);
    if (!Number.isNaN(parsedWidth)) {
      state.sidebarWidth = clampSidebarWidth(parsedWidth);
    }
  }
  void hydrateRecents().catch(() => undefined);
  void hydrateProviders().catch(() => undefined);
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
