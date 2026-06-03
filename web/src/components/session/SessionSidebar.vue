<template>
  <aside class="flex h-full min-h-0 flex-col bg-card/95 text-foreground">
    <div :class="['flex h-full min-h-0 flex-col', collapsed ? 'px-2 py-3' : 'px-3 py-3']">
      <div class="relative flex h-9 items-center justify-center">
        <div v-if="!collapsed" class="min-w-0">
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

        <div v-else class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground" aria-label="glib-code">
          <div v-if="logoIconSrc" class="logo-icon h-5 w-5" :style="{ '--logo-url': `url(${logoIconSrc})` }" role="img" aria-label="glib-code icon" />
          <span v-else class="text-base font-semibold leading-none">g</span>
        </div>

        <button
          type="button"
          :class="['inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground', 'absolute right-0 h-8 w-8']"
          @click="$emit('toggleCollapse')"
        >
          {{ collapsed ? '›' : '‹' }}
        </button>
      </div>

      <button
        v-if="!collapsed"
        type="button"
        :disabled="disabled"
        class="mt-3 mb-3 flex h-9 items-center gap-2 rounded-lg border border-border/80 bg-background/70 px-2.5 text-left text-xs text-muted-foreground shadow-sm/5 transition-colors hover:bg-accent/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Search class="sidebar-icon" />
        <span class="flex-1">Search sessions</span>
        <span class="rounded-md border border-border/70 bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</span>
      </button>

      <div v-else class="mt-3 mb-3 flex justify-center">
        <button
          type="button"
          :disabled="disabled"
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-background/70 text-muted-foreground/80 shadow-sm/5 transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search class="sidebar-icon" />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-auto">
        <template v-if="collapsed">
          <div ref="collapsedRailRef" class="relative space-y-1">
            <button
              v-for="s in collapsedVisibleSessions"
              :key="s.id"
              type="button"
              :disabled="disabled"
              :title="`${s.title} • ${s.time} • ${s.status}`"
              :aria-label="`${s.title}, ${s.status}, ${s.time}`"
              :class="[
                'mx-auto flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                s.id === activeId ? 'bg-accent/80 text-foreground' : 'text-foreground/80 hover:bg-accent/60'
              ]"
              @click="$emit('select', s.id)"
            >
              <span class="h-2.5 w-2.5 rounded-full" :class="statusDotClass(s.status)" />
            </button>

            <button
              v-if="collapsedOverflowCount > 0"
              type="button"
              :class="[
                'mx-auto flex h-8 w-8 items-center justify-center rounded-md border border-border/70 text-[10px] font-semibold transition-colors',
                collapsedOverflowOpen ? 'bg-accent/80 text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              ]"
              :aria-expanded="collapsedOverflowOpen"
              :aria-label="`Show ${collapsedOverflowCount} more sessions`"
              :title="`Show ${collapsedOverflowCount} more sessions`"
              @click="collapsedOverflowOpen = !collapsedOverflowOpen"
            >
              +{{ collapsedOverflowCount }}
            </button>

            <div
              v-if="collapsedOverflowOpen"
              class="absolute left-[calc(100%+8px)] top-24 z-30 w-[260px] overflow-hidden rounded-lg border border-border/80 bg-card/95 shadow-xl shadow-black/30"
            >
              <div class="border-b border-border/70 px-2 py-2">
                <input
                  ref="overflowSearchRef"
                  v-model="collapsedOverflowQuery"
                  type="text"
                  placeholder="Search sessions"
                  class="h-8 w-full rounded-md border border-border/70 bg-background/60 px-2 text-[12px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none"
                  @keydown="onOverflowSearchKeydown"
                />
              </div>
              <div class="max-h-[360px] overflow-auto p-1" @keydown="onOverflowListKeydown">
                <div v-if="filteredCollapsedOverflowSessions.length === 0" class="px-2 py-2 text-[11px] text-muted-foreground/80">No matching sessions</div>
                <button
                  v-for="(s, index) in filteredCollapsedOverflowSessions"
                  :key="`overflow-${s.id}`"
                  type="button"
                  :data-overflow-index="index"
                  :class="[
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors',
                    index === collapsedOverflowActiveIndex ? 'bg-accent text-foreground' : 'text-foreground/90 hover:bg-accent/60'
                  ]"
                  @mouseenter="collapsedOverflowActiveIndex = index"
                  @click="selectCollapsedOverflowSession(s.id)"
                >
                  <span class="h-2 w-2 shrink-0 rounded-full" :class="statusDotClass(s.status)" />
                  <span class="min-w-0 flex-1 truncate">{{ s.title }}</span>
                  <span class="shrink-0 text-[10px] text-muted-foreground/70">{{ s.time }}</span>
                </button>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
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
        </template>
      </div>

      <div class="mt-auto shrink-0 border-t border-border/70 pt-2">
        <button
          type="button"
          :class="[
            'flex items-center rounded-lg text-sm transition-colors',
            collapsed ? 'mx-auto mb-0.5 h-9 w-9 justify-center text-muted-foreground/70 hover:bg-accent hover:text-foreground' : 'mb-0.5 h-9 w-full gap-2 px-3 text-muted-foreground/75 hover:bg-accent hover:text-foreground'
          ]"
          @click="$emit('goHome')"
        >
          <House class="sidebar-icon" />
          <span v-if="!collapsed">Home</span>
        </button>
        <button
          type="button"
          :disabled="disabled || newDisabled"
          :class="[
            'flex items-center rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            collapsed ? 'mx-auto h-9 w-9 justify-center text-muted-foreground/70 hover:bg-accent hover:text-foreground' : 'mb-0.5 h-9 w-full gap-2 px-3 text-muted-foreground/75 hover:bg-accent hover:text-foreground'
          ]"
          @click="$emit('new')"
        >
          <Plus class="sidebar-icon" />
          <span v-if="!collapsed">New session</span>
        </button>
        <button
          type="button"
          :class="[
            'flex items-center rounded-lg text-sm transition-colors',
            collapsed ? 'mx-auto h-9 w-9 justify-center text-muted-foreground/70 hover:bg-accent hover:text-foreground' : 'h-9 w-full gap-2 px-3 text-muted-foreground/75 hover:bg-accent hover:text-foreground'
          ]"
          @click="$emit('openSettings')"
        >
          <Settings2 class="sidebar-icon" />
          <span v-if="!collapsed">Settings</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { House, Plus, Search, Settings2, Pencil, Download, Trash2 } from 'lucide-vue-next';

type SessionRow = {
  id: string;
  title: string;
  time: string;
  updatedAt?: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'stale' | 'running';
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
    collapsed?: boolean;
    logoWordmarkSrc?: string;
    logoIconSrc?: string;
    disabled?: boolean;
    newDisabled?: boolean;
  }>(),
  { collapsed: false, disabled: false, newDisabled: false }
);

const emit = defineEmits<{ select: [id: string]; new: []; openSettings: []; toggleCollapse: []; goHome: []; delete: [id: string]; export: [id: string]; rename: [id: string] }>();

const collapsedOverflowOpen = ref(false);
const collapsedRailRef = ref<HTMLElement | null>(null);
const overflowSearchRef = ref<HTMLInputElement | null>(null);
const collapsedOverflowQuery = ref('');
const collapsedOverflowActiveIndex = ref(0);
const expandedOpenGroups = ref(new Set<string>());
const showAllOtherGroupKeys = ref(new Set<string>());
const showAllCurrentProject = ref(false);

const collapsedSessionLimit = 4;
const expandedGroupSessionLimit = 5;

const sortedSessions = computed(() => {
  return [...props.sessions].sort((a, b) => toEpoch(b.updatedAt) - toEpoch(a.updatedAt));
});

const collapsedVisibleSessions = computed(() => {
  const active = sortedSessions.value.find((session) => session.id === props.activeId);
  const list: SessionRow[] = [];
  if (active) list.push(active);
  for (const session of sortedSessions.value) {
    if (list.find((entry) => entry.id === session.id)) continue;
    list.push(session);
    if (list.length >= collapsedSessionLimit) break;
  }
  return list;
});

const collapsedOverflowSessions = computed(() => {
  const visibleIds = new Set(collapsedVisibleSessions.value.map((session) => session.id));
  return sortedSessions.value.filter((session) => !visibleIds.has(session.id));
});

const filteredCollapsedOverflowSessions = computed(() => {
  const query = collapsedOverflowQuery.value.trim().toLowerCase();
  if (!query) return collapsedOverflowSessions.value;
  return collapsedOverflowSessions.value.filter((session) => {
    const haystack = `${session.title} ${session.project} ${session.repo} ${session.time}`.toLowerCase();
    return haystack.includes(query);
  });
});

const collapsedOverflowCount = computed(() => collapsedOverflowSessions.value.length);

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
    grouped.set(key, {
      key,
      repo: session.repo || 'repo',
      project: session.project || 'project',
      sessions: [session],
      newest: toEpoch(session.updatedAt)
    });
  }
  return [...grouped.values()].sort((a, b) => b.newest - a.newest);
});

const canonicalCurrentProjectPath = computed(() => canonicalizePath(props.currentProjectPath ?? ''));

const currentProjectSessions = computed(() => {
  if (!canonicalCurrentProjectPath.value) return [] as SessionRow[];
  return sortedSessions.value.filter((session) => canonicalizePath(session.projectPath) === canonicalCurrentProjectPath.value);
});

const otherProjectGroups = computed(() => {
  if (!canonicalCurrentProjectPath.value) return groupedExpandedSessions.value;
  return groupedExpandedSessions.value.filter((group) => canonicalizePath(group.sessions[0]?.projectPath ?? '') !== canonicalCurrentProjectPath.value);
});

const currentProjectLabel = computed(() => props.currentProjectName || props.currentProjectPath || 'project');

const visibleCurrentProjectSessions = computed(() => {
  if (showAllCurrentProject.value) return currentProjectSessions.value;
  return currentProjectSessions.value.slice(0, expandedGroupSessionLimit);
});

function toggleExpandedGroup(groupKey: string) {
  const next = new Set(expandedOpenGroups.value);
  if (next.has(groupKey)) next.delete(groupKey);
  else next.add(groupKey);
  expandedOpenGroups.value = next;
}

function visibleOtherGroupSessions(group: { key: string; sessions: SessionRow[] }) {
  if (showAllOtherGroupKeys.value.has(group.key)) return group.sessions;
  return group.sessions.slice(0, expandedGroupSessionLimit);
}

function toggleShowAllOtherGroup(groupKey: string) {
  const next = new Set(showAllOtherGroupKeys.value);
  if (next.has(groupKey)) next.delete(groupKey);
  else next.add(groupKey);
  showAllOtherGroupKeys.value = next;
}

function canonicalizePath(path: string) {
  const slashNormalized = path.replace(/\\/g, '/').trim();
  const withoutTrailing = slashNormalized.replace(/\/+$/g, '');
  const maybeDrive = /^[A-Za-z]:\//.test(withoutTrailing);
  const normalizedDrive = maybeDrive ? `${withoutTrailing[0].toLowerCase()}${withoutTrailing.slice(1)}` : withoutTrailing;
  return normalizedDrive.toLowerCase();
}

function selectCollapsedOverflowSession(sessionId: string) {
  collapsedOverflowOpen.value = false;
  emit('select', sessionId);
}

function moveOverflowSelection(delta: number) {
  if (!filteredCollapsedOverflowSessions.value.length) return;
  const max = filteredCollapsedOverflowSessions.value.length - 1;
  const next = Math.max(0, Math.min(max, collapsedOverflowActiveIndex.value + delta));
  collapsedOverflowActiveIndex.value = next;
  void nextTick(() => {
    const root = collapsedRailRef.value;
    if (!root) return;
    const button = root.querySelector<HTMLButtonElement>(`button[data-overflow-index="${next}"]`);
    button?.scrollIntoView({ block: 'nearest' });
  });
}

function selectOverflowActive() {
  const session = filteredCollapsedOverflowSessions.value[collapsedOverflowActiveIndex.value];
  if (!session) return;
  selectCollapsedOverflowSession(session.id);
}

function onOverflowSearchKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key.toLowerCase() === 'j') {
    event.preventDefault();
    moveOverflowSelection(1);
    return;
  }
  if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'k') {
    event.preventDefault();
    moveOverflowSelection(-1);
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    selectOverflowActive();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    collapsedOverflowOpen.value = false;
  }
}

function onOverflowListKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key.toLowerCase() === 'j') {
    event.preventDefault();
    moveOverflowSelection(1);
    return;
  }
  if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'k') {
    event.preventDefault();
    moveOverflowSelection(-1);
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    selectOverflowActive();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    collapsedOverflowOpen.value = false;
  }
}

function statusDotClass(status: SessionRow['status']) {
  if (status === 'stale') return 'bg-amber-400';
  if (status === 'running') return 'bg-sky-400';
  if (status === 'connecting') return 'bg-violet-400';
  if (status === 'disconnected') return 'bg-zinc-500';
  return '';
}

function toEpoch(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function onWindowPointerDown(event: MouseEvent) {
  if (!collapsedOverflowOpen.value) return;
  const root = collapsedRailRef.value;
  if (!root) return;
  if (!(event.target instanceof Node)) return;
  if (!root.contains(event.target)) collapsedOverflowOpen.value = false;
}

onMounted(() => window.addEventListener('mousedown', onWindowPointerDown));
onUnmounted(() => window.removeEventListener('mousedown', onWindowPointerDown));

watch(collapsedOverflowOpen, async (open) => {
  if (!open) return;
  collapsedOverflowQuery.value = '';
  collapsedOverflowActiveIndex.value = 0;
  await nextTick();
  overflowSearchRef.value?.focus();
});

watch(filteredCollapsedOverflowSessions, (list) => {
  if (!list.length) {
    collapsedOverflowActiveIndex.value = 0;
    return;
  }
  if (collapsedOverflowActiveIndex.value > list.length - 1) {
    collapsedOverflowActiveIndex.value = list.length - 1;
  }
});
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
