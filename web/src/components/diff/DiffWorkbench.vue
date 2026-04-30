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
            <span>Commits</span>
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
              Commit
            </button>
            <button
              :class="['h-7 rounded px-2 text-[11px]', state.openSource === 'uncommitted' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground']"
              @click="openWorkingTree()"
            >
              Open changes
            </button>
          </div>

          <span class="ml-auto" />
          <button
            class="h-7 rounded border border-primary/55 bg-primary/12 px-2 text-[11px] font-medium text-primary hover:bg-primary/18"
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

            <div
              v-if="fileMenuOpen"
              class="absolute right-0 top-[calc(100%+6px)] z-30 w-[360px] max-w-[60vw] overflow-hidden rounded-md border border-border/80 bg-card/95 shadow-lg shadow-black/30"
            >
              <div class="max-h-[280px] overflow-auto p-1">
                <button
                  v-for="file in state.files"
                  :key="file.path"
                  type="button"
                  :class="[
                    'block w-full truncate rounded px-2 py-1.5 text-left text-[11px]',
                    file.path === state.selectedFilePath ? 'bg-primary/20 text-primary' : 'text-foreground hover:bg-muted/70'
                  ]"
                  :title="file.path"
                  @click="selectFileFromMenu(file.path)"
                >
                  {{ file.path }}
                </button>
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

        <div class="mb-3 flex items-center text-xs text-muted-foreground">
          <span>{{ state.files.length }} changed files</span>
          <span class="mx-2">·</span>
          <span class="truncate">{{ state.selectedFilePath || 'No file selected' }}</span>
        </div>

        <DiffView :patch="state.patch" :diff-style="diffStyle" :theme-type="themeType" :theme-preset="themePreset" />
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { ChevronDown, CornerDownLeft, GitCommitHorizontal } from 'lucide-vue-next';
import DiffView from '../shared/DiffView.vue';
import diffsWordmark from '../../../../diffs-glibiconmain.png';

const API_BASE = 'http://127.0.0.1:4273/api';
const MAX_PATCH_LINES = 12000;
const diffsWordmarkSrc = diffsWordmark;

type DiffItem = { id: string; ref: string; title: string; shortRef: string };
type DiffFile = { path: string; stats: string };

function truncatePatch(patch: string) {
  const lines = patch.split('\n');
  if (lines.length <= MAX_PATCH_LINES) return patch;
  return `${lines.slice(0, MAX_PATCH_LINES).join('\n')}\n\n@@ glib-code: diff truncated (${lines.length - MAX_PATCH_LINES} lines hidden)`;
}

const props = withDefaults(
  defineProps<{
    currentProject: { id: string; name: string; branch: string; path: string };
    diffStyle?: 'split' | 'unified';
    themeType?: 'dark' | 'light';
    themePreset?: 'tokyo-night' | 'catppuccin-mocha' | 'gruvbox-dark' | 'nord';
  }>(),
  { diffStyle: 'split', themeType: 'dark', themePreset: 'catppuccin-mocha' }
);

const emit = defineEmits<{
  'update:diffStyle': [value: 'split' | 'unified'];
  openProjects: [];
  startSessionFromDiff: [payload: { source: 'commit' | 'uncommitted'; ref?: string; file?: string }];
}>();

const state = reactive({
  phase: 'history' as 'history' | 'open',
  items: [] as DiffItem[],
  cursor: 0,
  openSource: 'commit' as 'commit' | 'uncommitted',
  selectedCommitRef: '',
  files: [] as DiffFile[],
  selectedFilePath: '',
  patch: ''
});

const fileMenuOpen = ref(false);
const fileMenuRef = ref<HTMLElement | null>(null);

function onDocPointerDown(event: PointerEvent) {
  const target = event.target as Node | null;
  if (!target) return;
  if (!fileMenuRef.value?.contains(target)) fileMenuOpen.value = false;
}

function onDocKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') fileMenuOpen.value = false;
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

async function loadHistory() {
  const rows = await apiGet<Array<{ id: string; ref?: string; title?: string }>>('/diff/items?source=commits&limit=120');
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
}

async function loadFilesAndPatch() {
  const source = state.openSource === 'commit' ? 'commits' : 'uncommitted';
  const filesQuery = source === 'commits' && state.selectedCommitRef
    ? `/diff/files?source=commits&ref=${encodeURIComponent(state.selectedCommitRef)}`
    : `/diff/files?source=uncommitted`;

  const rows = await apiGet<Array<{ file: string; status?: string }>>(filesQuery);
  state.files = rows.map((row) => ({ path: row.file, stats: row.status ?? '' }));
  if (!state.files.find((row) => row.path === state.selectedFilePath)) {
    state.selectedFilePath = state.files[0]?.path ?? '';
  }

  const payload: Record<string, unknown> = { source };
  if (source === 'commits' && state.selectedCommitRef) payload.ref = state.selectedCommitRef;
  if (state.selectedFilePath) payload.file = state.selectedFilePath;
  const packed = await apiPost<{ diff: string }>('/diff/pack', payload);
  state.patch = truncatePatch(packed.diff ?? '');
}

function selectHistoryRow(index: number) {
  state.cursor = Math.max(0, Math.min(index, Math.max(state.items.length - 1, 0)));
  state.selectedCommitRef = state.items[state.cursor]?.ref ?? '';
}

async function openSelectedCommit() {
  state.phase = 'open';
  state.openSource = 'commit';
  state.selectedCommitRef = state.items[state.cursor]?.ref ?? state.selectedCommitRef;
  await loadFilesAndPatch();
}

async function openWorkingTree() {
  state.phase = 'open';
  state.openSource = 'uncommitted';
  await loadFilesAndPatch();
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

function emitStartSessionFromDiff() {
  const payload: { source: 'commit' | 'uncommitted'; ref?: string; file?: string } = {
    source: state.openSource
  };
  if (state.openSource === 'commit' && state.selectedCommitRef) payload.ref = state.selectedCommitRef;
  if (state.selectedFilePath) payload.file = state.selectedFilePath;
  emit('startSessionFromDiff', payload);
}

async function resetForProject() {
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

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown);
  document.addEventListener('keydown', onDocKeyDown);

  void resetForProject();
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
</style>
