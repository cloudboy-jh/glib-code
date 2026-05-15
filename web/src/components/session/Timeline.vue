<template>
  <div ref="scrollerRef" class="min-h-0 flex-1 overflow-auto overflow-x-hidden px-4 py-4 sm:px-5">
    <div v-if="entries.length === 0" class="grid h-full place-items-center">
      <p class="text-sm text-muted-foreground/35">Send a message to start the conversation.</p>
    </div>

    <div v-else class="mx-auto w-full max-w-3xl space-y-3">
      <article
        v-for="e in entries"
        :key="e.id"
        class="rounded-xl border border-border/70 bg-card/60 px-4 py-3"
      >
        <div class="mb-1.5 flex items-center justify-between gap-3">
          <span class="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/90">{{ e.kind }}</span>
          <span class="shrink-0 text-[11px] text-muted-foreground/65">{{ e.time }}</span>
        </div>

        <div v-if="e.level === 'error'" class="rounded-md border border-red-500/35 bg-red-950/20 px-3 py-2 text-sm text-red-300/95">
          {{ e.text }}
        </div>
        <p v-else-if="e.text" class="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/95">{{ e.text }}</p>

        <div v-if="e.toolCalls?.length" class="mt-2 space-y-2">
          <details
            v-for="tool in e.toolCalls"
            :key="tool.id"
            class="group overflow-hidden rounded-lg border border-border/60 bg-background/45"
          >
            <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-muted/35">
              <span class="flex min-w-0 items-center gap-2">
                <span :class="['h-1.5 w-1.5 rounded-full', tool.status === 'failed' ? 'bg-red-400' : tool.status === 'done' ? 'bg-emerald-400' : 'bg-amber-300']" />
                <span class="truncate font-medium text-foreground/90">{{ tool.title }}</span>
              </span>
              <span class="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/65">
                {{ tool.status }}
              </span>
            </summary>

            <div class="border-t border-border/50 px-3 py-2">
              <div v-if="tool.command || tool.cwd" class="mb-2 space-y-1 text-[11px] text-muted-foreground">
                <div v-if="tool.command" class="truncate"><span class="text-muted-foreground/70">command</span> {{ tool.command }}</div>
                <div v-if="tool.cwd" class="truncate"><span class="text-muted-foreground/70">cwd</span> {{ tool.cwd }}</div>
              </div>
              <div v-if="tool.status === 'running'" class="text-xs text-muted-foreground">Running…</div>
              <div v-else-if="tool.renderKind === 'diff' && tool.diff" class="space-y-2">
                <div class="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Diff</div>
                <DiffView :patch="tool.diff" diff-style="unified" :theme-preset="themePreset" :theme-type="themeType" />
              </div>
              <div v-else-if="tool.preview">
                <div class="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">{{ tool.renderKind }}</div>
                <pre :class="['max-h-48 overflow-auto rounded-md p-2 text-[11px] leading-5', tool.status === 'failed' ? 'bg-red-950/20 text-red-200/90' : 'bg-black/20 text-muted-foreground']">{{ tool.preview }}</pre>
              </div>
              <details v-if="tool.rawInput || tool.rawOutput" class="mt-2 rounded-md border border-border/50 bg-black/10">
                <summary class="cursor-pointer px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">Inspect</summary>
                <div class="space-y-2 border-t border-border/50 p-2">
                  <pre v-if="tool.rawInput" class="max-h-36 overflow-auto rounded bg-black/20 p-2 text-[11px] text-muted-foreground">{{ tool.rawInput }}</pre>
                  <pre v-if="tool.rawOutput" class="max-h-48 overflow-auto rounded bg-black/20 p-2 text-[11px] text-muted-foreground">{{ tool.rawOutput }}</pre>
                </div>
              </details>
            </div>
          </details>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import type { ThemePreset } from '@glib-code/shared/theme/presets';
import DiffView from '../shared/DiffView.vue';

const props = defineProps<{
  entries: Array<{
    id: string;
    kind: string;
    text: string;
    time: string;
    level?: 'info' | 'error';
    toolCalls?: Array<{
      id: string;
      title: string;
      status: 'running' | 'done' | 'failed';
      renderKind: 'diff' | 'code' | 'json' | 'terminal' | 'text' | 'error';
      command?: string;
      cwd?: string;
      preview?: string;
      rawInput?: string;
      rawOutput?: string;
      diff?: string;
      isError?: boolean;
    }>;
  }>;
  themePreset?: ThemePreset;
  themeType?: 'dark' | 'light';
}>();

const scrollerRef = ref<HTMLDivElement | null>(null);

function isNearBottom(el: HTMLDivElement, threshold = 80) {
  return el.scrollHeight - (el.scrollTop + el.clientHeight) <= threshold;
}

async function scrollToBottom(force = false) {
  await nextTick();
  const el = scrollerRef.value;
  if (!el) return;
  if (!force && !isNearBottom(el)) return;
  el.scrollTop = el.scrollHeight;
}

watch(
  () => props.entries.map((entry) => `${entry.id}:${entry.text.length}:${entry.level ?? 'info'}:${entry.toolCalls?.map((tool) => `${tool.id}:${tool.status}:${tool.preview?.length ?? 0}:${tool.rawOutput?.length ?? 0}:${tool.diff?.length ?? 0}`).join(',') ?? ''}`).join('|'),
  async () => {
    await scrollToBottom();
  }
);

onMounted(async () => {
  await scrollToBottom(true);
});
</script>
