<template>
  <div class="fixed inset-x-0 bottom-0 z-40 border-t border-border/90 bg-card/95">
    <div class="mx-auto max-w-[1400px] px-4 pb-3 pt-2">
      <div class="mb-2 flex items-center gap-2">
        <strong class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Terminal</strong>
        <span class="ml-auto" />
        <button class="h-7 rounded-md border border-border/80 bg-background/55 px-2 text-xs text-muted-foreground hover:text-foreground" @click="$emit('close')">
          Close
        </button>
      </div>

      <div class="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>Status:</span>
        <span :class="statusClass">{{ statusLabel }}</span>
        <span v-if="error" class="text-red-300">· {{ error }}</span>
      </div>

      <div class="grid gap-2 md:grid-cols-[1fr_auto]">
        <textarea
          :value="input"
          rows="3"
          :disabled="!canRun"
          class="terminal min-h-[84px] w-full resize-y rounded-md border border-input/80 bg-[hsl(var(--bg-sunken))]/80 px-3 py-2 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :placeholder="canRun ? 'command...' : 'terminal unavailable'"
          @input="$emit('update:input', ($event.target as HTMLTextAreaElement).value)"
        />
        <button :disabled="!canRun" class="h-9 rounded-md border border-border/80 bg-primary/90 px-4 text-xs font-semibold text-primary-foreground disabled:opacity-45" @click="$emit('run')">Run</button>
      </div>

      <pre class="terminal mt-2 max-h-[180px] overflow-auto rounded-md border border-border/80 bg-[hsl(var(--bg-sunken))]/80 p-3 text-[12px] text-foreground/95">{{ output }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  input: string;
  output: string;
  status: 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error' | 'unavailable';
  error?: string;
}>();

defineEmits<{ close: []; run: []; 'update:input': [value: string] }>();

const canRun = computed(() => props.status === 'open');
const statusLabel = computed(() => props.status);
const statusClass = computed(() => {
  if (props.status === 'open') return 'text-emerald-300';
  if (props.status === 'error' || props.status === 'unavailable') return 'text-red-300';
  return 'text-amber-300';
});
</script>
