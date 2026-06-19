<template>
  <aside class="flex h-full min-h-0 flex-col bg-card/95 text-foreground">
    <div class="flex h-full min-h-0 flex-col px-3 py-3">

      <!-- Header: wordmark left, close toggle right -->
      <div class="relative flex h-9 items-center justify-center">
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center justify-center rounded-lg px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground">
            <div
              v-if="logoWordmarkSrc"
              class="logo-wordmark h-5 w-[146px] shrink-0"
              :style="{ '--logo-url': `url(${logoWordmarkSrc})` }"
              role="img"
              aria-label="glib-code"
            />
            <div v-else class="truncate text-sm font-medium tracking-tight text-foreground">glib-code</div>
          </div>
        </div>
        <button
          type="button"
          class="absolute right-0 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close sidebar"
          @click="$emit('toggleCollapse')"
        >
          <PanelLeftClose class="sidebar-icon" />
        </button>
      </div>

      <!-- Search -->
      <button
        type="button"
        :disabled="disabled"
        class="mt-3 mb-3 flex h-9 items-center gap-2 rounded-lg border border-border/80 bg-background/70 px-2.5 text-left text-xs text-muted-foreground shadow-sm/5 transition-colors hover:bg-accent/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        @click="$emit('openSearch')"
      >
        <Search class="sidebar-icon" />
        <span class="flex-1">Search sessions</span>
        <span class="rounded-md border border-border/70 bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</span>
      </button>

      <!-- Session list -->
      <div class="min-h-0 flex-1 overflow-auto">
        <div v-if="sortedSessions.length === 0" class="px-2 py-1 text-xs text-muted-foreground/75">No sessions yet</div>
        <div class="mb-2.5 mt-1 space-y-3">
          <div v-if="currentProjectSessions.length" class="space-y-1">
            <div class="px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
              Current project
              <span class="ml-1 normal-case tracking-normal text-muted-foreground/55">/ {{ currentProjectLabel }}</span>
            </div>
            <div
              v-for="s in visibleCurrentProjectSessions"
              :key="s.id"
              :class="[
                'group flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors',
                s.id === activeId ? 'bg-accent text-foreground shadow-sm/5' : 'text-foreground/92 hover:bg-accent/70'
              ]"
            >
              <button type="button" :disabled="disabled" class="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50" @click="$emit('select', s.id)">
                <span v-if="statusDotClass(s.status)" class="h-2 w-2 shrink-0 rounded-full" :class="statusDotClass(s.status)" />
                <span class="min-w-0 flex-1 truncate text-[13px] leading-none">{{ s.title }}</span>
                <span class="shrink-0 text-[11px] text-muted-foreground/70">{{ s.time }}</span>
              </button>
              <div class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <button type="button" :disabled="disabled" class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-background/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50" title="Rename session" @click.stop="$emit('rename', s.id)">
                  <Pencil class="h-3 w-3" />
                </button>
                <button type="button" :disabled="disabled" class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-background/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50" title="Export session" @click.stop="$emit('export', s.id)">
                  <Download class="h-3 w-3" />
                </button>
                <button type="button" :disabled="disabled" class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50" title="Delete session" @click.stop="$emit('delete', s.id)">
                  <Trash2 class="h-3 w-3" />
                </button>
              </div>
            </div>
            <button
              v-if="currentProjectSessions.length > expandedGroupSessionLimit"
              type="button"
              class="ml-2 rounded px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              @click="showAllCurrentProject = !showAllCurrentProject"
            >
              {{ showAllCurrentProject ? 'Show less' : `Show ${currentProjectSessions.length - expandedGroupSessionLimit} more` }}
            </button>
          </div>

          <div v-if="otherProjectGroups.length" class="space-y-1">
            <div class="px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/65">Other projects</div>
            <div v-for="group in otherProjectGroups" :key="group.key" class="rounded-md border border-border/60 bg-background/15">
              <button
                type="button"
                class="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                @click="toggleExpandedGroup(group.key)"
              >
                <span class="truncate">{{ group.project }}</span>
                <span class="ml-2 shrink-0 text-[10px] text-muted-foreground/80">{{ expandedOpenGroups.has(group.key) ? 'Hide' : `${group.sessions.length}` }}</span>
              </button>
              <div v-if="expandedOpenGroups.has(group.key)" class="space-y-1 px-1.5 pb-1.5">
                <div
                  v-for="s in visibleOtherGroupSessions(group)"
                  :key="s.id"
                  :class="[
                    'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                    s.id === activeId ? 'bg-accent text-foreground shadow-sm/5' : 'text-foreground/92 hover:bg-accent/70'
                  ]"
                >
                  <button type="button" :disabled="disabled" class="flex min-w-0 flex-1 items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50" @click="$emit('select', s.id)">
                    <span v-if="statusDotClass(s.status)" class="h-2 w-2 shrink-0 rounded-full" :class="statusDotClass(s.status)" />
                    <span class="min-w-0 flex-1 truncate text-[13px] leading-none">{{ s.title }}</span>
                    <span class="shrink-0 text-[11px] text-muted-foreground/70">{{ s.time }}</span>
                  </button>
                  <div class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <button type="button" :disabled="disabled" class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-background/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50" title="Rename session" @click.stop="$emit('rename', s.id)">
                      <Pencil class="h-3 w-3" />
                    </button>
                    <button type="button" :disabled="disabled" class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-background/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50" title="Export session" @click.stop="$emit('export', s.id)">
                      <Download class="h-3 w-3" />
                    </button>
                    <button type="button" :disabled="disabled" class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50" title="Delete session" @click.stop="$emit('delete', s.id)">
                      <Trash2 class="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <button
                  v-if="group.sessions.length > expandedGroupSessionLimit"
                  type="button"
                  class="ml-1 rounded px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  @click="toggleShowAllOtherGroup(group.key)"
                >
                  {{ showAllOtherGroupKeys.has(group.key) ? 'Show less' : `Show ${group.sessions.length - expandedGroupSessionLimit} more` }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-auto shrink-0 border-t border-border/70 pt-2">
        <button
          type="button"
          class="mb-0.5 flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground/75 transition-colors hover:bg-accent hover:text-foreground"
          @click="$emit('goHome')"
        >
          <House class="sidebar-icon" />
          Home
        </button>
        <button
          type="button"
          :disabled="disabled || newDisabled"
          class="mb-0.5 flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground/75 transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-accent hover:text-foreground"
          @click="$emit('new')"
        >
          <Plus class="sidebar-icon" />
          New session
        </button>
        <button
          type="button"
          class="flex h-9 w-full items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground/75 transition-colors hover:bg-accent hover:text-foreground"
          @click="$emit('openSettings')"
        >
          <Settings2 class="sidebar-icon" />
          Settings
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { House, Plus, Search, Settings2, Pencil, Download, Trash2, PanelLeftClose } from 'lucide-vue-next';

type SessionRow = {
  id: string;
  title: string;
  time: string;
  updatedAt?: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'stale' | 'running' | 'done';
  repo: string;
  project: string;
  projectPath: string;
};

const props = withDefaults(
  defineProps<{
    sessions: SessionRow[];
    activeId: string;
    currentProjectPath?: string;
    currentProjectName?: string;
    logoWordmarkSrc?: string;
    logoIconSrc?: string;
    disabled?: boolean;
    newDisabled?: boolean;
  }>(),
  { disabled: false, newDisabled: false }
);

defineEmits<{ select: [id: string]; new: []; openSettings: []; toggleCollapse: []; goHome: []; delete: [id: string]; export: [id: string]; rename: [id: string]; openSearch: [] }>();

const expandedOpenGroups = ref(new Set<string>());
const showAllOtherGroupKeys = ref(new Set<string>());
const showAllCurrentProject = ref(false);
const expandedGroupSessionLimit = 5;

const sortedSessions = computed(() =>
  [...props.sessions].sort((a, b) => toEpoch(b.updatedAt) - toEpoch(a.updatedAt))
);

const groupedExpandedSessions = computed(() => {
  const grouped = new Map<string, { key: string; repo: string; project: string; sessions: SessionRow[]; newest: number }>();
  for (const session of sortedSessions.value) {
    const key = `${session.repo}::${session.project}::${session.projectPath}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.sessions.push(session);
      existing.newest = Math.max(existing.newest, toEpoch(session.updatedAt));
      continue;
    }
    grouped.set(key, { key, repo: session.repo || 'repo', project: session.project || 'project', sessions: [session], newest: toEpoch(session.updatedAt) });
  }
  return [...grouped.values()].sort((a, b) => b.newest - a.newest);
});

const canonicalCurrentProjectPath = computed(() => canonicalizePath(props.currentProjectPath ?? ''));

const currentProjectSessions = computed(() => {
  if (!canonicalCurrentProjectPath.value) return [] as SessionRow[];
  return sortedSessions.value.filter((s) => canonicalizePath(s.projectPath) === canonicalCurrentProjectPath.value);
});

const otherProjectGroups = computed(() => {
  if (!canonicalCurrentProjectPath.value) return groupedExpandedSessions.value;
  return groupedExpandedSessions.value.filter((g) => canonicalizePath(g.sessions[0]?.projectPath ?? '') !== canonicalCurrentProjectPath.value);
});

const currentProjectLabel = computed(() => props.currentProjectName || props.currentProjectPath || 'project');

const visibleCurrentProjectSessions = computed(() =>
  showAllCurrentProject.value ? currentProjectSessions.value : currentProjectSessions.value.slice(0, expandedGroupSessionLimit)
);

function toggleExpandedGroup(key: string) {
  const next = new Set(expandedOpenGroups.value);
  if (next.has(key)) next.delete(key); else next.add(key);
  expandedOpenGroups.value = next;
}

function visibleOtherGroupSessions(group: { key: string; sessions: SessionRow[] }) {
  return showAllOtherGroupKeys.value.has(group.key) ? group.sessions : group.sessions.slice(0, expandedGroupSessionLimit);
}

function toggleShowAllOtherGroup(key: string) {
  const next = new Set(showAllOtherGroupKeys.value);
  if (next.has(key)) next.delete(key); else next.add(key);
  showAllOtherGroupKeys.value = next;
}

function canonicalizePath(path: string) {
  const s = path.replace(/\\/g, '/').trim().replace(/\/+$/g, '');
  const hasDrive = /^[A-Za-z]:\//.test(s);
  return (hasDrive ? `${s[0].toLowerCase()}${s.slice(1)}` : s).toLowerCase();
}

function statusDotClass(status: SessionRow['status']) {
  if (status === 'stale') return 'bg-amber-400';
  if (status === 'running') return 'bg-sky-400';
  if (status === 'connecting') return 'bg-violet-400';
  if (status === 'done' || status === 'disconnected') return 'bg-zinc-500';
  return '';
}

function toEpoch(value?: string) {
  if (!value) return 0;
  const p = Date.parse(value);
  return Number.isFinite(p) ? p : 0;
}
</script>

<style scoped>
.logo-wordmark,
.logo-icon {
  background-color: hsl(var(--primary));
  -webkit-mask-image: var(--logo-url);
  mask-image: var(--logo-url);
  -webkit-mask-mode: luminance;
  mask-mode: luminance;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.sidebar-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2.2;
}
</style>
