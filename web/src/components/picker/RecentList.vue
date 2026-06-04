<template>
  <div class="space-y-1">
    <template v-for="(r, idx) in recents" :key="r.id">
      <div :class="['recent-row', activeIndex === activeOffset + idx ? 'recent-row-active' : '']">
        <button class="recent-row-open" @click="toggleModeCards(r.path)">
          <span class="recent-row-left">
            <Folder class="h-4 w-4" />
            <span class="min-w-0">
              <span class="block truncate">{{ r.name }}</span>
              <span v-if="r.status === 'missing_path'" class="recent-row-status">Missing path</span>
              <span v-else-if="r.status === 'missing_git'" class="recent-row-status">Not a git repo</span>
            </span>
          </span>
        </button>

        <span class="recent-row-actions">
          <button class="recent-row-action" type="button" title="Forget this project and remove glib metadata" @click="$emit('forget', r.id)">Forget</button>
        </span>
      </div>

      <div v-if="expandedPath === r.path">
        <!-- Top-level mode choice: Diffs | Session -->
        <div v-if="modePhase === 'mode'" class="recent-mode-cards">
          <button
            :class="['recent-mode-button', hoveredMode === 'diff' ? 'recent-mode-button-active' : '']"
            type="button"
            @mouseenter="hoveredMode = 'diff'"
            @click="enterDiffList(r.path)"
          >
            <span class="recent-mode-icon recent-mode-icon-primary"><GitBranch class="h-4 w-4" /></span>
            <span>
              <span class="recent-mode-label">Diffs</span>
              <span class="recent-mode-text">Review changes first</span>
            </span>
          </button>

          <button
            :class="['recent-mode-button', hoveredMode === 'session' ? 'recent-mode-button-active' : '']"
            type="button"
            @mouseenter="hoveredMode = 'session'"
            @click="modePhase = 'session-choice'"
          >
            <span class="recent-mode-icon recent-mode-glyph">&gt;_</span>
            <span>
              <span class="recent-mode-label">Session</span>
              <span class="recent-mode-text">Continue or start fresh</span>
            </span>
          </button>
        </div>

        <!-- Diff list: Working tree + recent commits -->
        <div v-else-if="modePhase === 'diff-list'" class="recent-session-choice">
          <button class="recent-back-button" type="button" @click="modePhase = 'mode'">
            <ArrowLeft class="h-3.5 w-3.5" />
            <span>Back</span>
          </button>
          <div class="recent-session-list">
            <!-- Working tree always first -->
            <button
              type="button"
              class="recent-session-row"
              @click="$emit('openDiff', { name: r.name, path: r.path, source: 'uncommitted' })"
            >
              <span class="min-w-0 flex-1 truncate">Working tree</span>
              <span class="shrink-0 text-[11px] text-muted-foreground/60">uncommitted</span>
            </button>
            <!-- Commits -->
            <template v-if="commitsLoadingForPath === canonicalizePath(r.path)">
              <div class="px-2 py-2 text-xs text-muted-foreground/60">Loading commits…</div>
            </template>
            <template v-else>
              <button
                v-for="commit in commitsForPath(r.path)"
                :key="commit.ref"
                type="button"
                class="recent-session-row"
                @click="$emit('openDiff', { name: r.name, path: r.path, source: 'commit', commitRef: commit.ref })"
              >
                <span class="shrink-0 font-mono text-[10px] text-primary/80 mr-2">{{ commit.shortRef }}</span>
                <span class="min-w-0 flex-1 truncate">{{ commit.title }}</span>
              </button>
              <div v-if="commitsForPath(r.path).length === 0 && commitsLoadingForPath !== canonicalizePath(r.path)" class="px-2 py-2 text-xs text-muted-foreground">No commits yet.</div>
            </template>
          </div>
        </div>

        <!-- Session: Continue or New -->
        <div v-else-if="modePhase === 'session-choice'" class="recent-session-choice">
          <button class="recent-back-button" type="button" @click="modePhase = 'mode'">
            <ArrowLeft class="h-3.5 w-3.5" />
            <span>Back</span>
          </button>
          <div class="recent-mode-cards">
            <button class="recent-mode-button" type="button" @click="modePhase = 'session-list'">
              <span class="recent-mode-icon"><History class="h-4 w-4" /></span>
              <span>
                <span class="recent-mode-label">Continue</span>
                <span class="recent-mode-text">Choose existing session</span>
              </span>
            </button>
            <button class="recent-mode-button" type="button" @click="$emit('startNewSession', { name: r.name, path: r.path })">
              <span class="recent-mode-icon"><PlusSquare class="h-4 w-4" /></span>
              <span>
                <span class="recent-mode-label">New</span>
                <span class="recent-mode-text">Create fresh session</span>
              </span>
            </button>
          </div>
        </div>

        <!-- Session list -->
        <div v-else class="recent-session-choice">
          <button class="recent-back-button" type="button" @click="modePhase = 'session-choice'">
            <ArrowLeft class="h-3.5 w-3.5" />
            <span>Back</span>
          </button>
          <div class="recent-session-list">
            <button
              v-for="session in visibleSessionsForPath(r.path)"
              :key="`${r.path}-${session.id}`"
              type="button"
              class="recent-session-row"
              @click="$emit('continueSession', { name: r.name, path: r.path, sessionId: session.id })"
            >
              <span class="min-w-0 flex-1 truncate">{{ session.title }}</span>
              <span class="shrink-0 text-[11px] text-muted-foreground/75">{{ session.time }}</span>
            </button>
            <button
              v-if="sessionsForPath(r.path).length > 5"
              type="button"
              class="recent-show-more"
              @click="toggleShowAllSessions(r.path)"
            >
              {{ showAllSessionPaths.has(canonicalizePath(r.path)) ? 'Show less' : `Show ${sessionsForPath(r.path).length - 5} more` }}
            </button>
            <div v-if="sessionsForPath(r.path).length === 0" class="px-2 py-2 text-xs text-muted-foreground">No sessions yet.</div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="recents.length === 0" class="rounded-md border border-dashed border-border/70 bg-background/25 px-3 py-5 text-center text-sm text-muted-foreground">
      No recent projects
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { ArrowLeft, Folder, GitBranch, History, PlusSquare } from 'lucide-vue-next';

type CommitRow = { ref: string; shortRef: string; title: string };

const props = withDefaults(
  defineProps<{
    recents: Array<{ id: string; name: string; path: string; lastOpenedAt: string; status: 'ok' | 'missing_path' | 'missing_git' }>;
    sessionsByPath?: Record<string, Array<{ id: string; title: string; time: string }>>;
    commitsByPath?: Record<string, CommitRow[]>;
    activeIndex?: number;
    activeOffset?: number;
  }>(),
  {
    activeIndex: -1,
    activeOffset: 0
  }
);
const emit = defineEmits<{
  open: [payload: { name: string; path: string; mode: 'diff' | 'session' }];
  openDiff: [payload: { name: string; path: string; source: 'uncommitted' | 'commit'; commitRef?: string }];
  continueSession: [payload: { name: string; path: string; sessionId: string }];
  startNewSession: [payload: { name: string; path: string }];
  forget: [id: string];
  fetchCommits: [path: string];
}>();

const expandedPath = ref<string | null>(null);
const hoveredMode = ref<'diff' | 'session'>('diff');
const modePhase = ref<'mode' | 'diff-list' | 'session-choice' | 'session-list'>('mode');
const showAllSessionPaths = ref(new Set<string>());
const commitsLoadingForPath = ref<string | null>(null);

function toggleModeCards(path: string) {
  expandedPath.value = expandedPath.value === path ? null : path;
  hoveredMode.value = 'diff';
  modePhase.value = 'mode';
}

function enterDiffList(path: string) {
  const key = canonicalizePath(path);
  modePhase.value = 'diff-list';
  if (!props.commitsByPath?.[key]) {
    commitsLoadingForPath.value = key;
    emit('fetchCommits', path);
  }
}

function commitsForPath(path: string): CommitRow[] {
  return props.commitsByPath?.[canonicalizePath(path)] ?? [];
}

// Clear loading flag reactively when commitsByPath is populated
watch(
  () => props.commitsByPath,
  (byPath) => {
    if (!commitsLoadingForPath.value) return;
    if (byPath?.[commitsLoadingForPath.value] !== undefined) {
      commitsLoadingForPath.value = null;
    }
  },
  { deep: true }
);

function sessionsForPath(path: string) {
  return props.sessionsByPath?.[canonicalizePath(path)] ?? [];
}

function visibleSessionsForPath(path: string) {
  const sessions = sessionsForPath(path);
  if (showAllSessionPaths.value.has(canonicalizePath(path))) return sessions;
  return sessions.slice(0, 5);
}

function toggleShowAllSessions(path: string) {
  const key = canonicalizePath(path);
  const next = new Set(showAllSessionPaths.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  showAllSessionPaths.value = next;
}

function canonicalizePath(path: string) {
  const slashNormalized = path.replace(/\\/g, '/').trim();
  const withoutTrailing = slashNormalized.replace(/\/+$/g, '');
  const maybeDrive = /^[A-Za-z]:\//.test(withoutTrailing);
  const normalizedDrive = maybeDrive ? `${withoutTrailing[0].toLowerCase()}${withoutTrailing.slice(1)}` : withoutTrailing;
  return normalizedDrive.toLowerCase();
}
</script>

<style scoped>
.recent-row {
  display: flex;
  height: 42px;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  border-radius: 8px;
  border: 1px solid transparent;
  background: hsl(var(--background) / 0.25);
  padding: 0 12px;
  color: hsl(var(--foreground));
}

.recent-row-open {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  border-radius: 8px;
  color: inherit;
}

.recent-row:hover {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.55);
}

.recent-row-active {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.7);
}

.recent-row-left {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.recent-row-status {
  display: block;
  font-size: 11px;
  color: hsl(var(--muted-foreground) / 0.85);
}

.recent-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.recent-row-action {
  display: inline-flex;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  padding: 0 8px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.recent-row-action:hover {
  background: hsl(var(--muted) / 0.75);
  color: hsl(var(--foreground));
}

.recent-mode-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 6px 0 2px;
  padding: 0 2px;
}

.recent-session-choice {
  margin: 6px 0 2px;
  padding: 0 2px;
}

.recent-back-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  border-radius: 7px;
  border: 1px solid hsl(var(--border) / 0.7);
  background: hsl(var(--background) / 0.25);
  padding: 4px 8px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.recent-back-button:hover {
  background: hsl(var(--muted) / 0.65);
  color: hsl(var(--foreground));
}

.recent-session-list {
  border-radius: 9px;
  border: 1px solid hsl(var(--border) / 0.7);
  background: hsl(var(--background) / 0.2);
  padding: 8px;
}

.recent-session-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  border-radius: 7px;
  border: 1px solid hsl(var(--border) / 0.65);
  background: hsl(var(--background) / 0.35);
  padding: 8px 10px;
  text-align: left;
  font-size: 13px;
  color: hsl(var(--foreground));
}

.recent-session-row + .recent-session-row {
  margin-top: 6px;
}

.recent-show-more {
  margin-top: 8px;
  width: 100%;
  border-radius: 7px;
  border: 1px solid hsl(var(--border) / 0.65);
  background: hsl(var(--background) / 0.15);
  padding: 6px 10px;
  text-align: center;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.recent-show-more:hover {
  background: hsl(var(--muted) / 0.55);
  color: hsl(var(--foreground));
}

.recent-session-row:hover {
  background: hsl(var(--muted) / 0.65);
}

.recent-mode-button {
  display: flex;
  min-height: 88px;
  align-items: flex-start;
  gap: 12px;
  border-radius: 9px;
  border: 1px solid hsl(var(--border) / 0.7);
  background: hsl(var(--background) / 0.25);
  padding: 14px;
  text-align: left;
  color: hsl(var(--foreground));
}

.recent-mode-button:hover,
.recent-mode-button-active {
  border-color: hsl(var(--primary) / 0.55);
  background: hsl(var(--primary) / 0.12);
}

.recent-mode-icon {
  display: inline-flex;
  height: 34px;
  width: 34px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.recent-mode-glyph {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.recent-mode-icon-primary {
  background: hsl(var(--primary) / 0.14);
  color: hsl(var(--primary));
}

.recent-mode-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.recent-mode-text {
  display: block;
  margin-top: 2px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

</style>
