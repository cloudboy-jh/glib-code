<template>
  <section class="h-full overflow-auto p-5">
    <template v-if="state.phase === 'history'">
      <div class="grid h-full place-items-center">
        <div class="w-full max-w-[720px]">
          <div class="mb-6 flex justify-center">
            <div class="diff-wordmark h-24 w-[340px]" :style="{ '--diff-wordmark-url': `url(${diffsWordmarkSrc})` }" role="img" aria-label="Diffs" />
          </div>

          <div class="rounded-xl border border-primary/60 bg-card/80 p-3">
            <div class="mb-2 flex items-center justify-between">
              <button
                class="inline-flex h-8 items-center gap-1.5 rounded border border-primary/55 bg-primary/12 px-2.5 text-[11px] font-medium text-primary hover:bg-primary/18"
                @click="$emit('openProjects')"
              >
                <CornerDownLeft class="h-3.5 w-3.5" />
                <span>Projects</span>
              </button>
              <div class="text-[11px] text-muted-foreground">{{ currentProject.name }}</div>
            </div>
            <div class="mb-2 flex items-center gap-2 text-primary">
              <GitCommitHorizontal class="h-4 w-4" />
              <span class="text-3xl font-semibold tracking-tight">Commit History</span>
            </div>
            <div class="mb-3 text-sm text-muted-foreground">{{ state.items.length }} commits</div>
            <div v-if="state.historyError" class="mb-2 rounded border border-red-500/35 bg-red-500/10 px-2 py-1 text-xs text-red-200">{{ state.historyError }}</div>

            <div class="space-y-1 rounded-md bg-background/35 p-1 text-[16px]">
              <button
                v-for="(item, idx) in visibleItems"
                :key="item.id"
                :class="[
                  'flex h-10 w-full items-center gap-3 rounded-md px-3 text-left transition-colors',
                  visibleStart + idx === state.cursor ? 'bg-muted text-foreground' : 'text-foreground/90 hover:bg-muted/60'
                ]"
                @click="selectHistoryRow(visibleStart + idx)"
                @dblclick="openSelectedCommit()"
              >
                <span class="w-4 text-muted-foreground">
                  {{ visibleStart + idx === visibleStart && visibleStart > 0 ? '^' : visibleStart + idx === Math.min(visibleStart + visibleItems.length - 1, state.items.length - 1) && visibleStart + visibleItems.length < state.items.length ? 'v' : visibleStart + idx === state.cursor ? '>' : '' }}
                </span>
                <span class="w-[74px] shrink-0 text-primary/85">{{ item.shortRef }}</span>
                <span class="min-w-0 flex-1 truncate">{{ item.title }}</span>
              </button>
            </div>

            <div class="mt-2 text-xs text-muted-foreground">Select a commit to open its diff.</div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <section>
        <div class="sticky top-0 z-10 mb-3 flex items-center gap-2 rounded-md border border-border/80 bg-card/95 p-3 backdrop-blur-sm">
          <button
            class="inline-flex h-8 items-center gap-1.5 rounded border border-primary/55 bg-primary/12 px-2.5 text-[11px] font-medium text-primary hover:bg-primary/18"
            @click="state.phase = 'history'"
          >
            <CornerDownLeft class="h-3.5 w-3.5" />
            <span>Repo History</span>
            <span v-if="state.openSource === 'commit' && state.selectedCommitRef" class="rounded border border-primary/40 px-1.5 py-[1px] font-mono text-[10px] text-primary/90">
              {{ state.selectedCommitRef.slice(0, 7) }}
            </span>
            <span v-else-if="state.openSource === 'uncommitted'" class="rounded border border-primary/35 px-1.5 py-[1px] text-[10px] text-primary/85">
              Working
            </span>
          </button>
          <div class="text-xs text-muted-foreground">{{ currentProject.name }}</div>
          <div class="ml-2 rounded-md border border-border/80 bg-background/55 p-0.5">
            <button
              :class="['h-7 rounded px-2 text-[11px]', state.openSource === 'commit' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground']"
              @click="openSelectedCommit()"
            >
              Repo History
            </button>
            <button
              :class="['h-7 rounded px-2 text-[11px]', state.openSource === 'uncommitted' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground']"
              @click="openWorkingTree()"
            >
              Session Diff
            </button>
          </div>

<span class="ml-auto" />
          
          <OpenInEditor
            v-if="state.selectedFilePath"
            :file-path="state.selectedFilePath"
            :preferred-editor="preferredEditor"
            :show-obsidian="true"
            @open-settings="$emit('openSettings')"
          />
          
          <button
            class="h-7 rounded border border-primary/55 bg-primary/12 px-2 text-[11px] font-medium text-primary hover:bg-primary/18"
            :disabled="!state.files.length"
            @click="emitStartSessionFromDiff"
          >
            Start session from diff
          </button>
          <button
            class="h-7 rounded border border-border/70 px-2 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
            :disabled="currentFileIndex <= 0"
            @click="selectPreviousFile"
          >
            Prev
          </button>
          <div ref="fileMenuRef" class="relative">
            <button
              type="button"
              class="inline-flex h-7 w-[260px] max-w-[420px] items-center gap-2 rounded border border-border/70 bg-background/70 px-2 text-[11px] text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              :title="state.selectedFilePath || 'No file selected'"
              @click="fileMenuOpen = !fileMenuOpen"
            >
              <span class="min-w-0 flex-1 truncate text-left">{{ state.selectedFilePath || 'No file selected' }}</span>
              <ChevronDown class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>

            <div v-if="fileMenuOpen" class="fixed inset-0 z-50 grid place-items-center bg-black/25 p-4" @click.self="fileMenuOpen = false">
              <div class="flex max-h-[min(72vh,560px)] w-[640px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-2xl shadow-black/40">
                <div class="flex items-center justify-between border-b border-border/70 px-3 py-2">
                  <div class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Select file</div>
                  <div class="text-[11px] text-muted-foreground">{{ state.files.length }} files</div>
                </div>
<div class="min-h-0 overflow-auto p-1">
                  <div
                    v-for="file in state.files"
                    :key="file.path"
                    :class="[
                      'group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/70',
                      file.path === state.selectedFilePath ? 'bg-primary/20' : ''
                    ]"
                  >
                    <button
                      type="button"
                      :class="[
                        'min-w-0 flex-1 truncate text-left text-[11px]',
                        file.path === state.selectedFilePath ? 'text-primary' : 'text-foreground'
                      ]"
                      :title="file.path"
                      @click="selectFileFromMenu(file.path)"
                    >
                      <span class="w-7 inline-block shrink-0 rounded border border-border/70 px-1 text-center text-[10px] text-muted-foreground">{{ file.status }}</span>
                      <span class="ml-2">{{ file.path }}</span>
                    </button>
                    
                    <div class="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        v-if="file.path.toLowerCase().endsWith('.md') || file.path.toLowerCase().endsWith('.markdown') || file.path.toLowerCase().endsWith('.mdx')"
                        class="h-5 w-5 rounded border border-border/70 bg-background/70 p-0.5 text-[10px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        title="Open in Obsidian"
                        @click="openFileInEditor(file.path, 'obsidian')"
                      >
                        O
                      </button>
                      <button
                        class="h-5 w-5 rounded border border-border/70 bg-background/70 p-0.5 text-[10px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        title="Open in VS Code"
                        @click="openFileInEditor(file.path, 'vscode')"
                      >
                        V
                      </button>
                      <button
                        class="h-5 w-5 rounded border border-border/70 bg-background/70 p-0.5 text-[10px] text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        title="Open in Cursor"
                        @click="openFileInEditor(file.path, 'cursor')"
                      >
                        C
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button
            class="h-7 rounded border border-border/70 px-2 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
            :disabled="currentFileIndex < 0 || currentFileIndex >= state.files.length - 1"
            @click="selectNextFile"
          >
            Next
          </button>
          <div class="rounded-md border border-border/80 bg-background/55 p-0.5">
            <button
              :class="['h-7 rounded px-2 text-[11px]', diffStyle === 'split' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground']"
              @click="$emit('update:diffStyle', 'split')"
            >
              Split
            </button>
            <button
              :class="['h-7 rounded px-2 text-[11px]', diffStyle === 'unified' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground']"
              @click="$emit('update:diffStyle', 'unified')"
            >
              Unified
            </button>
          </div>
        </div>

        <div v-if="isWorkingView" class="mb-3 space-y-2 rounded-md border border-border/70 bg-card/75 p-2 text-xs">
          <div class="flex flex-wrap items-center gap-2">
            <div ref="changesMenuRef" class="relative">
              <button class="inline-flex h-7 items-center gap-1.5 rounded border border-border/70 bg-background/40 px-2 hover:bg-muted/60 disabled:opacity-40" :disabled="!hasSelection || isBusy" @click="toggleMenu('changes')">
                <span>File actions</span>
                <ChevronDown class="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <div v-if="menuOpen === 'changes'" class="absolute left-0 top-[calc(100%+6px)] z-30 min-w-[170px] rounded-md border border-border/80 bg-card/95 p-1 shadow-2xl shadow-black/40">
                <button class="menu-item" @click="menuStageSelected">Stage file</button>
                <button class="menu-item" @click="menuUnstageSelected">Unstage file</button>
                <button class="menu-item menu-item-danger" @click="menuDiscardSelected">Discard file</button>
              </div>
            </div>

            <div ref="bulkMenuRef" class="relative">
              <button class="inline-flex h-7 items-center gap-1.5 rounded border border-border/70 bg-background/40 px-2 hover:bg-muted/60 disabled:opacity-40" :disabled="!hasFiles || isBusy" @click="toggleMenu('bulk')">
                <span>All changes</span>
                <ChevronDown class="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <div v-if="menuOpen === 'bulk'" class="absolute left-0 top-[calc(100%+6px)] z-30 min-w-[170px] rounded-md border border-border/80 bg-card/95 p-1 shadow-2xl shadow-black/40">
                <button class="menu-item" @click="menuStageAll">Stage all listed</button>
                <button class="menu-item" @click="menuUnstageAll">Unstage all listed</button>
                <button class="menu-item menu-item-danger" @click="menuDiscardAll">Discard all listed</button>
              </div>
            </div>

            <div ref="branchMenuRef" class="relative">
              <button class="inline-flex h-7 items-center gap-1.5 rounded border border-border/70 bg-background/40 px-2 hover:bg-muted/60 disabled:opacity-40" :disabled="isBusy" @click="toggleMenu('branch')">
                <span>Branch</span>
                <ChevronDown class="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              <div v-if="menuOpen === 'branch'" class="absolute left-0 top-[calc(100%+6px)] z-30 min-w-[230px] rounded-md border border-border/80 bg-card/95 p-1 shadow-2xl shadow-black/40">
                <button class="menu-item" @click="menuPull">Pull latest</button>
                <input v-model="state.checkoutRef" class="mx-1 my-1 h-7 w-[calc(100%-8px)] rounded border border-border/70 bg-background/70 px-2 text-xs" placeholder="branch/ref" :disabled="isBusy" />
                <button class="menu-item" :disabled="!state.checkoutRef.trim() || isBusy" @click="menuCheckout(false)">Checkout ref</button>
                <button class="menu-item" :disabled="!state.checkoutRef.trim() || isBusy" @click="menuCheckout(true)">Create + checkout</button>
              </div>
            </div>

            <div class="ml-auto flex items-center gap-1.5 rounded border border-border/70 bg-background/40 p-1">
              <span class="px-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Commit</span>
              <input v-model="state.commitMessage" class="h-7 min-w-[240px] rounded border border-border/70 bg-background/70 px-2" placeholder="commit message" :disabled="isBusy" />
              <button class="h-7 rounded border border-primary/60 px-2 text-primary hover:bg-primary/10 disabled:opacity-40" :disabled="!canCommit || isBusy" @click="commitChanges">Commit</button>
            </div>
          </div>
        </div>

        <div v-if="state.gitError || state.gitNotice" class="mb-3 rounded-md border px-2.5 py-1.5 text-xs" :class="state.gitError ? 'border-red-500/35 bg-red-500/10 text-red-200' : 'border-border/70 bg-background/60 text-muted-foreground'">
          {{ state.gitError || state.gitNotice }}
        </div>

<div class="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{{ state.files.length }} changed files</span>
          <span class="mx-2">·</span>
          <span>{{ diffStats.hunks }} hunks</span>
          <span class="mx-2">·</span>
          <span class="text-emerald-300/85">+{{ diffStats.additions }}</span>
          <span class="text-red-300/85">-{{ diffStats.deletions }}</span>
          <span class="mx-2">·</span>
          <span v-if="truncationCount" class="rounded border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-amber-200">{{ truncationCount }} lines truncated</span>
          <span v-if="truncationCount" class="mx-2">·</span>
          <span class="truncate">{{ state.selectedFilePath || 'No file selected' }}</span>
        </div>

        <DiffView :patch="state.patch" :diff-style="diffStyle" :theme-type="themeType" :theme-preset="themePreset" />

        <div v-if="isCommitView && state.selectedCommitRef" class="mt-3">
          <button class="h-7 rounded border border-border/70 px-2 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground" @click="loadCommitDetail">View commit detail</button>
        </div>
      </section>
    </template>

    <div v-if="state.commitDetailOpen && state.commitDetail" class="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6" @click.self="state.commitDetailOpen = false">
      <div class="w-full max-w-3xl rounded-xl border border-border/80 bg-card/95 p-4 shadow-2xl shadow-black/40">
        <div class="mb-2 flex items-center justify-between">
          <div class="text-sm font-semibold">Commit {{ state.commitDetail.sha.slice(0, 10) }}</div>
          <button class="rounded border border-border/70 px-2 py-1 text-[11px]" @click="state.commitDetailOpen = false">Close</button>
        </div>
        <div class="mb-2 text-xs text-muted-foreground">{{ state.commitDetail.authorName }} · {{ state.commitDetail.authorEmail }} · {{ state.commitDetail.date }}</div>
        <div class="mb-1 text-sm font-medium">{{ state.commitDetail.subject }}</div>
        <pre v-if="state.commitDetail.body" class="mb-3 max-h-36 overflow-auto rounded border border-border/70 bg-background/60 p-2 text-xs">{{ state.commitDetail.body }}</pre>
        <div class="max-h-64 overflow-auto rounded border border-border/70 bg-background/50 p-2 text-xs">
          <div v-for="file in state.commitDetail.files" :key="`${file.status}-${file.path}`" class="flex items-center gap-2 py-1">
            <span class="inline-block w-6 rounded border border-border/70 px-1 text-center">{{ file.status }}</span>
            <span class="truncate">{{ file.path }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { ChevronDown, CornerDownLeft, GitCommitHorizontal } from 'lucide-vue-next';
import DiffView from '../shared/DiffView.vue';
import OpenInEditor from '../shared/OpenInEditor.vue';
import type { ThemePreset } from '@glib-code/shared/theme/presets';
import diffsWordmark from '../../../../assets/diffs-glibiconmain.png';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:4273/api';
const MAX_PATCH_LINES = 12000;
const diffsWordmarkSrc = diffsWordmark;

type DiffItem = { id: string; ref: string; title: string; shortRef: string };
type DiffFile = { path: string; status: string };
type GitApiError = Error & { code?: string; files?: string[] };

function truncatePatch(patch: string) {
  const lines = patch.split('\n');
  if (lines.length <= MAX_PATCH_LINES) return patch;
  return `${lines.slice(0, MAX_PATCH_LINES).join('\n')}\n\n@@ glib-code: diff truncated (${lines.length - MAX_PATCH_LINES} lines hidden)`;
}

const props = withDefaults(
  defineProps<{
    currentProject: { id: string; name: string; branch: string; path: string };
    diffStyle?: 'split' | 'unified';
    openRequest?: { token: number; mode: 'session' | 'history' | 'commit' | 'uncommitted'; files?: string[]; commitRef?: string } | null;
    themeType?: 'dark' | 'light';
    themePreset?: ThemePreset;
    preferredEditor?: string | null;
    sessionId?: string;
  }>(),
  { diffStyle: 'split', themeType: 'dark', themePreset: 'catppuccin-mocha', preferredEditor: null }
);

const emit = defineEmits<{
  'update:diffStyle': [value: 'split' | 'unified'];
  openProjects: [];
  startSessionFromDiff: [payload: { source: 'commit' | 'uncommitted'; ref?: string; file?: string }];
  openSettings: [];
}>();

const state = reactive({
  phase: 'history' as 'history' | 'open',
  items: [] as DiffItem[],
  cursor: 0,
  openSource: 'commit' as 'commit' | 'uncommitted',
  selectedCommitRef: '',
  files: [] as DiffFile[],
  selectedFilePath: '',
  patch: '',
  commitMessage: '',
  checkoutRef: '',
  gitNotice: '',
  gitError: '',
  pendingAction: '',
  historyError: '',
  commitDetailOpen: false,
  commitDetail: null as null | { sha: string; authorName: string; authorEmail: string; date: string; subject: string; body: string; files: Array<{ path: string; status: string }> }
});

const gitMeta = reactive({
  stagedCount: 0
});

const fileMenuOpen = ref(false);
const fileMenuRef = ref<HTMLElement | null>(null);
const editorMenuOpen = ref(false);
const menuOpen = ref<'' | 'changes' | 'bulk' | 'branch'>('');
const changesMenuRef = ref<HTMLElement | null>(null);
const bulkMenuRef = ref<HTMLElement | null>(null);
const branchMenuRef = ref<HTMLElement | null>(null);
let loadFilesAndPatchSeq = 0;
let loadedFilesKey = '';
let loadedPatchKey = '';
let loadingPatchKey = '';

const isMarkdownFile = computed(() => {
  const path = state.selectedFilePath.toLowerCase();
  return path.endsWith('.md') || path.endsWith('.markdown') || path.endsWith('.mdx');
});

function onDocPointerDown(event: PointerEvent) {
  const target = event.target as Node | null;
  if (!target) return;
  if (!fileMenuRef.value?.contains(target)) fileMenuOpen.value = false;
  if (!changesMenuRef.value?.contains(target) && !bulkMenuRef.value?.contains(target) && !branchMenuRef.value?.contains(target)) menuOpen.value = '';
  editorMenuOpen.value = false;
}

function onDocKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    fileMenuOpen.value = false;
    menuOpen.value = '';
    editorMenuOpen.value = false;
  }
}

function toggleMenu(next: '' | 'changes' | 'bulk' | 'branch') {
  menuOpen.value = menuOpen.value === next ? '' : next;
}

const visibleStart = computed(() => {
  const rows = 7;
  if (state.items.length <= rows) return 0;
  if (state.cursor < rows) return 0;
  if (state.cursor >= state.items.length - rows) return state.items.length - rows;
  return Math.max(0, state.cursor - Math.floor(rows / 2));
});

const visibleItems = computed(() => state.items.slice(visibleStart.value, visibleStart.value + 7));
const currentFileIndex = computed(() => state.files.findIndex((row) => row.path === state.selectedFilePath));
const isCommitView = computed(() => state.phase === 'open' && state.openSource === 'commit');
const isWorkingView = computed(() => state.phase === 'open' && state.openSource === 'uncommitted');
const hasSelection = computed(() => Boolean(state.selectedFilePath));
const hasFiles = computed(() => state.files.length > 0);
const hasStaged = computed(() => gitMeta.stagedCount > 0);
const canCommit = computed(() => state.commitMessage.trim().length > 0 && hasStaged.value);
const isBusy = computed(() => Boolean(state.pendingAction));
const diffStats = computed(() => ({
  hunks: (state.patch.match(/^@@/gm) ?? []).length,
  additions: (state.patch.match(/^\+[^+]/gm) ?? []).length,
  deletions: (state.patch.match(/^-[^-]/gm) ?? []).length
}));
const truncationCount = computed(() => Number(state.patch.match(/diff truncated \((\d+) lines hidden\)/)?.[1] ?? 0));

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw await readError(response);
  return response.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw await readError(response);
  return response.json() as Promise<T>;
}

async function readError(response: Response): Promise<GitApiError> {
  const text = await response.text().catch(() => '');
  try {
    const parsed = JSON.parse(text || '{}') as { message?: string; code?: string; files?: string[] };
    const error = new Error(parsed.message || `request failed: ${response.status}`) as GitApiError;
    error.code = parsed.code;
    error.files = parsed.files;
    return error;
  } catch {
    return new Error(text || `request failed: ${response.status}`) as GitApiError;
  }
}

function describeGitError(error: unknown) {
  const e = error as GitApiError;
  if (e.code === 'DIRTY_TREE') return `Dirty tree: ${(e.files ?? []).join(', ') || e.message}`;
  if (e.code === 'PULL_CONFLICT') return `Pull conflict: ${(e.files ?? []).join(', ') || e.message}`;
  if (e.code === 'NOTHING_TO_COMMIT') return 'Nothing to commit.';
  if (e.code === 'MESSAGE_REQUIRED') return 'Commit message required.';
  if (e.code === 'PROTECTED_PATH') return `Protected path: ${(e.files ?? []).join(', ') || '.glib/**'}`;
  return e?.message || 'git action failed';
}

async function loadHistory() {
  state.historyError = '';
  try {
    const rows = await apiGet<Array<{ id: string; ref?: string; title?: string }>>(`/diff/items?source=commits&limit=120&projectPath=${encodeURIComponent(props.currentProject.path)}`);
    state.items = rows.map((row) => ({
      id: row.id,
      ref: row.ref ?? row.id,
      title: row.title ?? row.id,
      shortRef: (row.ref ?? row.id).slice(0, 7)
    }));
    if (!state.items.length) {
      state.cursor = 0;
      state.selectedCommitRef = '';
      return;
    }
    state.cursor = Math.min(state.cursor, state.items.length - 1);
    state.selectedCommitRef = state.items[state.cursor]?.ref ?? '';
  } catch (error) {
    state.items = [];
    state.cursor = 0;
    state.selectedCommitRef = '';
    state.historyError = error instanceof Error ? error.message : 'Failed to load commit history';
  }
}

async function loadFilesAndPatch() {
  const requestSeq = loadFilesAndPatchSeq;
  const source = state.openSource === 'commit' ? 'commits' : 'uncommitted';
  const filesKey = `${props.currentProject.path}:${source}:${source === 'commits' ? state.selectedCommitRef : ''}`;
  const filesQuery = source === 'commits' && state.selectedCommitRef
    ? `/diff/files?source=commits&ref=${encodeURIComponent(state.selectedCommitRef)}&projectPath=${encodeURIComponent(props.currentProject.path)}`
    : `/diff/files?source=uncommitted&projectPath=${encodeURIComponent(props.currentProject.path)}`;

  if (loadedFilesKey !== filesKey) {
    const rows = await apiGet<Array<{ file: string; status?: string }>>(filesQuery);
    if (requestSeq !== loadFilesAndPatchSeq) return;
    state.files = rows.map((row) => ({ path: row.file, status: row.status ?? '' }));
    loadedFilesKey = filesKey;
    loadedPatchKey = '';
    if (!state.files.find((row) => row.path === state.selectedFilePath)) {
      state.selectedFilePath = state.files[0]?.path ?? '';
    }
  }

  const patchKey = `${filesKey}:${state.selectedFilePath}`;
  if (patchKey === loadedPatchKey || patchKey === loadingPatchKey) return;
  loadingPatchKey = patchKey;

  const payload: Record<string, unknown> = { source };
  payload.projectPath = props.currentProject.path;
  if (source === 'commits' && state.selectedCommitRef) payload.ref = state.selectedCommitRef;
  if (state.selectedFilePath) payload.file = state.selectedFilePath;
  try {
    const packed = await apiPost<{ diff: string }>('/diff/pack', payload);
    if (requestSeq !== loadFilesAndPatchSeq || loadingPatchKey !== patchKey) return;
    state.patch = truncatePatch(packed.diff ?? '');
    loadedPatchKey = patchKey;
  } finally {
    if (loadingPatchKey === patchKey) loadingPatchKey = '';
  }
}

function prioritizeFiles(files: DiffFile[], preferredFiles: string[]) {
  if (!preferredFiles.length || files.length <= 1) return files;
  const preferredSet = new Set(preferredFiles);
  const preferred = files.filter((file) => preferredSet.has(file.path));
  const rest = files.filter((file) => !preferredSet.has(file.path));
  return [...preferred, ...rest];
}

async function loadGitStatus() {
  try {
    const status = await apiGet<{ staged?: string[] }>('/git/status');
    gitMeta.stagedCount = Array.isArray(status?.staged) ? status.staged.length : 0;
  } catch {
    gitMeta.stagedCount = 0;
  }
}

function beginGitAction(name: string) {
  state.pendingAction = name;
  state.gitError = '';
}

function endGitAction() {
  state.pendingAction = '';
}

function clearGitMessage() {
  state.gitError = '';
  state.gitNotice = '';
}

async function stageFiles(files: string[]) {
  if (!isWorkingView.value || !files.length) return;
  beginGitAction('stage');
  try {
    await apiPost('/git/stage', { files });
    state.gitNotice = `staged ${files.length} file${files.length === 1 ? '' : 's'}`;
    await loadFilesAndPatch();
    await loadGitStatus();
  } catch (error) {
    state.gitError = describeGitError(error);
  } finally {
    endGitAction();
  }
}

async function unstageFiles(files: string[]) {
  if (!isWorkingView.value || !files.length) return;
  beginGitAction('unstage');
  try {
    await apiPost('/git/unstage', { files });
    state.gitNotice = `unstaged ${files.length} file${files.length === 1 ? '' : 's'}`;
    await loadFilesAndPatch();
    await loadGitStatus();
  } catch (error) {
    state.gitError = describeGitError(error);
  } finally {
    endGitAction();
  }
}

async function discardFiles(files: string[]) {
  if (!isWorkingView.value) return;
  if (!files.length) return;
  if (!confirm(`Discard changes for ${files.join(', ')}?`)) return;
  beginGitAction('discard');
  try {
    await apiPost('/git/discard', { files });
    state.gitNotice = `discarded ${files.length} file${files.length === 1 ? '' : 's'}`;
    await loadFilesAndPatch();
    await loadGitStatus();
  } catch (error) {
    state.gitError = describeGitError(error);
  } finally {
    endGitAction();
  }
}

async function commitChanges() {
  if (!isWorkingView.value || !canCommit.value) return;
  beginGitAction('commit');
  try {
    const result = await apiPost<{ sha: string; branch: string }>('/git/commit', { message: state.commitMessage });
    state.gitNotice = `committed ${result.sha.slice(0, 7)} on ${result.branch}`;
    state.commitMessage = '';
    await loadHistory();
    await loadFilesAndPatch();
    await loadGitStatus();
  } catch (error) {
    state.gitError = describeGitError(error);
  } finally {
    endGitAction();
  }
}

async function pullLatest() {
  if (!isWorkingView.value) return;
  beginGitAction('pull');
  try {
    await apiPost('/git/pull', {});
    state.gitNotice = 'pull complete';
    await loadHistory();
    await loadFilesAndPatch();
    await loadGitStatus();
  } catch (error) {
    state.gitError = describeGitError(error);
  } finally {
    endGitAction();
  }
}

async function checkoutRef(create: boolean) {
  if (!isWorkingView.value) return;
  const ref = state.checkoutRef.trim();
  if (!ref) return;
  if (create && !confirm(`Create and checkout branch "${ref}"?`)) return;
  beginGitAction('checkout');
  try {
    await apiPost('/git/checkout', { ref, create });
    state.gitNotice = create ? `created and checked out ${ref}` : `checked out ${ref}`;
    await resetForProject();
  } catch (error) {
    state.gitError = describeGitError(error);
  } finally {
    endGitAction();
  }
}

async function loadCommitDetail() {
  if (!state.selectedCommitRef) return;
  state.gitError = '';
  try {
    state.commitDetail = await apiGet(`/git/commit/${encodeURIComponent(state.selectedCommitRef)}`);
    state.commitDetailOpen = true;
  } catch (error) {
    state.gitError = describeGitError(error);
  }
}

function selectHistoryRow(index: number) {
  state.cursor = Math.max(0, Math.min(index, Math.max(state.items.length - 1, 0)));
  state.selectedCommitRef = state.items[state.cursor]?.ref ?? '';
}

async function openSelectedCommit() {
  loadFilesAndPatchSeq++;
  clearGitMessage();
  state.phase = 'open';
  state.openSource = 'commit';
  state.selectedCommitRef = state.items[state.cursor]?.ref ?? state.selectedCommitRef;
  await loadFilesAndPatch();
}

async function openWorkingTree(preferredFiles: string[] = []) {
  loadFilesAndPatchSeq++;
  clearGitMessage();
  state.phase = 'open';
  state.openSource = 'uncommitted';
  await loadFilesAndPatch();
  if (preferredFiles.length && state.files.length) {
    state.files = prioritizeFiles(state.files, preferredFiles);
    const preferred = preferredFiles.find((file) => state.files.some((row) => row.path === file));
    if (preferred && preferred !== state.selectedFilePath) {
      state.selectedFilePath = preferred;
      loadedPatchKey = '';
      await loadFilesAndPatch();
    }
  }
  await loadGitStatus();
}

async function applyOpenRequest(request?: { token: number; mode: 'session' | 'history' | 'commit' | 'uncommitted'; files?: string[]; commitRef?: string } | null) {
  if (!request) return;
  if (request.mode === 'history') {
    await loadHistory();
    state.phase = 'history';
    return;
  }
  if (request.mode === 'commit' && request.commitRef) {
    // Ensure history is loaded so items are populated
    if (!state.items.length) await loadHistory();
    const idx = state.items.findIndex((item) => item.ref === request.commitRef);
    state.cursor = idx >= 0 ? idx : 0;
    state.selectedCommitRef = request.commitRef;
    state.openSource = 'commit';
    state.phase = 'open';
    await loadFilesAndPatch();
    return;
  }
  if (request.mode === 'uncommitted') {
    await openWorkingTree(request.files ?? []);
    return;
  }
  await openWorkingTree(request.files ?? []);
}

function stageSelected() {
  if (!state.selectedFilePath) return;
  void stageFiles([state.selectedFilePath]);
}

function unstageSelected() {
  if (!state.selectedFilePath) return;
  void unstageFiles([state.selectedFilePath]);
}

function discardSelected() {
  if (!state.selectedFilePath) return;
  void discardFiles([state.selectedFilePath]);
}

function stageAll() {
  void stageFiles(state.files.map((row) => row.path));
}

function unstageAll() {
  void unstageFiles(state.files.map((row) => row.path));
}

function discardAll() {
  void discardFiles(state.files.map((row) => row.path));
}

function menuStageSelected() {
  menuOpen.value = '';
  stageSelected();
}

function menuUnstageSelected() {
  menuOpen.value = '';
  unstageSelected();
}

function menuDiscardSelected() {
  menuOpen.value = '';
  discardSelected();
}

function menuStageAll() {
  menuOpen.value = '';
  stageAll();
}

function menuUnstageAll() {
  menuOpen.value = '';
  unstageAll();
}

function menuDiscardAll() {
  menuOpen.value = '';
  discardAll();
}

function menuPull() {
  menuOpen.value = '';
  void pullLatest();
}

function menuCheckout(create: boolean) {
  menuOpen.value = '';
  void checkoutRef(create);
}

async function selectFile(path: string) {
  if (state.selectedFilePath === path) return;
  state.selectedFilePath = path;
  await loadFilesAndPatch();
}

async function selectFileFromMenu(path: string) {
  fileMenuOpen.value = false;
  await selectFile(path);
}

async function selectPreviousFile() {
  if (currentFileIndex.value <= 0) return;
  await selectFile(state.files[currentFileIndex.value - 1].path);
}

async function selectNextFile() {
  if (currentFileIndex.value < 0 || currentFileIndex.value >= state.files.length - 1) return;
  await selectFile(state.files[currentFileIndex.value + 1].path);
}

async function openFileInEditor(filePath: string, editor: string) {
  fileMenuOpen.value = false;
  
  try {
    const response = await fetch(`${API_BASE}/open/editor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        editor,
        path: filePath,
        sessionId: props.sessionId
      })
    });

    const result = await response.json();
    
    if (!result.ok) {
      alert(`Failed to open file in ${editor}: ${result.message}`);
    }
  } catch (error) {
    alert(`Error opening file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function openInEditor(editor: string) {
  editorMenuOpen.value = false;
  
  if (!state.selectedFilePath) {
    alert('No file selected');
    return;
  }

  await openFileInEditor(state.selectedFilePath, editor);
}

function emitStartSessionFromDiff() {
  const payload: { source: 'commit' | 'uncommitted'; ref?: string; file?: string } = {
    source: state.openSource
  };
  if (state.openSource === 'commit' && state.selectedCommitRef) payload.ref = state.selectedCommitRef;
  if (state.selectedFilePath) payload.file = state.selectedFilePath;
  emit('startSessionFromDiff', payload);
}

async function resetForProject() {
  loadFilesAndPatchSeq++;
  loadedFilesKey = '';
  loadedPatchKey = '';
  loadingPatchKey = '';
  state.phase = 'history';
  state.cursor = 0;
  state.openSource = 'commit';
  state.selectedFilePath = '';
  state.files = [];
  state.patch = '';
  await loadHistory();
}

watch(() => props.currentProject.path, () => {
  void resetForProject();
});

watch(() => props.openRequest?.token, () => {
  void applyOpenRequest(props.openRequest);
});

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown);
  document.addEventListener('keydown', onDocKeyDown);

  void resetForProject().then(() => applyOpenRequest(props.openRequest));
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown);
  document.removeEventListener('keydown', onDocKeyDown);
});
</script>

<style scoped>
.diff-wordmark {
  background-color: hsl(var(--primary));
  -webkit-mask-image: var(--diff-wordmark-url);
  mask-image: var(--diff-wordmark-url);
  -webkit-mask-mode: luminance;
  mask-mode: luminance;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  border-radius: 0.375rem;
  border: 1px solid transparent;
  padding: 0.4rem 0.5rem;
  text-align: left;
  color: hsl(var(--foreground));
}

.menu-item:hover {
  background: hsl(var(--muted) / 0.7);
}

.menu-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.menu-item-danger {
  color: rgb(252 165 165);
}

.menu-item-danger:hover {
  background: rgb(239 68 68 / 0.12);
}
</style>
