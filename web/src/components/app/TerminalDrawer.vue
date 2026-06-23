<template>
  <div class="fixed inset-x-0 bottom-0 z-40 flex flex-col border-t border-border/90 bg-card/95" style="height: 38vh; min-height: 240px; max-height: 420px;">
    <!-- Header -->
    <div class="flex shrink-0 items-center gap-2 px-4 pt-2 pb-1.5">
      <span
        class="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        :class="connectionDotClass"
        :aria-label="connectionLabel"
        :title="connectionLabel"
      />
      <strong class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground" title="Runs shell commands in the active project. Not an interactive shell.">Command runner</strong>
      <span v-if="projectLabel" class="terminal truncate text-[11px] text-muted-foreground/70">{{ projectLabel }}</span>
      <span class="ml-auto" />
      <button
        class="h-7 rounded-md border border-border/80 bg-background/55 px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
        :disabled="!canClear"
        @click="emit('clear')"
      >
        Clear
      </button>
      <button
        class="h-7 rounded-md border border-border/80 bg-background/55 px-2 text-xs text-muted-foreground hover:text-foreground"
        @click="emit('close')"
      >
        Close
      </button>
    </div>

    <!-- Transcript -->
    <div
      ref="transcriptRef"
      class="terminal min-h-0 flex-1 overflow-y-auto px-4 py-1 text-[12px]"
      role="log"
      aria-live="polite"
      aria-label="Command output"
      @scroll="onTranscriptScroll"
    >
      <div v-if="entries.length === 0" class="py-6 text-center text-[12px] text-muted-foreground/50">
        No commands run yet.
      </div>
      <div v-for="entry in entries" :key="entry.id" class="term-entry mb-3">
        <div class="flex items-center gap-1.5">
          <span class="shrink-0 text-muted-foreground/60">$</span>
          <span class="break-all text-foreground/90">{{ entry.command }}</span>
          <span class="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] font-medium" :class="entryChipClass(entry)">
            <span v-if="entry.status === 'running'" class="term-dot-pulse inline-block h-1 w-1 rounded-full bg-amber-400" />
            {{ entryChipLabel(entry) }}
          </span>
        </div>
        <div v-if="entry.chunks.length > 0" class="mt-0.5 whitespace-pre-wrap break-words text-[12px] leading-[1.5]">
          <span v-for="(chunk, i) in entry.chunks" :key="i" :class="chunk.stream === 'stderr' ? 'text-red-300/90' : 'text-foreground/95'">{{ chunk.text }}</span>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="shrink-0 px-4 py-1 text-[11px] text-red-300/90">
      {{ error }}
    </div>

    <!-- Composer -->
    <div class="shrink-0 px-4 pb-3 pt-1.5">
      <div class="flex items-start gap-2">
        <span class="terminal pt-[5px] text-[12px] text-muted-foreground/50">$</span>
        <textarea
          ref="textareaRef"
          :value="input"
          rows="1"
          :disabled="composerDisabled"
          class="terminal min-h-[28px] w-full resize-none rounded-md border border-input/80 bg-[hsl(var(--bg-sunken))]/80 px-2 py-1 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          :placeholder="placeholder"
          aria-label="Command input"
          @input="emit('update:input', ($event.target as HTMLTextAreaElement).value)"
          @keydown="onKeyDown"
        />
        <button
          v-if="!isRunning"
          :disabled="!canRun"
          class="h-7 shrink-0 rounded-md border border-border/80 bg-primary/90 px-4 text-xs font-semibold text-primary-foreground disabled:opacity-45"
          @click="emit('run')"
        >
          Run
        </button>
        <button
          v-else
          class="h-7 shrink-0 rounded-md border border-red-500/50 bg-red-600/70 px-4 text-xs font-semibold text-red-50 hover:bg-red-600/90"
          @click="emit('cancel')"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';

interface TerminalChunk {
  text: string;
  stream: 'stdout' | 'stderr';
}

interface TerminalEntry {
  id: string;
  command: string;
  chunks: TerminalChunk[];
  exitCode: number | null;
  status: 'running' | 'done' | 'error';
}

const props = defineProps<{
  entries: TerminalEntry[];
  input: string;
  status: 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error' | 'unavailable';
  error?: string;
  projectLabel: string | null;
  runningId: string | null;
  history: string[];
  historyIndex: number;
}>();

const emit = defineEmits<{
  close: [];
  run: [];
  cancel: [];
  clear: [];
  'update:input': [value: string];
  'navigate-history': [direction: 'prev' | 'next'];
}>();

const transcriptRef = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const stickToBottom = ref(true);

const canRun = computed(() => props.status === 'open' && props.projectLabel !== null && !props.runningId);
const isRunning = computed(() => props.runningId !== null);
const canClear = computed(() => props.entries.length > 0);
const composerDisabled = computed(() => props.status !== 'open' || props.projectLabel === null);

const placeholder = computed(() => {
  if (props.status === 'connecting' || props.status === 'reconnecting') return 'connecting\u2026';
  if (props.status === 'closed' || props.status === 'error' || props.status === 'unavailable') return 'disconnected';
  if (!props.projectLabel) return 'open a project to run commands';
  if (props.isRunning) return 'command running\u2026';
  return `run a command in ${props.projectLabel}`;
});

const connectionDotClass = computed(() => {
  if (props.status === 'open') return 'bg-emerald-400';
  if (props.status === 'connecting' || props.status === 'reconnecting') return 'bg-amber-400 term-dot-pulse';
  if (props.status === 'error' || props.status === 'unavailable') return 'bg-red-400';
  return 'bg-muted-foreground/40';
});

const connectionLabel = computed(() => {
  const map: Record<string, string> = {
    open: 'Connected',
    connecting: 'Connecting\u2026',
    reconnecting: 'Reconnecting\u2026',
    closed: 'Disconnected',
    error: 'Connection error',
    unavailable: 'Unavailable'
  };
  return map[props.status] ?? props.status;
});

function entryChipClass(entry: TerminalEntry): string {
  if (entry.status === 'running') return 'text-amber-300';
  if (entry.status === 'done') return 'text-emerald-300';
  return 'text-red-300';
}

function entryChipLabel(entry: TerminalEntry): string {
  if (entry.status === 'running') return 'running';
  if (entry.status === 'done') return 'exit 0';
  if (entry.exitCode !== null) return `exit ${entry.exitCode}`;
  return 'error';
}

function onTranscriptScroll() {
  const el = transcriptRef.value;
  if (!el) return;
  stickToBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
}

function autoGrow() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 96) + 'px';
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    if (canRun.value) emit('run');
    return;
  }
  if (props.input.indexOf('\n') === -1) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      emit('navigate-history', 'prev');
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      emit('navigate-history', 'next');
      return;
    }
  }
}

watch(() => props.input, () => nextTick(autoGrow));

watch(() => props.entries, () => {
  if (stickToBottom.value) {
    nextTick(() => {
      const el = transcriptRef.value;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}, { deep: true });

onMounted(() => {
  textareaRef.value?.focus();
  autoGrow();
});
</script>
