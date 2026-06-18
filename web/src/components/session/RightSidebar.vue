<template>
  <aside class="flex h-full min-h-0 flex-col bg-card/95 text-foreground">
    <div :class="['flex h-full min-h-0 flex-col', collapsed ? 'px-2 py-3' : 'px-3 py-3']">

      <!-- Expanded header: toggle left, label fills -->
      <div v-if="!collapsed" class="relative flex h-9 items-center justify-center">
        <span class="min-w-0 flex-1 truncate pl-8 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
          Workspace
        </span>
        <button
          type="button"
          class="absolute left-0 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Collapse workspace panel"
          @click="$emit('toggleCollapse')"
        >
          <PanelRightClose class="rail-icon" />
        </button>
      </div>

      <!-- Collapsed header: toggle only, centered -->
      <div v-else class="flex h-9 items-center justify-center">
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground/80 transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Expand workspace panel"
          @click="$emit('toggleCollapse')"
        >
          <PanelRightOpen class="rail-icon" />
        </button>
      </div>

      <!-- Scrollable content -->
      <div class="min-h-0 flex-1 overflow-auto">

        <!-- Collapsed: pending dot only -->
        <template v-if="collapsed">
          <div class="mt-3 flex flex-col items-center gap-2">
            <span
              v-if="boundary.state === 'pending'"
              class="h-2.5 w-2.5 rounded-full bg-primary/80"
              title="Ephemeral changes pending"
            />
          </div>
        </template>

        <!-- Expanded -->
        <template v-else>

          <!-- ── Agent status ── -->
          <div class="mb-3 mt-2">
            <div class="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Agent</div>

            <!-- Running -->
            <div v-if="plan.isRunning" class="space-y-1.5 px-1">
              <div class="flex items-center gap-2">
                <span class="relative flex h-2 w-2 shrink-0">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
                  <span class="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
                </span>
                <span class="text-[11px] text-sky-300/90">Running</span>
                <span v-if="elapsedLabel" class="ml-auto text-[10px] text-muted-foreground/50">{{ elapsedLabel }}</span>
              </div>
              <div v-if="plan.recentTools.length" class="flex flex-wrap gap-1">
                <span
                  v-for="(tool, i) in plan.recentTools.slice(-5)"
                  :key="`${tool}-${i}`"
                  :class="[
                    'rounded border px-1.5 py-0.5 font-mono text-[9px]',
                    i === plan.recentTools.slice(-5).length - 1
                      ? 'border-sky-500/40 bg-sky-500/10 text-sky-300/80'
                      : 'border-border/50 bg-background/40 text-muted-foreground/60'
                  ]"
                >{{ tool }}</span>
              </div>
            </div>

            <!-- Idle / done -->
            <div v-else class="space-y-1 px-1">
              <div class="flex items-center gap-2">
                <span class="h-2 w-2 shrink-0 rounded-full" :class="statusDotClass" />
                <span class="text-[11px]" :class="statusTextClass">{{ statusLabel }}</span>
              </div>
              <div v-if="plan.turnCount > 0" class="flex gap-3 text-[10px] text-muted-foreground/50">
                <span>{{ plan.turnCount }} turn{{ plan.turnCount === 1 ? '' : 's' }}</span>
                <span v-if="plan.toolCallCount > 0">{{ plan.toolCallCount }} tool call{{ plan.toolCallCount === 1 ? '' : 's' }}</span>
              </div>
            </div>
          </div>

          <!-- divider -->
          <div class="mb-3 border-t border-border/50" />

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
              <div v-else class="mt-1 text-[9px] italic text-muted-foreground/40">No pending changes</div>
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
              <div v-else class="mt-1 text-[9px] italic text-muted-foreground/40">{{ boundary.baselineSha ? 'Current baseline' : 'No baseline yet' }}</div>
            </div>
          </div>

        </template>
      </div>
      <!-- No footer needed for right rail -->
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import { ArrowDown, FileCode, PanelRightClose, PanelRightOpen } from 'lucide-vue-next';
import { useElapsed } from '../../composables/useElapsed';
import type { BoundaryData, PlanData } from '../../composables/useBoundary';

const FILE_LIMIT = 8;

const props = defineProps<{
  collapsed: boolean;
  boundary: BoundaryData;
  plan: PlanData;
  discarding: boolean;
}>();

defineEmits<{ toggleCollapse: []; promote: []; discard: [] }>();

const showAllFiles = ref(false);
const turnStartedAtRef = toRef(() => props.plan.turnStartedAt ?? null);
const { label: elapsedLabel } = useElapsed(turnStartedAtRef);

const visibleFiles = computed(() =>
  showAllFiles.value ? props.boundary.touchedFiles : props.boundary.touchedFiles.slice(0, FILE_LIMIT)
);

const isPromoting = computed(() =>
  props.boundary.state === 'promoting' || props.boundary.state === 'promoted'
);

const statusDotClass = computed(() => {
  const s = props.plan.status;
  if (s === 'running') return 'bg-sky-400';
  if (s === 'error') return 'bg-red-400';
  if (s === 'aborted') return 'bg-amber-400';
  if (s === 'done') return 'bg-emerald-500/70';
  return 'bg-zinc-500/60';
});

const statusTextClass = computed(() => {
  const s = props.plan.status;
  if (s === 'error') return 'text-red-300/80';
  if (s === 'aborted') return 'text-amber-300/80';
  return 'text-muted-foreground/70';
});

const statusLabel = computed(() => {
  const s = props.plan.status;
  if (s === 'done') return 'Done';
  if (s === 'error') return 'Error';
  if (s === 'aborted') return 'Aborted';
  if (s === 'running') return 'Running';
  return 'Idle';
});

const ephemeralZoneClass = computed(() => {
  if (props.boundary.state === 'pending') return 'border-primary/25 bg-primary/5';
  if (isPromoting.value) return 'border-emerald-500/20 bg-emerald-500/5 opacity-50';
  return 'border-border/40 bg-background/20 opacity-60';
});
const ephemeralDotClass = computed(() =>
  props.boundary.state === 'pending' ? 'bg-primary/70' : 'bg-zinc-500/40'
);
const ephemeralLabelClass = computed(() =>
  props.boundary.state === 'pending' ? 'text-primary/70' : 'text-muted-foreground/40'
);

const promoteDisabled = computed(() =>
  props.boundary.state !== 'pending' || isPromoting.value
);
const promoteBtnClass = computed(() => {
  if (isPromoting.value) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400/70 cursor-default';
  if (props.boundary.state === 'pending') return 'border-primary/50 bg-primary/15 text-primary hover:bg-primary/25 hover:border-primary/70 cursor-pointer';
  return 'border-border/30 bg-transparent text-muted-foreground/30 cursor-not-allowed';
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
  props.boundary.state === 'promoted' || isPromoting.value ? 'text-emerald-400/80' : 'text-muted-foreground/50'
);
</script>

<style scoped>
.rail-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2.2;
}
</style>
