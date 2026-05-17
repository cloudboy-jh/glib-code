<template>
  <div class="h-screen w-screen overflow-hidden bg-background text-foreground">
    <div class="grid h-full grid-cols-[auto_1fr]">
      <div class="relative h-full border-r border-border/60 bg-card" :style="{ width: `${sidebarWidth}px` }">
        <SessionSidebar
          :sessions="sidebarSessions"
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

      <section :class="['grid h-full min-h-0 min-w-0', currentProject && state.mode === 'session' ? 'grid-rows-[54px_1fr]' : 'grid-rows-[1fr]']">
        <SessionHeader
          v-if="currentProject && state.mode === 'session'"
          :title="activeSession?.title ?? 'No active session'"
          :project="currentProject.name"
          :branch="currentProject.branch"
          :model="selectedModelLabel"
          :status="activeSession?.status ?? 'disconnected'"
          :git-action-label="promoteActionLabel"
          @diff-current="openCurrentSessionDiff"
          @diff-commits="openCommitsListDiff"
          @open-model="state.modelPickerOpen = true"
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
                <div class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
                  <SessionContextCapsule
                    v-if="activeContextBundle"
                    :summary="activeContextSummary"
                    @view="state.contextViewerOpen = true"
                    @remove="removeActiveContext"
                    @back-to-diffs="state.mode = 'diff'"
                  />
                  <div v-if="activeSessionNotice" class="mx-auto mt-2 w-full max-w-5xl px-3 sm:px-5">
                    <div class="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                      <span class="font-medium">{{ activeSessionNotice }}</span>
                      <span class="ml-auto" />
                      <button class="rounded border border-amber-300/30 px-2 py-1 hover:bg-amber-400/10" @click="reloadActiveSessions">Reload sessions</button>
                      <button class="rounded border border-amber-300/30 px-2 py-1 hover:bg-amber-400/10" @click="createReplacementSession">New replacement</button>
                    </div>
                  </div>
                  <Timeline :entries="activeTimeline" :theme-preset="settings.themePreset" :theme-type="diffThemeType" />
                  <Composer
                    :context="contextLabel"
                    :prompt="forms.prompt"
                    :meta="selectedModelLabel"
                    :context-chips="activeContextChips"
                    :disabled="composerDisabled"
                    @update:prompt="setComposerPrompt"
                    @send="sendPrompt"
                    @execute-command="runComposerCommand"
                    @remove-context-chip="removeContextChip"
                  />
                </div>
              </template>

              <template v-else>
                <div class="grid h-full place-items-center p-6">
                  <div class="max-w-xl rounded-xl border border-border/80 bg-card/55 p-6 text-center">
                    <h2 class="mb-2 text-lg font-semibold">No session started</h2>
                    <p class="mb-4 text-sm text-muted-foreground">Review diffs first or start a new session with the agent.</p>
                    <div v-if="state.agentSetupMessage" class="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-left text-xs text-amber-200">
                      <p>{{ state.agentSetupMessage }}</p>
                      <div v-if="state.agentSetupKind === 'gittrix'" class="mt-2 flex flex-wrap gap-3">
                        <button class="underline underline-offset-2" @click="openSettings('Git')">Open GitTrix settings</button>
                        <button class="underline underline-offset-2" @click="useLocalGitTrix">Use local GitTrix</button>
                      </div>
                      <div v-else class="mt-2 flex flex-wrap gap-3">
                        <button class="underline underline-offset-2" @click="openSettings('Models')">Add {{ settings.defaultProvider }} key</button>
                        <button v-if="compatibleUsableModel" class="underline underline-offset-2" @click="selectModel(compatibleUsableModel.providerId, compatibleUsableModel.modelId)">
                          Use {{ compatibleUsableModel.providerId }}/{{ compatibleUsableModel.modelId }}
                        </button>
                        <button class="underline underline-offset-2" @click="state.modelPickerOpen = true">Change model</button>
                      </div>
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
      :github-connected="authState.githubConnected"
      :github-account="authState.githubAccount"
      :github-avatar-url="authState.githubAvatarUrl"
      :github-signing-in="authState.githubSigningIn"
      :github-user-code="authState.githubUserCode"
      :github-verification-uri="authState.githubVerificationUri"
      :github-error="authState.githubError"
      :default-open-mode="settings.defaultOpenMode"
      :initial-tab="state.settingsTab"
      @close="state.settingsOpen = false"
      @update:theme="updateTheme"
      @update:provider="updateDefaultProvider"
      @update:model="selectModel(settings.defaultProvider, $event)"
                @update:keybinding="updateKeybinding"
                @update:open-mode="settings.defaultOpenMode = $event"
                @update:gittrix-provider="updateGitTrixProvider"
                @connect-github="connectGitHub"
                @disconnect-github="disconnectGitHub"
                @open-gittrix="openGitTrixFromSettings"
                @open-model-picker="state.modelPickerOpen = true"
                @provider:add-auth="saveProviderAuth"
      @provider:remove-auth="removeProviderAuth"
    />

    <ModelPicker
      v-if="state.modelPickerOpen"
      :providers="providerCapabilities.providers"
      :default-provider="settings.defaultProvider"
      :default-model="settings.defaultModel"
      @close="state.modelPickerOpen = false"
      @select="selectModel"
      @needs-auth="openProviderAuth"
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
      @update:model-value="updateTheme"
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

    <div v-if="state.promoteDialogOpen" class="fixed inset-0 z-50 flex items-stretch justify-center bg-black/55 p-4 sm:p-6" @click.self="state.promoteDialogOpen = false">
      <div class="flex h-full max-h-[calc(100vh-2rem)] w-full max-w-[min(1500px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-2xl shadow-black/40 sm:max-h-[calc(100vh-3rem)]">
        <div class="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
          <div>
            <div class="text-sm font-medium">Session diff and commit</div>
            <div class="mt-0.5 text-[11px] text-muted-foreground">{{ promoteSelectionLabel }} · {{ promoteFlowLabel }}</div>
          </div>
          <div class="flex items-center gap-2">
            <div v-if="promote.files.length > 1" ref="promoteFileMenuRef" class="relative">
              <button type="button" class="inline-flex h-8 w-[260px] items-center gap-2 rounded border border-border/70 bg-background/70 px-2 text-[11px] hover:bg-muted/50" @click="promote.fileMenuOpen = !promote.fileMenuOpen">
                <span class="min-w-0 flex-1 truncate text-left">{{ promoteSelectionButtonLabel }}</span>
                <ChevronDown class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
              <div v-if="promote.fileMenuOpen" class="fixed inset-0 z-[60] grid place-items-center bg-black/25 p-4" @click.self="promote.fileMenuOpen = false">
                <div class="flex max-h-[min(72vh,560px)] w-[640px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-2xl shadow-black/40">
                  <div class="flex items-center justify-between border-b border-border/70 px-3 py-2">
                    <div class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Select files</div>
                    <button class="rounded border border-border/70 px-2 py-1 text-[11px] hover:bg-muted/60" @click="selectAllPromoteFiles">All</button>
                  </div>
                  <div class="min-h-0 overflow-auto p-1">
                    <button v-for="file in promote.files" :key="file" type="button" class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-muted/70" :title="file" @click="togglePromoteFile(file)">
                      <span class="inline-grid h-4 w-4 place-items-center rounded border border-border/80 text-[10px] text-primary">{{ promote.selectedFiles.includes(file) ? '✓' : '' }}</span>
                      <span class="min-w-0 flex-1 truncate">{{ file }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button class="rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground" @click="state.promoteDialogOpen = false">Close</button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-hidden p-3">
            <div v-if="promote.loading" class="grid h-full place-items-center text-sm text-muted-foreground">Loading diff…</div>
            <div v-else-if="promote.error" class="grid h-full place-items-center rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-100">
              <div class="max-w-xl">
                <div>{{ promote.error }}</div>
                <div v-if="promote.dirtyFiles.length" class="mt-3 max-h-40 overflow-auto rounded border border-red-200/20 bg-black/15 p-2 text-left font-mono text-[11px] text-red-50/85">
                  <div v-for="file in promote.dirtyFiles" :key="file" class="truncate">{{ file }}</div>
                </div>
                <button v-if="promote.dirtyFiles.length" class="mt-4 rounded-md border border-red-200/30 bg-red-100/10 px-3 py-1.5 text-xs font-semibold text-red-50 hover:bg-red-100/15 disabled:cursor-not-allowed disabled:opacity-50" :disabled="promote.stashing" @click="stashAndRetryPromote">
                  {{ promote.stashing ? 'Stashing…' : 'Stash and continue' }}
                </button>
              </div>
            </div>
            <div v-else-if="promote.result" class="grid h-full place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-6 text-center text-sm text-emerald-100">
              <div>
                <div class="font-medium">{{ promoteResultTitle }}</div>
                <div class="mt-1 text-xs text-emerald-100/75">{{ promote.result.branch }} @ {{ promote.result.sha.slice(0, 7) }}</div>
                <div v-if="promote.pushResult" class="mt-1 text-xs text-emerald-100/75">Pushed {{ promote.pushResult.upstream }} @ {{ promote.pushResult.sha.slice(0, 7) }}</div>
              </div>
            </div>
            <div v-else-if="!promote.diff.trim()" class="grid h-full place-items-center rounded-lg border border-border/70 text-sm text-muted-foreground">No session changes.</div>
            <DiffView v-else :patch="promote.diff" :diff-style="state.diffStyle" :theme-type="diffThemeType" :theme-preset="settings.themePreset" />
        </div>
        <div class="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-card/98 px-4 py-3">
          <div class="text-xs text-muted-foreground">
            {{ promoteStatusLabel }}
          </div>
          <div class="flex items-center gap-2">
          <button class="rounded-md border border-border/70 px-3 py-1.5 text-xs" @click="state.promoteDialogOpen = false">Cancel</button>
            <button class="rounded-md border border-border/80 bg-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45" :disabled="promoteCommitDisabled" @click="confirmPromote">{{ promoteCommitLabel }}</button>
          </div>
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
import { computed, defineAsyncComponent, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import type { AgentEvent } from '@glib-code/shared/events/agent';
import CommandPalette from './components/app/CommandPalette.vue';
import TerminalDrawer from './components/app/TerminalDrawer.vue';
import CloneRepoDialog from './components/picker/CloneRepoDialog.vue';
import OpenProjectDialog from './components/picker/OpenProjectDialog.vue';
import PickerScreen from './components/picker/PickerScreen.vue';
import ThemeDialog from './components/picker/ThemeDialog.vue';
import SettingsModal from './components/settings/SettingsModal.vue';
import ModelPicker from './components/settings/ModelPicker.vue';
import Composer from './components/session/Composer.vue';
import SessionContextCapsule from './components/session/SessionContextCapsule.vue';
import SessionHeader from './components/session/SessionHeader.vue';
import SessionSidebar from './components/session/SessionSidebar.vue';
import Timeline from './components/session/Timeline.vue';
import { applyTheme } from './lib/theme';
import { THEME_PRESETS } from '@glib-code/shared/theme/presets';
import type { ThemePreset } from '@glib-code/shared/theme/presets';
import { ChevronDown } from 'lucide-vue-next';
import logoIcon from '../../glibcode-iconlogo.png';
import logoWordmark from '../../glibcode-wordmark.png';

const logoIconSrc = logoIcon;
const logoWordmarkSrc = logoWordmark;
const DiffWorkbench = defineAsyncComponent(() => import('./components/diff/DiffWorkbench.vue'));
const DiffView = defineAsyncComponent(() => import('./components/shared/DiffView.vue'));
const SIDEBAR_WIDTH_KEY = 'glib-sidebar-width';
const SIDEBAR_EXPANDED_WIDTH = 288;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 380;
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:4273/api';

type Session = {
  id: string;
  title: string;
  time: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'stale' | 'running';
  repo: string;
  project: string;
  projectPath: string;
  gittrixSessionId?: string;
  ephemeralPath?: string;
  baselineSha?: string;
};

type SessionMetaApi = {
  id: string;
  projectId: string;
  projectPath: string;
  title: string;
  model: string;
  provider: string;
  gittrixSessionId?: string;
  ephemeralPath?: string;
  baselineSha?: string;
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
  selectedFiles?: string[];
  selectedHunks?: Array<{ id: string; file: string; header: string; startLine: number }>;
  payloadByFile?: Record<string, string>;
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
  toolCalls?: Array<{
    id: string;
    title: string;
    status: 'running' | 'done' | 'failed';
    renderKind: 'diff' | 'code' | 'json' | 'terminal' | 'text' | 'error';
    command?: string;
    cwd?: string;
    preview?: string;
    rawInput?: string;
    rawOutput?: string;
    diff?: string;
    isError?: boolean;
  }>;
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
const draftBySessionId = reactive<Record<string, string>>({});

const settings = reactive({
  themePreset: 'catppuccin-mocha' as ThemePreset,
  defaultProvider: 'codex',
  defaultModel: 'gpt-5.3-codex',
  durableProvider: 'local' as 'local' | 'github',
  ephemeralProvider: 'local' as 'local' | 'cloudflare-artifacts',
  promoteStrategy: 'commit' as 'commit' | 'branch' | 'pr' | 'patch',
  defaultOpenMode: 'diff' as 'diff' | 'session'
});

const authState = reactive({
  githubConnected: false,
  githubAccount: '',
  githubAvatarUrl: '',
  githubSigningIn: false,
  githubUserCode: '',
  githubVerificationUri: '',
  githubError: ''
});

const gitState = reactive({
  canPush: false,
  upstream: '',
  remote: '',
  branch: ''
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
  modelPickerOpen: false,
  settingsTab: 'Models' as 'Models' | 'Git' | 'Appearance' | 'Keybindings',
  terminalOpen: false,
  openProjectDialogOpen: false,
  themeDialogOpen: false,
  cloneDialogOpen: false,
  diffStyle: 'split' as 'split' | 'unified',
  contextViewerOpen: false,
  promoteDialogOpen: false,
  conflictDialogOpen: false,
  agentSetupMessage: '',
  agentSetupKind: 'agent' as 'agent' | 'gittrix'
});

const promote = reactive({
  diff: '',
  loading: false,
  submitting: false,
  stashing: false,
  pushing: false,
  error: '',
  dirtyFiles: [] as string[],
  result: null as null | { sha: string; branch: string; prUrl?: string },
  pushResult: null as null | { remote: string; branch: string; upstream: string; sha: string },
  files: [] as string[],
  selectedFiles: [] as string[],
  fileMenuOpen: false
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
const sidebarSessions = computed(() => sessions.map((session) => ({ ...session, status: staleSessionIds.has(session.id) ? 'stale' as const : session.status })));
const activeContextBundle = computed(() => (state.activeSessionId ? contextBundleBySessionId[state.activeSessionId] : undefined));
const activeContextSummary = computed(() => {
  const ctx = activeContextBundle.value;
  if (!ctx) return '';
  const source = ctx.sourceType === 'commit' && ctx.sourceRef ? `commit ${ctx.sourceRef.slice(0, 7)}` : ctx.sourceType === 'uncommitted' ? 'working tree' : 'selection';
  const fileMeta = `${ctx.fileCount} file${ctx.fileCount === 1 ? '' : 's'}`;
  const sizeMeta = `${Math.max(1, Math.round(ctx.charCount / 1000))}k chars`;
  return `${source} · ${fileMeta} · ${sizeMeta}`;
});

const activeContextChips = computed(() => {
  const ctx = activeContextBundle.value;
  if (!ctx) return [];
  const chips: Array<{ id: string; label: string }> = [];
  const source = ctx.sourceType === 'commit' && ctx.sourceRef ? `commit ${ctx.sourceRef.slice(0, 7)}` : ctx.sourceType === 'uncommitted' ? 'working tree' : 'selection';
  chips.push({ id: 'source', label: source });
  for (const file of ctx.selectedFiles?.length ? ctx.selectedFiles : ctx.selectedFile ? [ctx.selectedFile] : []) {
    chips.push({ id: `file:${file}`, label: file });
  }
  for (const hunk of ctx.selectedHunks ?? []) {
    chips.push({ id: `hunk:${hunk.id}`, label: `${hunk.file} · ${hunk.header}` });
  }
  if (chips.length === 1) chips.push({ id: 'files', label: `${ctx.fileCount} file${ctx.fileCount === 1 ? '' : 's'}` });
  return chips.slice(0, 12);
});

const activeTimeline = computed(() => {
  if (!state.activeSessionId) return [];
  return timelineBySessionId[state.activeSessionId] ?? [];
});

const activeProvider = computed(() => providerCapabilities.providers.find((provider) => provider.id === settings.defaultProvider));
const activeSessionBaselineSha = computed(() => activeSession.value?.baselineSha ?? '');
const activeWorkspaceState = computed(() => {
  const session = activeSession.value;
  if (!session?.gittrixSessionId) return state.mode === 'diff' ? 'reviewing durable repo' : 'no GitTrix workspace yet';
  return session.ephemeralPath ? `session workspace ${session.gittrixSessionId.slice(0, 8)}` : `GitTrix session ${session.gittrixSessionId.slice(0, 8)}`;
});
const activeProviderConnected = computed(() => activeProvider.value?.hasAuth === true);
const compatibleUsableModel = computed(() => {
  if (activeProviderConnected.value) return null;
  for (const provider of providerCapabilities.providers) {
    if (!provider.hasAuth) continue;
    const modelId = provider.modelIds.find((id) => id === settings.defaultModel || id === `${settings.defaultProvider}/${settings.defaultModel}`);
    if (modelId) return { providerId: provider.id, modelId };
  }
  return null;
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
const staleSessionIds = reactive(new Set<string>());
const sessionNoticeById = reactive<Record<string, string | undefined>>({});
const streamErrorCountBySessionId = new Map<string, number>();
const sendingSessionIds = reactive(new Set<string>());

let stopSidebarResize: (() => void) | null = null;
let creatingSession: Promise<Session | null> | null = null;

const activeSessionNotice = computed(() => (state.activeSessionId ? sessionNoticeById[state.activeSessionId] : undefined));
const composerDisabled = computed(() => Boolean(state.activeSessionId && (staleSessionIds.has(state.activeSessionId) || sendingSessionIds.has(state.activeSessionId))));
const promoteHasExplicitFiles = computed(() => promote.files.length > 0);
const promoteSelectionLabel = computed(() => {
  if (promote.loading) return 'Loading session diff…';
  if (!promote.diff.trim()) return 'No session changes';
  if (!promoteHasExplicitFiles.value) return 'All changed files';
  return `${promote.selectedFiles.length} of ${promote.files.length} file${promote.files.length === 1 ? '' : 's'} selected`;
});
const promoteSelectionButtonLabel = computed(() => {
  if (!promoteHasExplicitFiles.value) return 'All changed files';
  if (promote.selectedFiles.length === promote.files.length) return `All files (${promote.files.length})`;
  return `${promote.selectedFiles.length} selected`;
});
const promoteCommitLabel = computed(() => {
  if (promote.pushing) return 'Pushing…';
  if (promote.submitting) return 'Committing…';
  if (promote.result) return promote.pushResult ? 'Committed and pushed' : 'Committed';
  if (!promoteHasExplicitFiles.value || promote.selectedFiles.length === promote.files.length) return 'Commit all';
  return 'Commit selected';
});
const promoteShouldPush = computed(() => settings.durableProvider === 'github' || (settings.durableProvider === 'local' && gitState.canPush));
const promoteActionLabel = computed(() => promoteShouldPush.value ? 'Commit + Push' : 'Commit');
const promoteFlowLabel = computed(() => {
  if (settings.durableProvider === 'github') return 'GitHub durable repo -> pushed branch';
  if (gitState.canPush) return `Local repo -> ${gitState.upstream}`;
  return 'Local repo -> local commit';
});
const promoteResultTitle = computed(() => promote.pushResult || settings.durableProvider === 'github' ? 'Committed and pushed' : 'Committed locally');
const promoteCommitDisabled = computed(() => {
  if (promote.loading || promote.submitting || promote.pushing || promote.result) return true;
  if (promote.error || !promote.diff.trim()) return true;
  return promote.files.length > 0 && promote.selectedFiles.length === 0;
});
const promoteStatusLabel = computed(() => {
  if (promote.loading) return 'Loading session diff…';
  if (promote.submitting) return 'Committing selected changes…';
  if (promote.pushing) return `Pushing to ${gitState.upstream || 'upstream'}…`;
  if (promote.error) return promote.error;
  if (promote.result) return promote.pushResult
    ? `${promoteResultTitle.value}: ${promote.pushResult.upstream} @ ${promote.pushResult.sha.slice(0, 7)}`
    : `${promoteResultTitle.value}: ${promote.result.branch} @ ${promote.result.sha.slice(0, 7)}`;
  return promoteSelectionLabel.value;
});


function eventKey(event: AgentEvent) {
  if (event.type === 'session_start') return `session_start:${event.sessionId}:${event.createdAt}`;
  if (event.type === 'user_turn') return `user_turn:${event.turnId}:${event.at}`;
  if (event.type === 'turn_start') return `turn_start:${event.turnId}:${event.at}`;
  if (event.type === 'turn_end') return `turn_end:${event.turnId}:${event.reason}:${event.at}`;
  if (event.type === 'aborted') return `aborted:${event.turnId}:${event.at}`;
  if (event.type === 'step_start') return `step_start:${event.turnId}:${event.stepId}:${event.at}`;
  if (event.type === 'step_end') return `step_end:${event.turnId}:${event.stepId}:${event.at}`;
  if (event.type === 'text_part') return `text_part:${event.turnId}:${event.stepId}:${event.partId}`;
  if (event.type === 'tool_call') return `tool_call:${event.turnId}:${event.stepId}:${event.callId}:${event.output ? 'end' : 'start'}`;
  return `error:${event.turnId}:${event.name}:${event.at}`;
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

function findTimelineEntry(sessionId: string, id: string) {
  return (timelineBySessionId[sessionId] ?? []).find((entry) => entry.id === id);
}

function ensureAssistantTurn(sessionId: string, turnId: string, at?: string) {
  const id = `${turnId}-assistant`;
  const existing = findTimelineEntry(sessionId, id);
  if (existing) return existing;
  const entry: TimelineEntry = { id, kind: 'Assistant', text: 'Working…', time: timeLabel(at), level: 'info' };
  appendTimelineEvent(sessionId, entry);
  return entry;
}

function filesFromPatch(patch: string) {
  const files = new Set<string>();
  const matches = patch.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm);
  for (const m of matches) files.add((m[2] || m[1] || '').trim());
  const unified = patch.matchAll(/^\+\+\+\s+(?:b\/)?([^\t\n\r]+)$/gm);
  for (const m of unified) {
    const file = (m[1] || '').trim();
    if (file && file !== '/dev/null') files.add(file);
  }
  return [...files].filter(Boolean);
}

function selectAllPromoteFiles() {
  promote.selectedFiles = [...promote.files];
}

function togglePromoteFile(file: string) {
  promote.selectedFiles = promote.selectedFiles.includes(file)
    ? promote.selectedFiles.filter((entry) => entry !== file)
    : [...promote.selectedFiles, file];
}

function setSessionStatus(sessionId: string, status: Session['status']) {
  const session = sessions.find((entry) => entry.id === sessionId);
  if (session) session.status = status;
}

function setComposerPrompt(value: string) {
  forms.prompt = value;
  if (state.activeSessionId) draftBySessionId[state.activeSessionId] = value;
}

function switchActiveSession(sessionId: string) {
  if (state.activeSessionId) draftBySessionId[state.activeSessionId] = forms.prompt;
  state.activeSessionId = sessionId;
  forms.prompt = draftBySessionId[sessionId] ?? '';
}

function clearActiveSession() {
  if (state.activeSessionId) draftBySessionId[state.activeSessionId] = forms.prompt;
  state.activeSessionId = '';
  forms.prompt = '';
}

function redactTimelineText(value: string) {
  return value
    .replace(/([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|AUTH)[A-Z0-9_]*\s*[=:]\s*)(["']?)[^"'\s]+\2/gi, '$1$2[redacted]$2')
    .replace(/\b(?:sk|pk|rk|ghp|gho|github_pat|glpat|xox[baprs])-[A-Za-z0-9_\-]{12,}\b/g, '[redacted]')
    .replace(/\b[A-Za-z0-9_\-]{32,}\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,}\b/g, '[redacted]');
}

function parseToolResult(output: string) {
  const redacted = redactTimelineText(output.trim());
  if (!redacted) return '';
  try {
    const parsed = JSON.parse(redacted) as { content?: Array<{ type?: string; text?: string }>; stdout?: string; stderr?: string; text?: string; error?: string };
    if (Array.isArray(parsed.content)) return parsed.content.map((part) => typeof part.text === 'string' ? part.text : '').filter(Boolean).join('\n');
    return parsed.stdout || parsed.stderr || parsed.text || parsed.error || JSON.stringify(parsed, null, 2);
  } catch {
    return redacted;
  }
}

function isUnifiedDiff(value: string) {
  return /^diff --git /m.test(value) || /^@@ -\d+/m.test(value) || /^--- .+\n\+\+\+ /m.test(value);
}

function summarizeLines(value: string, limit = 6) {
  const lines = value.split('\n').map((line) => line.trimEnd()).filter(Boolean);
  const shown = lines.slice(0, limit).join('\n');
  return lines.length > limit ? `${shown}\n… ${lines.length - limit} more line${lines.length - limit === 1 ? '' : 's'}` : shown;
}

function classifyToolCall(event: Extract<AgentEvent, { type: 'tool_call' }>) {
  const input = event.input as { command?: unknown; cwd?: unknown; filePath?: unknown; path?: unknown };
  const command = typeof input.command === 'string' ? input.command : undefined;
  const cwd = typeof input.cwd === 'string' ? input.cwd : undefined;
  const rawInput = Object.keys(event.input ?? {}).length ? redactTimelineText(JSON.stringify(event.input, null, 2)) : '';
  const rawOutput = event.output?.trim() ? redactTimelineText(event.output.trim()) : '';
  const output = parseToolResult(rawOutput);
  const failed = Boolean((event.metadata as { isError?: unknown })?.isError);
  const fileTarget = typeof input.filePath === 'string' ? input.filePath : typeof input.path === 'string' ? input.path : '';
  const titleTarget = command ? command.split(/\s+/).slice(0, 4).join(' ') : fileTarget;
  const title = `${event.tool}${titleTarget ? ` · ${titleTarget}` : ''}`;

  if (!rawOutput) return { title, status: 'running' as const, renderKind: 'terminal' as const, command, cwd, rawInput, rawOutput, preview: '' };
  if (isUnifiedDiff(output)) return { title, status: failed ? 'failed' as const : 'done' as const, renderKind: failed ? 'error' as const : 'diff' as const, command, cwd, rawInput, rawOutput, diff: output, preview: summarizeLines(output, 4) };
  if (failed) return { title, status: 'failed' as const, renderKind: 'error' as const, command, cwd, rawInput, rawOutput, preview: summarizeLines(output) };
  const trimmed = output.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) return { title, status: 'done' as const, renderKind: 'json' as const, command, cwd, rawInput, rawOutput, preview: summarizeLines(trimmed) };
  const codeLike = /```|\b(import|export|function|const|let|class|type|interface)\b|^\s*[{};]/m.test(trimmed) && trimmed.split('\n').length > 3;
  return { title, status: 'done' as const, renderKind: codeLike ? 'code' as const : 'terminal' as const, command, cwd, rawInput, rawOutput, preview: summarizeLines(trimmed) };
}

function reduceAgentEventToTimeline(sessionId: string, event: AgentEvent) {
  const seen = seenEventKeysBySessionId.get(sessionId) ?? new Set<string>();
  const key = eventKey(event);
  if (seen.has(key)) return;
  seen.add(key);
  seenEventKeysBySessionId.set(sessionId, seen);

  if (event.type === 'user_turn') {
    const id = `${event.turnId}-user`;
    if (!findTimelineEntry(sessionId, id)) {
      appendTimelineEvent(sessionId, { id, kind: 'User', text: event.prompt, time: timeLabel(event.at), level: 'info' });
    }
    return;
  }
  if (event.type === 'turn_start') {
    ensureAssistantTurn(sessionId, event.turnId, event.at);
    setSessionStatus(sessionId, 'running');
    return;
  }
  if (event.type === 'text_part') {
    const entry = ensureAssistantTurn(sessionId, event.turnId, event.at);
    entry.text = entry.text === 'Working…' ? event.text : `${entry.text}${event.text}`;
    return;
  }
  if (event.type === 'tool_call') {
    const entry = ensureAssistantTurn(sessionId, event.turnId, event.at);
    if (entry.text === 'Working…') entry.text = '';
    const calls = entry.toolCalls ?? (entry.toolCalls = []);
    const existing = calls.find((call) => call.id === event.callId);
    const view = classifyToolCall(event);
    if (existing) {
      Object.assign(existing, view, { isError: view.status === 'failed' });
    } else {
      calls.push({
        id: event.callId,
        ...view,
        isError: view.status === 'failed'
      });
    }
    return;
  }
  if (event.type === 'error') {
    const entry = ensureAssistantTurn(sessionId, event.turnId, event.at);
    entry.kind = 'Error';
    entry.text = event.message ?? event.name;
    entry.level = 'error';
    return;
  }
  if (event.type === 'turn_end') {
    const entry = findTimelineEntry(sessionId, `${event.turnId}-assistant`);
    if (entry?.text === 'Working…' || (entry && !entry.text.trim() && entry.toolCalls?.length)) {
      entry.text = event.reason === 'stop' ? 'Tool run completed, but the agent did not return a final answer.' : `Turn ended (${event.reason})`;
      entry.level = event.reason === 'error' ? 'error' : 'info';
    }
    if (event.reason === 'aborted' && !findTimelineEntry(sessionId, `${event.turnId}-aborted`)) {
      appendTimelineEvent(sessionId, { id: `${event.turnId}-aborted`, kind: 'System', text: 'Turn aborted.', time: timeLabel(event.at), level: 'info' });
    }
    setSessionStatus(sessionId, event.reason === 'error' || event.reason === 'aborted' ? 'disconnected' : 'connected');
  }
}

function mapApiSession(meta: SessionMetaApi): Session {
  const normalizedPath = meta.projectPath.replace(/\\/g, '/');
  const repoName = normalizedPath.split('/').filter(Boolean).pop() ?? 'project';
  return {
    id: meta.id,
    title: meta.title,
    time: timeLabel(meta.updatedAt),
    status: meta.status === 'running' ? 'running' : meta.status === 'error' || meta.status === 'aborted' ? 'disconnected' : 'connected',
    repo: repoName,
    project: repoName,
    projectPath: normalizedPath,
    gittrixSessionId: meta.gittrixSessionId,
    ephemeralPath: meta.ephemeralPath,
    baselineSha: meta.baselineSha
  };
}

async function hydrateSessionDoc(sessionId: string) {
  const session = sessions.find((entry) => entry.id === sessionId);
  const query = session?.projectPath ? `?projectPath=${encodeURIComponent(session.projectPath)}` : '';
  const doc = await apiGet<{ meta: SessionMetaApi; events: AgentEvent[] }>(`/sessions/${encodeURIComponent(sessionId)}${query}`);
  timelineBySessionId[sessionId] = [];
  seenEventKeysBySessionId.set(sessionId, new Set<string>());
  for (const evt of doc.events) reduceAgentEventToTimeline(sessionId, evt);
}

function connectSessionStream(sessionId: string) {
  if (streamsBySessionId.has(sessionId)) return;
  const session = sessions.find((entry) => entry.id === sessionId);
  if (!session?.projectPath) return;
  if (staleSessionIds.has(sessionId)) return;
  setSessionStatus(sessionId, 'connecting');
  const stream = new EventSource(`${API_BASE}/agent/sessions/${encodeURIComponent(sessionId)}/stream?projectPath=${encodeURIComponent(session.projectPath)}`);
  const names = ['session_start', 'user_turn', 'turn_start', 'turn_end', 'aborted', 'step_start', 'text_part', 'tool_call', 'step_end', 'error'];
  for (const name of names) {
    stream.addEventListener(name, (evt) => {
      streamErrorCountBySessionId.set(sessionId, 0);
      setSessionStatus(sessionId, 'connected');
      if (!staleSessionIds.has(sessionId)) sessionNoticeById[sessionId] = undefined;
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
    const count = (streamErrorCountBySessionId.get(sessionId) ?? 0) + 1;
    streamErrorCountBySessionId.set(sessionId, count);
    setSessionStatus(sessionId, 'disconnected');
    if (count >= 3) void confirmAndMarkSessionStale(sessionId, 'Session stream disconnected. Reload sessions or start a replacement session.');
  };
  streamsBySessionId.set(sessionId, stream);
}

function disconnectSessionStream(sessionId: string) {
  const stream = streamsBySessionId.get(sessionId);
  if (!stream) return;
  stream.close();
  streamsBySessionId.delete(sessionId);
  streamErrorCountBySessionId.delete(sessionId);
  if (!staleSessionIds.has(sessionId)) setSessionStatus(sessionId, 'disconnected');
}

function markSessionStale(sessionId: string, message: string) {
  if (staleSessionIds.has(sessionId)) return;
  staleSessionIds.add(sessionId);
  sessionNoticeById[sessionId] = message;
  setSessionStatus(sessionId, 'stale');
  disconnectSessionStream(sessionId);
}

async function confirmAndMarkSessionStale(sessionId: string, message: string) {
  try {
    await hydrateSessionDoc(sessionId);
    sessionNoticeById[sessionId] = 'Session stream disconnected. Reconnecting…';
    disconnectSessionStream(sessionId);
    setTimeout(() => connectSessionStream(sessionId), 750);
  } catch {
    markSessionStale(sessionId, message);
  }
}

async function reloadActiveSessions() {
  const activeId = state.activeSessionId;
  await hydrateSessions().catch(() => undefined);
  if (activeId && sessions.some((session) => session.id === activeId)) {
    staleSessionIds.delete(activeId);
    sessionNoticeById[activeId] = undefined;
    connectSessionStream(activeId);
  } else if (activeId) {
    staleSessionIds.add(activeId);
    sessionNoticeById[activeId] = 'Session unavailable after reload. Start a replacement session.';
  }
}

async function createReplacementSession() {
  const previousPrompt = forms.prompt;
  const created = await createSession({ title: 'Replacement Session' });
  if (created) forms.prompt = previousPrompt;
}

async function hydrateSessions() {
  if (!currentProject.value) return;
  const rows = await apiGet<SessionMetaApi[]>('/sessions');
  sessions.splice(0, sessions.length, ...rows.map(mapApiSession));
  const activeIds = new Set(rows.map((row) => row.id));
  for (const id of [...streamsBySessionId.keys()]) {
    if (!activeIds.has(id)) disconnectSessionStream(id);
  }
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
    throw await readApiError(response);
  }
  return response.json() as Promise<T>;
}

class ApiRequestError extends Error {
  status: number;
  code?: string;
  payload?: unknown;

  constructor(status: number, message: string, code?: string, payload?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

async function readApiError(response: Response) {
  const detail = await response.text().catch(() => '');
  if (!detail) return new ApiRequestError(response.status, `request failed: ${response.status}`);
  try {
    const parsed = JSON.parse(detail) as { message?: string; error?: string; code?: string };
    return new ApiRequestError(response.status, parsed.message || parsed.error || parsed.code || detail, parsed.code, parsed);
  } catch {
    return new ApiRequestError(response.status, detail);
  }
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw await readApiError(response);
  }
  return response.json() as Promise<T>;
}

async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!response.ok) {
    throw await readApiError(response);
  }
}

async function apiPatch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw await readApiError(response);
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

async function hydrateSettings() {
  const saved = await apiGet<{
    themePreset: ThemePreset;
    durableProvider: 'local' | 'github';
    ephemeralProvider: 'local' | 'cloudflare-artifacts';
    promoteStrategy: 'commit' | 'branch' | 'pr' | 'patch';
  }>('/settings');
  settings.themePreset = saved.themePreset;
  applyTheme(saved.themePreset);
  settings.durableProvider = saved.durableProvider;
  settings.ephemeralProvider = saved.ephemeralProvider;
  settings.promoteStrategy = saved.promoteStrategy;
}

async function hydrateAuth() {
  const session = await apiGet<{ github?: { connected?: boolean; account?: { login?: string; name?: string; email?: string; avatarUrl?: string } | null } }>('/auth/session');
  authState.githubConnected = session.github?.connected === true;
  authState.githubAccount = session.github?.account?.login ?? '';
  authState.githubAvatarUrl = session.github?.account?.avatarUrl ?? '';
}

async function hydrateGitStatus() {
  if (!currentProject.value) return;
  const status = await apiGet<{ current?: string; upstream?: string; remote?: string; canPush?: boolean }>('/git/status');
  gitState.canPush = status.canPush === true;
  gitState.upstream = status.upstream ?? '';
  gitState.remote = status.remote ?? '';
  gitState.branch = status.current ?? '';
}

async function updateTheme(theme: ThemePreset) {
  if (settings.themePreset === theme) return;
  settings.themePreset = theme;
  applyTheme(theme);
  await apiPatch('/settings', { themePreset: theme });
}

async function updateGitTrixProvider(key: 'durableProvider' | 'ephemeralProvider' | 'promoteStrategy', value: string) {
  if (key === 'durableProvider' && !['local', 'github'].includes(value)) return;
  if (key === 'ephemeralProvider' && !['local', 'cloudflare-artifacts'].includes(value)) return;
  if (key === 'promoteStrategy' && value !== 'commit') return;
  if (key === 'durableProvider' && value === 'github' && !authState.githubConnected) {
    await connectGitHub();
    if (!authState.githubConnected) return;
  }
  if (settings[key] === value) return;
  const saved = await apiPatch<typeof settings>('/settings', { [key]: value });
  settings.durableProvider = saved.durableProvider;
  settings.ephemeralProvider = saved.ephemeralProvider;
  settings.promoteStrategy = saved.promoteStrategy;
}

async function connectGitHub() {
  authState.githubError = '';
  authState.githubSigningIn = true;
  try {
    const started = await apiPost<{ device_code: string; user_code: string; verification_uri: string; interval?: number }>('/auth/github/device/start', {});
    authState.githubUserCode = started.user_code;
    authState.githubVerificationUri = started.verification_uri;
    window.open(started.verification_uri, '_blank', 'noopener,noreferrer');
    const intervalMs = Math.max(1000, (started.interval ?? 5) * 1000);
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      const polled = await apiPost<{ pending?: boolean; connected?: boolean; account?: { login?: string; avatarUrl?: string } | null }>('/auth/github/device/poll', { deviceCode: started.device_code });
      if (polled.pending) continue;
      authState.githubConnected = polled.connected === true;
      authState.githubAccount = polled.account?.login ?? '';
      authState.githubAvatarUrl = polled.account?.avatarUrl ?? '';
      authState.githubUserCode = '';
      authState.githubVerificationUri = '';
      break;
    }
  } catch (error) {
    authState.githubError = error instanceof Error ? error.message : 'GitHub sign-in failed';
  } finally {
    authState.githubSigningIn = false;
  }
}

async function disconnectGitHub() {
  await apiDelete('/auth/github');
  authState.githubConnected = false;
  authState.githubAccount = '';
  authState.githubAvatarUrl = '';
  authState.githubUserCode = '';
  authState.githubVerificationUri = '';
  authState.githubError = '';
  if (settings.durableProvider === 'github') {
    const saved = await apiPatch<typeof settings>('/settings', { durableProvider: 'local' });
    settings.durableProvider = saved.durableProvider;
  }
}

async function useLocalGitTrix() {
  const saved = await apiPatch<typeof settings>('/settings', { durableProvider: 'local', ephemeralProvider: 'local' });
  settings.durableProvider = saved.durableProvider;
  settings.ephemeralProvider = saved.ephemeralProvider;
  settings.promoteStrategy = saved.promoteStrategy;
  state.agentSetupMessage = '';
  state.agentSetupKind = 'agent';
}

async function saveProviderAuth(providerId: string, apiKey: string) {
  const key = apiKey.trim();
  if (!providerId || !key) return;
  const shouldActivate = providerId === settings.defaultProvider;
  const desiredModel = settings.defaultModel;
  await apiPost('/providers/' + encodeURIComponent(providerId) + '/auth', { apiKey: key });
  await hydrateProviders();
  const provider = providerCapabilities.providers.find((item) => item.id === providerId);
  if (shouldActivate && provider?.hasAuth && provider.modelIds.includes(desiredModel)) {
    await selectModel(providerId, desiredModel);
  }
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
  clearActiveSession();
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
  state.agentSetupKind = 'agent';
  switchActiveSession(activeSessionIdByProject[id] ?? '');
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
  if (creatingSession) return creatingSession;
  creatingSession = createSessionInner(options).finally(() => {
    creatingSession = null;
  });
  return creatingSession;
}

async function createSessionInner(options?: { title?: string; context?: string; initialEntries?: TimelineEntry[] }) {
  if (!currentProject.value) return null;
  state.agentSetupMessage = '';
  let created: SessionMetaApi;
  try {
    created = await apiPost<SessionMetaApi>('/agent/sessions', { title: options?.title ?? 'New Session' });
  } catch (error) {
    state.mode = 'session';
    const message = error instanceof Error ? error.message : 'Unable to start session';
    const isGitTrixError = message.toLowerCase().includes('gittrix') || message.includes('GITTRIX_SESSION_START_FAILED');
    state.agentSetupKind = isGitTrixError ? 'gittrix' : 'agent';
    state.agentSetupMessage = !isGitTrixError && (message.includes('provider') || message.includes('model'))
      ? `${message}. Active model: ${settings.defaultProvider}/${settings.defaultModel}. Project picker and diff review still work without an agent key.`
      : message;
    return null;
  }
  const mapped = mapApiSession(created);
    sessions.unshift(mapped);
    staleSessionIds.delete(mapped.id);
    sessionNoticeById[mapped.id] = undefined;
  timelineBySessionId[mapped.id] = [];
  sessionContextById[mapped.id] = options?.context ?? '';
  switchActiveSession(mapped.id);
  activeSessionIdByProject[currentProject.value.id] = mapped.id;
  await hydrateSessionDoc(mapped.id);
  if (options?.initialEntries?.length) {
    for (const entry of options.initialEntries) appendTimelineEvent(mapped.id, entry);
  }
  connectSessionStream(mapped.id);
  state.mode = 'session';
  return mapped;
}

async function startSessionFromDiff(payload: { source: 'commit' | 'uncommitted'; ref?: string; file?: string; files?: string[]; hunks?: Array<{ id: string; file: string; header: string; startLine: number }> }) {
  if (!currentProject.value) return;
  const source = payload.source === 'commit' ? 'commits' : 'uncommitted';
  const scopedFiles = payload.files?.length ? payload.files : payload.file ? [payload.file] : [];
  const hunkFiles = [...new Set((payload.hunks ?? []).map((hunk) => hunk.file))];
  const filesToPack = scopedFiles.length ? scopedFiles : hunkFiles.length ? hunkFiles : [];
  async function packFile(file?: string) {
    const packBody: Record<string, unknown> = { source, projectPath: currentProject.value!.path };
    if (payload.source === 'commit' && payload.ref) packBody.ref = payload.ref;
    if (file) packBody.file = file;
    const packed = await apiPost<{ diff: string }>('/diff/pack', packBody);
    return packed.diff ?? '';
  }
  const payloadByFile: Record<string, string> = {};
  let diff = '';
  if (filesToPack.length) {
    const chunks = await Promise.all(filesToPack.map(async (file) => {
      const chunk = await packFile(file);
      payloadByFile[file] = chunk;
      return chunk;
    }));
    diff = chunks.join('\n').trim() || 'No diff context available.';
  } else {
    diff = (await packFile()).trim() || 'No diff context available.';
  }
  const context = payload.source === 'commit' && payload.ref
    ? `commit ${payload.ref.slice(0, 7)}`
    : 'working tree changes';
  const selectedHunkCopy = payload.hunks?.length ? ` · ${payload.hunks.length} hunks` : '';
  const created = await createSession({
    title: `Session from ${context}`,
    context,
    initialEntries: [{
      id: 'e1',
      kind: 'System',
      text: `Context attached: ${context} · ${filesToPack.length || 'selected'} file scope${selectedHunkCopy}`,
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
      selectedFiles: filesToPack,
      selectedHunks: payload.hunks ?? [],
      payloadByFile,
      fileCount: filesToPack.length || Math.max(1, (diff.match(/^diff --git /gm) ?? []).length),
      charCount: diff.length,
      payload: diff
    };
  }
}

function removeContextChip(id: string) {
  const ctx = activeContextBundle.value;
  if (!ctx || !state.activeSessionId) return;
  if (id === 'source' || id === 'files') {
    removeActiveContext();
    return;
  }
  if (id.startsWith('file:')) {
    const file = id.slice(5);
    ctx.selectedFiles = (ctx.selectedFiles ?? []).filter((entry) => entry !== file);
    ctx.selectedHunks = (ctx.selectedHunks ?? []).filter((hunk) => hunk.file !== file);
  }
  if (id.startsWith('hunk:')) {
    const hunkId = id.slice(5);
    ctx.selectedHunks = (ctx.selectedHunks ?? []).filter((hunk) => hunk.id !== hunkId);
  }
  const remainingFiles = new Set([...(ctx.selectedFiles ?? []), ...(ctx.selectedHunks ?? []).map((hunk) => hunk.file)]);
  if (!remainingFiles.size) {
    removeActiveContext();
    return;
  }
  if (ctx.payloadByFile && Object.keys(ctx.payloadByFile).length) {
    ctx.payload = [...remainingFiles].map((file) => ctx.payloadByFile?.[file] ?? '').filter(Boolean).join('\n').trim() || ctx.payload;
    ctx.fileCount = remainingFiles.size;
    ctx.charCount = ctx.payload.length;
  }
}

function selectSessionFromSidebar(sessionId: string) {
  const session = sessions.find((entry) => entry.id === sessionId);
  if (!session) return;

  switchActiveSession(sessionId);
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
  const sessionId = state.activeSessionId;
  if (staleSessionIds.has(sessionId)) return;
  if (sendingSessionIds.has(sessionId)) return;
  const session = activeSession.value;
  if (!session?.projectPath) return;
  const bundle = contextBundleBySessionId[sessionId];
  sendingSessionIds.add(sessionId);
  try {
    await apiPost(`/agent/sessions/${encodeURIComponent(sessionId)}/send`, {
      prompt: forms.prompt,
      context: bundle?.payload,
      projectPath: session.projectPath
    });
    forms.prompt = '';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send prompt';
    if (message.toLowerCase().includes('session not found')) {
      markSessionStale(sessionId, 'Session not found. Reload sessions or start a replacement session.');
      return;
    }
    sessionNoticeById[sessionId] = message;
  } finally {
    sendingSessionIds.delete(sessionId);
  }
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
  const session = activeSession.value;
  if (!session?.projectPath) return;
  state.promoteDialogOpen = true;
  promote.loading = true;
  promote.submitting = false;
  promote.stashing = false;
  promote.pushing = false;
  promote.error = '';
  promote.dirtyFiles = [];
  promote.result = null;
  promote.pushResult = null;
  promote.diff = '';
  promote.files = [];
  promote.selectedFiles = [];
  promote.fileMenuOpen = false;
  try {
    const payload = await apiGet<{ diff: string; files?: string[] }>(`/sessions/${encodeURIComponent(state.activeSessionId)}/diff?projectPath=${encodeURIComponent(session.projectPath)}`);
    promote.diff = payload.diff ?? '';
    promote.files = payload.files?.length ? payload.files : filesFromPatch(promote.diff);
    promote.selectedFiles = [...promote.files];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load session diff';
    promote.error = message;
    appendTimelineEvent(state.activeSessionId, {
      id: `${state.activeSessionId}-${Date.now()}-promote-open-err`,
      kind: 'Promote',
      text: message,
      time: 'now',
      level: 'error'
    });
  } finally {
    promote.loading = false;
  }
}

async function confirmPromote() {
  if (!state.activeSessionId) return;
  const session = activeSession.value;
  if (!session?.projectPath) return;
  if (promoteCommitDisabled.value) return;
  const files = promote.selectedFiles;
  const selector = !promote.files.length || files.length === promote.files.length ? { mode: 'all' as const } : { mode: 'files' as const, files };
  promote.submitting = true;
  promote.pushing = false;
  promote.error = '';
  promote.dirtyFiles = [];
  promote.pushResult = null;
  try {
    const result = await apiPost<{ sha: string; branch: string; prUrl?: string }>(`/sessions/${encodeURIComponent(state.activeSessionId)}/promote?projectPath=${encodeURIComponent(session.projectPath)}`, {
      selector,
      strategy: 'commit',
      message: promoteCommitMessage(session)
    });
    promote.result = result;
    if (promoteShouldPush.value && settings.durableProvider === 'local') {
      promote.submitting = false;
      promote.pushing = true;
      promote.pushResult = await apiPost<{ remote: string; branch: string; upstream: string; sha: string }>('/git/push', {});
    }
    appendTimelineEvent(state.activeSessionId, {
      id: `${state.activeSessionId}-${Date.now()}-promote`,
      kind: 'Promote',
      text: promote.pushResult
        ? `Committed and pushed: ${promote.pushResult.upstream} @ ${promote.pushResult.sha.slice(0, 7)}`
        : `${promoteResultTitle.value}: ${result.branch} @ ${result.sha.slice(0, 7)}`,
      time: 'now',
      level: 'info'
    });
    void hydrateGitStatus().catch(() => undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Promote failed';
    const payload = error instanceof ApiRequestError ? error.payload as { code?: string; conflictingFiles?: string[]; durableSha?: string; baselineSha?: string; files?: string[] } | undefined : undefined;
    if (payload?.code === 'BASELINE_CONFLICT') {
      conflict.conflictingFiles = payload.conflictingFiles ?? [];
      conflict.durableSha = payload.durableSha ?? '';
      conflict.baselineSha = payload.baselineSha ?? '';
      state.conflictDialogOpen = true;
      return;
    }
    if (payload?.code === 'DURABLE_REPO_DIRTY') {
      promote.dirtyFiles = payload.files ?? [];
    }
    promote.error = message;
    appendTimelineEvent(state.activeSessionId, {
      id: `${state.activeSessionId}-${Date.now()}-promote-err`,
      kind: 'Promote',
      text: message,
      time: 'now',
      level: 'error'
    });
  } finally {
    promote.submitting = false;
    promote.pushing = false;
  }
}

function promoteCommitMessage(session: Session) {
  const title = session.title?.trim() || 'Session changes';
  return `glib-code: ${title}\n\nGenerated-by: glib-code\nSession-id: ${session.id}`;
}

async function stashAndRetryPromote() {
  if (!promote.dirtyFiles.length) return;
  promote.stashing = true;
  promote.error = '';
  try {
    await apiPost('/git/stash', { message: `glib-code stash before session commit ${new Date().toISOString()}` });
    promote.dirtyFiles = [];
    await confirmPromote();
  } catch (error) {
    promote.error = error instanceof Error ? error.message : 'Stash failed';
  } finally {
    promote.stashing = false;
  }
}

async function abortTurn() {
  if (!state.activeSessionId) return;
  const session = activeSession.value;
  if (!session?.projectPath) return;
  await apiDelete(`/agent/sessions/${encodeURIComponent(state.activeSessionId)}/turn?projectPath=${encodeURIComponent(session.projectPath)}`);
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
    clearActiveSession();
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

async function selectModel(providerId: string, modelId: string) {
  const provider = providerCapabilities.providers.find((item) => item.id === providerId);
  if (!provider || !provider.hasAuth) return;
  if (provider.modelIds.length > 0 && !provider.modelIds.includes(modelId)) return;
  const saved = await apiPatch<{ defaultProvider: string; defaultModel: string }>('/providers/defaults', {
    defaultProvider: providerId,
    defaultModel: modelId
  });
  settings.defaultProvider = saved.defaultProvider;
  settings.defaultModel = saved.defaultModel;
  state.modelPickerOpen = false;
}

function openProviderAuth(providerId: string, modelId?: string) {
  settings.defaultProvider = providerId;
  if (modelId) settings.defaultModel = modelId;
  state.modelPickerOpen = false;
  openSettings('Models');
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
    state.modelPickerOpen = true;
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
  void hydrateSettings().catch(() => undefined);
  void hydrateAuth().catch(() => undefined);
  void hydrateProviders().catch(() => undefined);
  window.addEventListener('keydown', onGlobalKeydown);
});

const selectedModelLabel = computed(() => `${settings.defaultProvider}/${settings.defaultModel}`);

watch(
  () => currentProject.value?.path,
  (next) => {
    if (!next) return;
    void hydrateSessions().catch(() => undefined);
    void hydrateGitStatus().catch(() => undefined);
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
