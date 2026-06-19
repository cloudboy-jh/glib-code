<template>
  <aside class="flex h-full min-h-0 flex-col bg-card/95 text-foreground">
    <div class="flex h-full min-h-0 flex-col px-3 py-3">

      <!-- Header: bare close toggle at left edge -->
      <div class="flex h-9 items-center">
        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close workspace panel"
          @click="$emit('toggleCollapse')"
        >
          <PanelRightClose class="rail-icon" />
        </button>
      </div>

      <!-- Scrollable content -->
      <div class="min-h-0 flex-1 overflow-auto">

        <!-- ── Session info ── -->
        <div class="mb-4">
          <div class="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Session</div>
          <div class="space-y-1 px-1">
            <div class="flex items-center gap-2 text-[11px]">
              <GitBranch class="h-3 w-3 shrink-0 text-muted-foreground/50" />
              <span class="truncate text-muted-foreground/80">{{ branch || 'unknown' }}</span>
            </div>
            <div class="flex items-center gap-2 text-[11px]">
              <span class="h-2 w-2 shrink-0 rounded-full" :class="sessionStateDotClass" />
              <span class="text-muted-foreground/80">{{ sessionStateLabel }}</span>
            </div>
            <div v-if="boundary.baselineSha" class="flex items-center gap-2 text-[11px]">
              <GitCommit class="h-3 w-3 shrink-0 text-muted-foreground/50" />
              <span class="font-mono text-muted-foreground/60">{{ boundary.baselineSha.slice(0, 7) }}</span>
            </div>
          </div>
        </div>

        <div class="mb-4 border-t border-border/50" />

        <!-- ── Empty state: session hasn't started ── -->
        <div v-if="boundary.state === 'no_workspace'" class="mb-4 px-1">
          <p class="text-[11px] leading-relaxed text-muted-foreground/70">
            The agent works in an isolated workspace. Changes appear here for review before you promote them to your repo.
          </p>
        </div>

        <!-- ── Changes / boundary ── -->
        <div class="space-y-0">
          <div class="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Changes</div>

          <!-- Ephemeral zone -->
          <div :class="['rounded-md border px-2.5 py-2 transition-all duration-250', ephemeralZoneClass]">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span :class="['h-1.5 w-1.5 rounded-full', ephemeralDotClass]" />
                <span class="text-[10px] font-semibold uppercase tracking-[0.08em]" :class="ephemeralLabelClass">Ephemeral</span>
              </div>
              <button
                v-if="boundary.state === 'pending' && !isPromoting"
                type="button"
                class="rounded px-1.5 py-0.5 text-[9px] text-muted-foreground/60 transition-colors hover:bg-destructive/15 hover:text-destructive/80 disabled:opacity-50"
                :disabled="discarding"
                @click="$emit('discard')"
              >{{ discarding ? 'Discarding…' : 'Discard' }}</button>
            </div>

            <!-- File list -->
            <div v-if="boundary.state === 'pending' && boundary.touchedFiles.length" class="mt-1.5 space-y-0.5">
              <div
                v-for="file in visibleFiles"
                :key="file"
                class="flex items-center gap-1.5 rounded px-1 py-0.5"
                :class="isPromoting ? 'opacity-30' : ''"
              >
                <FileCode class="h-2.5 w-2.5 shrink-0 text-muted-foreground/50" />
                <span class="min-w-0 flex-1 truncate font-mono text-[9px] text-muted-foreground/70" :title="file">{{ file }}</span>
              </div>
              <button
                v-if="boundary.touchedFiles.length > FILE_LIMIT"
                type="button"
                class="mt-0.5 w-full text-center text-[9px] text-muted-foreground/50 hover:text-muted-foreground/70"
                @click="showAllFiles = !showAllFiles"
              >{{ showAllFiles ? 'Show less' : `+${boundary.touchedFiles.length - FILE_LIMIT} more` }}</button>
            </div>
            <div v-else-if="isPromoting" class="mt-1 text-[9px] italic text-muted-foreground/50">Moving to durable…</div>
            <div v-else class="mt-1 text-[10px] italic text-muted-foreground/55">No pending changes</div>
          </div>

          <!-- Promote arrow -->
          <div class="flex flex-col items-center py-1.5">
            <div :class="['h-3 w-px', arrowLineClass]" />
            <button
              type="button"
              :disabled="promoteDisabled"
              :class="['inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-all duration-200', promoteBtnClass]"
              @click="$emit('promote')"
            >
              <ArrowDown class="h-2.5 w-2.5" />
              {{ promoteLabel }}
            </button>
            <div :class="['h-3 w-px', arrowLineClass]" />
          </div>

          <!-- Durable zone -->
          <div :class="['rounded-md border px-2.5 py-2 transition-all duration-250', durableZoneClass]">
            <div class="flex items-center gap-1.5">
              <span :class="['h-1.5 w-1.5 rounded-full', durableDotClass]" />
              <span class="text-[10px] font-semibold uppercase tracking-[0.08em]" :class="durableLabelClass">Durable</span>
              <span v-if="boundary.baselineSha" class="ml-auto font-mono text-[9px] text-muted-foreground/40">{{ boundary.baselineSha.slice(0, 7) }}</span>
            </div>
            <div v-if="boundary.state === 'promoted'" class="mt-1 text-[9px] text-emerald-400/80">Changes committed ✓</div>
            <div v-else class="mt-1 text-[10px] italic text-muted-foreground/55">{{ boundary.baselineSha ? 'Current baseline' : 'No baseline yet' }}</div>
          </div>

          <!-- Promote history -->
          <div v-if="boundary.promoteHistory.length" class="mt-3">
            <div class="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">Promote history</div>
            <div class="space-y-1 px-1">
              <div
                v-for="(entry, i) in boundary.promoteHistory"
                :key="`${entry.at}-${i}`"
                class="flex items-center gap-2 rounded px-1.5 py-1 text-[9px] text-muted-foreground/70"
              >
                <span class="h-1 w-1 shrink-0 rounded-full bg-emerald-400/60" />
                <span class="font-mono text-muted-foreground/50">{{ entry.toSha ? entry.toSha.slice(0, 7) : '—' }}</span>
                <span class="ml-auto text-muted-foreground/45">{{ entry.fileCount }} file{{ entry.fileCount === 1 ? '' : 's' }}</span>
                <span class="text-muted-foreground/40">{{ formatHistoryAt(entry.at) }}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Footer: quick actions -->
      <div class="mt-auto shrink-0 border-t border-border/70 pt-2">
        <div class="grid grid-cols-2 gap-1.5">
          <!-- Diff — upward popover -->
          <div ref="diffMenuRef" class="relative">
            <button
              type="button"
              class="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-border/70 bg-background/40 px-2 text-[11px] text-muted-foreground/75 transition-all hover:border-border hover:bg-accent/60 hover:text-foreground"
              @click="diffMenuOpen = !diffMenuOpen"
            >
              <GitCompare class="h-3 w-3" />
              Diffs
              <ChevronDown :class="['h-2.5 w-2.5 transition-transform', diffMenuOpen ? 'rotate-180' : '']" />
            </button>
            <div
              v-if="diffMenuOpen"
              class="absolute bottom-full left-0 right-0 z-30 mb-1 overflow-hidden rounded-lg border border-border/80 bg-card/95 shadow-lg shadow-black/30"
              @click="diffMenuOpen = false"
            >
              <button class="footer-menu-item" @click="$emit('diffCurrent')">
                <GitCompare class="h-3 w-3" />
                Session
              </button>
              <button class="footer-menu-item" @click="$emit('diffCommits')">
                <GitBranch class="h-3 w-3" />
                Repository
              </button>
            </div>
          </div>

          <button
            type="button"
            class="flex h-8 items-center justify-center gap-1.5 rounded-md border border-primary/50 bg-primary/15 px-2 text-[11px] font-medium text-primary transition-all hover:border-primary/70 hover:bg-primary/25"
            @click="$emit('promote')"
          >
            <CloudUpload class="h-3 w-3" />
            {{ shouldPush ? 'Commit + Push' : 'Commit' }}
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ArrowDown, ChevronDown, CloudUpload, FileCode, GitBranch, GitCommit, GitCompare, PanelRightClose } from 'lucide-vue-next';
import type { BoundaryData } from '../../composables/useBoundary';

const FILE_LIMIT = 8;

const props = defineProps<{
  boundary: BoundaryData;
  discarding: boolean;
  branch?: string;
  sessionStatus?: string;
  shouldPush?: boolean;
}>();

defineEmits<{ toggleCollapse: []; promote: []; discard: []; diffCurrent: []; diffCommits: [] }>();

const showAllFiles = ref(false);
const diffMenuOpen = ref(false);
const diffMenuRef = ref<HTMLDivElement | null>(null);

function onClickOutside(e: MouseEvent) {
  if (diffMenuRef.value && !diffMenuRef.value.contains(e.target as Node)) {
    diffMenuOpen.value = false;
  }
}
onMounted(() => document.addEventListener('mousedown', onClickOutside));
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside));

const visibleFiles = computed(() =>
  showAllFiles.value ? props.boundary.touchedFiles : props.boundary.touchedFiles.slice(0, FILE_LIMIT)
);

function formatHistoryAt(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const now = Date.now();
  const diff = now - t;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const isPromoting = computed(() =>
  props.boundary.state === 'promoting' || props.boundary.state === 'promoted'
);

const sessionStateDotClass = computed(() => {
  const s = props.sessionStatus;
  if (s === 'running') return 'bg-sky-400';
  if (s === 'connecting') return 'bg-violet-400';
  if (s === 'stale') return 'bg-amber-400';
  if (s === 'done') return 'bg-emerald-500/70';
  if (s === 'disconnected') return 'bg-zinc-500';
  return 'bg-zinc-500/50';
});

const sessionStateLabel = computed(() => {
  const s = props.sessionStatus;
  if (s === 'running') return 'Agent running';
  if (s === 'connecting') return 'Connecting…';
  if (s === 'stale') return 'Stream stale';
  if (s === 'done') return 'Promoted';
  if (s === 'disconnected') return 'Disconnected';
  return 'Idle';
});

const ephemeralZoneClass = computed(() => {
  if (props.boundary.state === 'pending') return 'border-primary/25 bg-primary/5';
  if (isPromoting.value) return 'border-emerald-500/20 bg-emerald-500/5 opacity-50';
  return 'border-border/40 bg-background/20 opacity-70';
});
const ephemeralDotClass = computed(() =>
  props.boundary.state === 'pending' ? 'bg-primary/70' : 'bg-zinc-500/40'
);
const ephemeralLabelClass = computed(() =>
  props.boundary.state === 'pending' ? 'text-primary/70' : 'text-muted-foreground/50'
);

const promoteDisabled = computed(() =>
  props.boundary.state !== 'pending' || isPromoting.value
);
const promoteBtnClass = computed(() => {
  if (isPromoting.value) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400/70 cursor-default';
  if (props.boundary.state === 'pending') return 'border-primary/50 bg-primary/15 text-primary hover:bg-primary/25 hover:border-primary/70 cursor-pointer';
  return 'border-border/30 bg-transparent text-muted-foreground/40 cursor-not-allowed';
});
const promoteLabel = computed(() => {
  if (props.boundary.state === 'promoting') return 'Promoting…';
  if (props.boundary.state === 'promoted') return 'Promoted';
  return 'Promote';
});
const arrowLineClass = computed(() => {
  if (props.boundary.state === 'pending') return 'bg-primary/30';
  if (isPromoting.value) return 'bg-emerald-500/30';
  return 'bg-border/30';
});

const durableZoneClass = computed(() => {
  if (props.boundary.state === 'promoted') return 'border-emerald-500/35 bg-emerald-500/8';
  if (isPromoting.value) return 'border-emerald-500/25 bg-emerald-500/5';
  return 'border-border/40 bg-background/30';
});
const durableDotClass = computed(() =>
  props.boundary.state === 'promoted' || isPromoting.value ? 'bg-emerald-400/70' : 'bg-zinc-500/60'
);
const durableLabelClass = computed(() =>
  props.boundary.state === 'promoted' || isPromoting.value ? 'text-emerald-400/80' : 'text-muted-foreground/55'
);
</script>

<style scoped>
.rail-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2.2;
}

.footer-menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 7px;
  padding: 6px 10px;
  font-size: 11px;
  color: hsl(var(--foreground));
  background: transparent;
  border: 0;
  text-align: left;
  transition: background-color 0.15s ease;
}

.footer-menu-item:hover {
  background: hsl(var(--accent) / 0.7);
}
</style>
