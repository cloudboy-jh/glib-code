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
          @git-action="runPromote"
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
                    <div v-if="state.agentSetupMessage" class="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-left text-xs text-amber-200">
                      <p>{{ state.agentSetupMessage }}</p>
                      <button class="mt-2 underline underline-offset-2" @click="openSettings('Models')">Add provider key in Settings</button>
                    </div>
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

    <div v-if="state.promoteDialogOpen" class="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6" @click.self="state.promoteDialogOpen = false">
      <div class="max-h-[88vh] w-full max-w-6xl overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-2xl shadow-black/40">
        <div class="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div>
            <div class="text-sm font-medium">Session diff and promote</div>
            <div class="mt-0.5 text-[11px] text-muted-foreground">Local repo → Local workspace · Commit promote</div>
          </div>
          <button class="rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground" @click="state.promoteDialogOpen = false">Close</button>
        </div>
        <div class="grid max-h-[80vh] grid-cols-[260px_1fr] gap-3 p-3">
          <div class="min-h-0 overflow-auto rounded-lg border border-border/70 p-2">
            <div class="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Files</div>
            <label v-for="file in filesFromPatch(promote.diff)" :key="file" class="mb-1 flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
              <input v-model="promote.selectedFiles" :value="file" type="checkbox" class="h-3.5 w-3.5" />
              <span class="truncate text-xs">{{ file }}</span>
            </label>
          </div>
          <div class="min-h-0 overflow-hidden">
            <div v-if="promote.loading" class="grid h-full place-items-center text-sm text-muted-foreground">Loading diff…</div>
            <DiffView v-else :patch="promote.diff" :diff-style="state.diffStyle" :theme-type="diffThemeType" :theme-preset="settings.themePreset" />
          </div>
        </div>
        <div class="flex items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
          <button class="rounded-md border border-border/70 px-3 py-1.5 text-xs" @click="state.promoteDialogOpen = false">Cancel</button>
          <button class="rounded-md border border-border/80 bg-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground" @click="confirmPromote">Promote selected</button>
        </div>
      </div>
    </div>

    <div v-if="state.conflictDialogOpen" class="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6" @click.self="state.conflictDialogOpen = false">
      <div class="w-full max-w-xl rounded-xl border border-border/80 bg-card/95 p-4 shadow-2xl shadow-black/40">
        <div class="mb-2 text-sm font-semibold">Baseline conflict</div>
        <p class="mb-3 text-xs text-muted-foreground">Durable branch moved and overlaps with selected files.</p>
        <div class="mb-2 text-xs">Durable SHA: <span class="font-mono">{{ conflict.durableSha || 'unknown' }}</span></div>
        <div class="mb-3 text-xs">Baseline SHA: <span class="font-mono">{{ conflict.baselineSha || 'unknown' }}</span></div>
        <div class="max-h-44 overflow-auto rounded border border-border/70 p-2 text-xs">
          <div v-for="file in conflict.conflictingFiles" :key="file" class="py-0.5 font-mono">{{ file }}</div>
          <div v-if="conflict.conflictingFiles.length === 0" class="text-muted-foreground">No file list returned.</div>
        </div>
        <div class="mt-4 flex justify-end">
          <button class="rounded-md border border-border/70 px-3 py-1.5 text-xs" @click="state.conflictDialogOpen = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import type { AgentEvent } from '@glib-code/shared/events/agent';
import CommandPalette from './components/app/CommandPalette.vue';
import TerminalDrawer from './components/app/TerminalDrawer.vue';
import DiffWorkbench from './components/diff/DiffWorkbench.vue';
import DiffView from './components/shared/DiffView.vue';
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

type SessionMetaApi = {
  id: string;
  projectId: string;
  projectPath: string;
  title: string;
  model: string;
  provider: string;
  status: 'idle' | 'running' | 'aborted' | 'error' | 'done';
  createdAt: string;
  updatedAt: string;
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
  contextViewerOpen: false,
  promoteDialogOpen: false,
  conflictDialogOpen: false,
  agentSetupMessage: ''
});

const promote = reactive({
  diff: '',
  loading: false,
  selectedFiles: [] as string[]
});

const conflict = reactive({
  conflictingFiles: [] as string[],
  durableSha: '',
  baselineSha: ''
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
const streamsBySessionId = new Map<string, EventSource>();
const seenEventKeysBySessionId = new Map<string, Set<string>>();

let stopSidebarResize: (() => void) | null = null;


function eventKey(event: AgentEvent) {
  return `${event.type}:${JSON.stringify(event)}`;
}

function timeLabel(value?: string) {
  if (!value) return 'now';
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'now';
  }
}

function appendTimelineEvent(sessionId: string, entry: TimelineEntry) {
  const list = timelineBySessionId[sessionId] ?? (timelineBySessionId[sessionId] = []);
  list.push(entry);
}

function filesFromPatch(patch: string) {
  const files = new Set<string>();
  const matches = patch.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm);
  for (const m of matches) files.add((m[2] || m[1] || '').trim());
  return [...files].filter(Boolean);
}

function reduceAgentEventToTimeline(sessionId: string, event: AgentEvent) {
  const seen = seenEventKeysBySessionId.get(sessionId) ?? new Set<string>();
  const key = eventKey(event);
  if (seen.has(key)) return;
  seen.add(key);
  seenEventKeysBySessionId.set(sessionId, seen);

  if (event.type === 'user_turn') {
    appendTimelineEvent(sessionId, { id: `${sessionId}-${Date.now()}-u`, kind: 'User', text: event.prompt, time: timeLabel(event.at), level: 'info' });
    return;
  }
  if (event.type === 'turn_start') {
    appendTimelineEvent(sessionId, { id: `${sessionId}-${Date.now()}-ts`, kind: 'Agent', text: 'Working…', time: timeLabel(event.at), level: 'info' });
    return;
  }
  if (event.type === 'text_part') {
    appendTimelineEvent(sessionId, { id: `${sessionId}-${Date.now()}-t`, kind: 'Assistant', text: event.text, time: timeLabel(event.at), level: 'info' });
    return;
  }
  if (event.type === 'tool_call') {
    const text = event.output?.trim() ? `${event.tool}\n${event.output}` : `${event.tool}`;
    appendTimelineEvent(sessionId, { id: `${sessionId}-${Date.now()}-tool`, kind: 'Tool', text, time: timeLabel(event.at), level: 'info' });
    return;
  }
  if (event.type === 'error') {
    appendTimelineEvent(sessionId, { id: `${sessionId}-${Date.now()}-err`, kind: 'Error', text: event.message ?? event.name, time: timeLabel(event.at), level: 'error' });
    return;
  }
  if (event.type === 'turn_end') {
    appendTimelineEvent(sessionId, { id: `${sessionId}-${Date.now()}-te`, kind: 'System', text: `Turn ended (${event.reason})`, time: timeLabel(event.at), level: event.reason === 'error' ? 'error' : 'info' });
  }
}

function mapApiSession(meta: SessionMetaApi): Session {
  const normalizedPath = meta.projectPath.replace(/\\/g, '/');
  const repoName = normalizedPath.split('/').filter(Boolean).pop() ?? 'project';
  return {
    id: meta.id,
    title: meta.title,
    time: timeLabel(meta.updatedAt),
    status: meta.status === 'done' ? 'Completed' : 'Working',
    repo: repoName,
    project: repoName,
    projectPath: normalizedPath
  };
}

async function hydrateSessionDoc(sessionId: string) {
  const doc = await apiGet<{ meta: SessionMetaApi; events: AgentEvent[] }>(`/sessions/${encodeURIComponent(sessionId)}`);
  timelineBySessionId[sessionId] = [];
  seenEventKeysBySessionId.set(sessionId, new Set<string>());
  for (const evt of doc.events) reduceAgentEventToTimeline(sessionId, evt);
}

function connectSessionStream(sessionId: string) {
  if (streamsBySessionId.has(sessionId)) return;
  const stream = new EventSource(`${API_BASE}/agent/sessions/${encodeURIComponent(sessionId)}/stream`);
  const names = ['session_start', 'user_turn', 'turn_start', 'turn_end', 'aborted', 'step_start', 'text_part', 'tool_call', 'step_end', 'error'];
  for (const name of names) {
    stream.addEventListener(name, (evt) => {
      const message = evt as MessageEvent<string>;
      try {
        const parsed = JSON.parse(message.data) as AgentEvent;
        reduceAgentEventToTimeline(sessionId, parsed);
      } catch {
        // ignore malformed data
      }
    });
  }
  stream.onerror = () => {
    // browser will auto-retry
  };
  streamsBySessionId.set(sessionId, stream);
}

function disconnectSessionStream(sessionId: string) {
  const stream = streamsBySessionId.get(sessionId);
  if (!stream) return;
  stream.close();
  streamsBySessionId.delete(sessionId);
}

async function hydrateSessions() {
  if (!currentProject.value) return;
  const rows = await apiGet<SessionMetaApi[]>('/sessions');
  sessions.splice(0, sessions.length, ...rows.map(mapApiSession));
  for (const row of rows) {
    await hydrateSessionDoc(row.id);
    connectSessionStream(row.id);
  }
}

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
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `request failed: ${response.status}`);
  }
}

async function apiPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `request failed: ${response.status}`);
  }
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
  for (const id of [...streamsBySessionId.keys()]) disconnectSessionStream(id);
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
  state.agentSetupMessage = '';
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

async function finalizeProjectOpen(mode: 'diff' | 'session') {
  if (!pendingProjectOpen.value) return;
  openProject(pendingProjectOpen.value.name, pendingProjectOpen.value.path, mode);
  if (mode === 'session' && !state.activeSessionId) {
    await createSession();
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

async function createSession(options?: { title?: string; context?: string; initialEntries?: TimelineEntry[] }) {
  if (!currentProject.value) return null;
  state.agentSetupMessage = '';
  let created: SessionMetaApi;
  try {
    created = await apiPost<SessionMetaApi>('/agent/sessions', { title: options?.title ?? 'New Session' });
  } catch (error) {
    state.mode = 'session';
    const message = error instanceof Error ? error.message : 'Unable to start session';
    state.agentSetupMessage = message.includes('provider') || message.includes('model')
      ? 'Add a provider API key before starting an agent session. Project picker and diff review still work without one.'
      : message;
    return null;
  }
  const mapped = mapApiSession(created);
  sessions.unshift(mapped);
  timelineBySessionId[mapped.id] = [];
  sessionContextById[mapped.id] = options?.context ?? '';
  state.activeSessionId = mapped.id;
  activeSessionIdByProject[currentProject.value.id] = mapped.id;
  await hydrateSessionDoc(mapped.id);
  if (options?.initialEntries?.length) {
    for (const entry of options.initialEntries) appendTimelineEvent(mapped.id, entry);
  }
  connectSessionStream(mapped.id);
  state.mode = 'session';
  return mapped;
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
  const created = await createSession({
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

  if (!created) return;

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
}

async function sendPrompt() {
  if (!state.activeSessionId || !forms.prompt.trim()) return;
  await apiPost(`/agent/sessions/${encodeURIComponent(state.activeSessionId)}/send`, { prompt: forms.prompt });
  forms.prompt = '';
}

function removeActiveContext() {
  if (!state.activeSessionId) return;
  if (!contextBundleBySessionId[state.activeSessionId]) return;
  contextBundleBySessionId[state.activeSessionId] = undefined;
  const list = timelineBySessionId[state.activeSessionId] ?? (timelineBySessionId[state.activeSessionId] = []);
  list.push({ id: `e${list.length + 1}`, kind: 'System', text: 'Context removed from session.', time: 'now', level: 'info' });
}

async function runPromote() {
  if (!state.activeSessionId) return;
  state.promoteDialogOpen = true;
  promote.loading = true;
  try {
    const payload = await apiGet<{ diff: string }>(`/sessions/${encodeURIComponent(state.activeSessionId)}/diff`);
    promote.diff = payload.diff ?? '';
    promote.selectedFiles = filesFromPatch(promote.diff);
  } catch (error) {
    appendTimelineEvent(state.activeSessionId, {
      id: `${state.activeSessionId}-${Date.now()}-promote-open-err`,
      kind: 'Promote',
      text: error instanceof Error ? error.message : 'Failed to load session diff',
      time: 'now',
      level: 'error'
    });
    state.promoteDialogOpen = false;
  } finally {
    promote.loading = false;
  }
}

async function confirmPromote() {
  if (!state.activeSessionId) return;
  const files = promote.selectedFiles;
  const selector = files.length === filesFromPatch(promote.diff).length ? { mode: 'all' as const } : { mode: 'files' as const, files };
  try {
    const result = await apiPost<{ sha: string; branch: string; prUrl?: string }>(`/sessions/${encodeURIComponent(state.activeSessionId)}/promote`, {
      selector,
      strategy: 'commit'
    });
    state.promoteDialogOpen = false;
    appendTimelineEvent(state.activeSessionId, {
      id: `${state.activeSessionId}-${Date.now()}-promote`,
      kind: 'Promote',
      text: `Promoted to ${result.branch} @ ${result.sha.slice(0, 7)}`,
      time: 'now',
      level: 'info'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Promote failed';
    try {
      const parsed = JSON.parse(message) as { code?: string; conflictingFiles?: string[]; durableSha?: string; baselineSha?: string };
      if (parsed.code === 'BASELINE_CONFLICT') {
        conflict.conflictingFiles = parsed.conflictingFiles ?? [];
        conflict.durableSha = parsed.durableSha ?? '';
        conflict.baselineSha = parsed.baselineSha ?? '';
        state.conflictDialogOpen = true;
        return;
      }
    } catch {
      // non-json error
    }
    appendTimelineEvent(state.activeSessionId, {
      id: `${state.activeSessionId}-${Date.now()}-promote-err`,
      kind: 'Promote',
      text: message,
      time: 'now',
      level: 'error'
    });
  }
}

async function abortTurn() {
  if (!state.activeSessionId) return;
  await apiDelete(`/agent/sessions/${encodeURIComponent(state.activeSessionId)}/turn`);
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

  if (command === 'stop' || command === 'abort') {
    void abortTurn();
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
  void hydrateProviders().catch(() => undefined);
  window.addEventListener('keydown', onGlobalKeydown);
});

watch(
  () => currentProject.value?.path,
  (next) => {
    if (!next) return;
    void hydrateSessions().catch(() => undefined);
  }
);

watch(
  () => settings.themePreset,
  (next) => applyTheme(next)
);

onUnmounted(() => {
  stopSidebarResize?.();
  for (const id of [...streamsBySessionId.keys()]) disconnectSessionStream(id);
  window.removeEventListener('keydown', onGlobalKeydown);
});
</script>
