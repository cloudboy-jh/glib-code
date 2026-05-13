<template>
  <aside class="rounded-xl border border-border/80 bg-card/75 p-3">
    <div class="mb-3 flex items-center justify-between gap-3">
      <div>
        <div class="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Hunk context</div>
        <div class="mt-0.5 text-[11px] text-muted-foreground">{{ hunks.length }} hunks · {{ selectedCount }} selected</div>
      </div>
      <button
        type="button"
        class="h-7 rounded border border-border/70 px-2 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
        :disabled="!hunks.length"
        @click="$emit('toggle-all')"
      >
        {{ allSelected ? 'Clear file' : 'Select file' }}
      </button>
    </div>

    <div v-if="loading" class="rounded-lg border border-border/70 bg-background/45 px-3 py-4 text-xs text-muted-foreground">Loading hunks…</div>
    <div v-else-if="error" class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-4 text-xs text-destructive">{{ error }}</div>
    <div v-else-if="!hunks.length" class="rounded-lg border border-border/70 bg-background/45 px-3 py-4 text-xs text-muted-foreground">No hunks for this file.</div>

    <div v-else class="max-h-[420px] space-y-1 overflow-auto pr-1">
      <button
        v-for="h in hunks"
        :key="h.id"
        type="button"
        :class="[
          'flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
          selectedIds.has(h.id)
            ? 'border-primary/50 bg-primary/12 text-primary'
            : 'border-border/70 bg-background/45 text-foreground hover:bg-muted/55'
        ]"
        @click="$emit('toggle', h.id)"
      >
        <span class="mt-0.5 inline-grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px]" :class="selectedIds.has(h.id) ? 'border-primary/70 bg-primary/20' : 'border-border/80'">
          {{ selectedIds.has(h.id) ? '✓' : '' }}
        </span>
        <span class="min-w-0">
          <span class="block truncate font-mono text-[11px]">{{ h.header }}</span>
          <span class="mt-1 block text-[10px] text-muted-foreground">patch line {{ h.startLine }}</span>
        </span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  hunks: Array<{ id: string; header: string; startLine: number }>;
  selectedIds: Set<string>;
  loading?: boolean;
  error?: string;
}>();

defineEmits<{ toggle: [id: string]; 'toggle-all': [] }>();

const selectedCount = computed(() => props.hunks.filter((hunk) => props.selectedIds.has(hunk.id)).length);
const allSelected = computed(() => props.hunks.length > 0 && selectedCount.value === props.hunks.length);
</script>
