<template>
  <div ref="scrollerRef" class="min-h-0 flex-1 overflow-auto overflow-x-hidden px-4 py-4 sm:px-5" @scroll="onScroll">
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
        <div v-else-if="e.text" class="space-y-2">
          <template v-for="(block, blockIndex) in parseMessageBlocks(e.text)" :key="`${e.id}-block-${blockIndex}`">
            <div
              v-if="block.kind === 'text'"
              class="prose-agent text-sm leading-6 text-foreground/95"
              v-html="renderMarkdown(block.value)"
            />
            <div v-else-if="block.kind === 'diff'" class="space-y-1">
              <div class="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Diff</div>
              <DiffView :patch="block.value" diff-style="unified" :theme-preset="themePreset" :theme-type="themeType" />
            </div>
            <pre v-else class="max-h-64 overflow-auto rounded-md bg-black/20 p-2 text-[11px] leading-5 text-muted-foreground">{{ block.value }}</pre>
          </template>
        </div>

        <div v-if="e.toolCalls?.length" class="mt-2">
          <!-- Accordion summary row -->
          <button
            type="button"
            :class="[
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
              expandedTurns.has(e.id) ? 'bg-muted/30' : 'hover:bg-muted/20'
            ]"
            @click="toggleTurn(e.id)"
          >
            <!-- Spinner while running, chevron otherwise -->
            <span v-if="e.id === activeAssistantId" class="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-sky-300/40 border-t-sky-200" />
            <component :is="expandedTurns.has(e.id) ? ChevronDown : ChevronRight" v-else class="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            <span class="min-w-0 flex-1 truncate text-left text-muted-foreground/70">
              {{ toolCallSummary(e.toolCalls, e.id === activeAssistantId) }}
            </span>
            <span v-if="e.id !== activeAssistantId" class="shrink-0 text-[10px] text-muted-foreground/40">
              {{ expandedTurns.has(e.id) ? 'collapse' : 'expand' }}
            </span>
          </button>

          <!-- Expanded rows -->
          <div v-if="expandedTurns.has(e.id) || e.id === activeAssistantId" class="mt-0.5 space-y-px">
            <div
              v-for="tool in groupToolCalls(e.toolCalls)"
              :key="tool.groupId"
            >
              <!-- Single compact row -->
              <div :class="['flex items-center gap-2 rounded-md px-2 py-1.5 text-xs', tool.status === 'running' ? 'animate-pulse' : '']">
                <span :class="['h-1.5 w-1.5 shrink-0 rounded-full', tool.status === 'failed' ? 'bg-red-400' : tool.status === 'done' ? 'bg-emerald-400' : 'bg-amber-300']" />
                <span class="min-w-0 flex-1 truncate text-muted-foreground/80">{{ tool.title }}</span>
                <span v-if="tool.count > 1" class="shrink-0 text-[10px] text-muted-foreground/50">×{{ tool.count }}</span>
                <!-- -N +N diff badge — click opens session diff for this file -->
                <button
                  v-if="tool.renderKind === 'diff' && tool.diff && diffStats(tool.diff).total > 0"
                  class="shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] hover:bg-muted/50"
                  @click="$emit('openFileDiff', tool.fileTarget)"
                >
                  <span class="text-red-400/80">-{{ diffStats(tool.diff).del }}</span>
                  <span class="text-emerald-400/80">+{{ diffStats(tool.diff).add }}</span>
                </button>
              </div>

              <!-- Error output only -->
              <pre
                v-if="tool.status === 'failed' && tool.preview"
                class="mx-2 mb-1 max-h-32 overflow-auto rounded-md bg-red-950/20 p-2 text-[11px] leading-5 text-red-200/90"
              >{{ tool.preview }}</pre>

              <!-- File tree artifact -->
              <div
                v-if="tool.renderKind === 'tree' && tool.treePaths?.length"
                class="mx-2 mb-1"
              >
                <FileTreeView :paths="tool.treePaths" :git-status="tool.treeGitStatus ?? {}" :theme-preset="themePreset" />
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>

    <button
      v-if="pendingCount > 0 || !followLive"
      class="fixed bottom-24 right-8 z-20 rounded-md border border-border/70 bg-card/95 px-3 py-1.5 text-xs text-foreground shadow-lg shadow-black/30 hover:bg-muted/60"
      @click="jumpToLatest"
    >
      {{ pendingCount > 0 ? `${pendingCount} new event${pendingCount === 1 ? '' : 's'} · Jump to latest` : 'Resume live' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ChevronDown, ChevronRight } from 'lucide-vue-next';
import type { ThemePreset } from '@glib-code/shared/theme/presets';
import DiffView from '../shared/DiffView.vue';
import FileTreeView from '../shared/FileTreeView.vue';

// Configure marked: no default wrapping, use GFM, no pedantic
marked.setOptions({ gfm: true, breaks: true });

const props = defineProps<{
  entries: Array<{
    id: string;
    kind: string;
    text: string;
    time: string;
    at?: string;
    level?: 'info' | 'error';
    toolCalls?: Array<{
      id: string;
      title: string;
      status: 'running' | 'done' | 'failed';
      renderKind: 'diff' | 'code' | 'json' | 'terminal' | 'text' | 'tree' | 'error';
      command?: string;
      cwd?: string;
      preview?: string;
      rawInput?: string;
      rawOutput?: string;
      diff?: string;
      fileTarget?: string;
      isError?: boolean;
      treePaths?: string[];
      treeGitStatus?: Record<string, string>;
    }>;
  }>;
  themePreset?: ThemePreset;
  themeType?: 'dark' | 'light';
}>();

defineEmits<{ openFileDiff: [fileTarget: string | undefined] }>();

function diffStats(patch: string) {
  const add = (patch.match(/^\+(?!\+\+)/gm) ?? []).length;
  const del = (patch.match(/^-(?!--)/gm) ?? []).length;
  return { add, del, total: add + del };
}

const scrollerRef = ref<HTMLDivElement | null>(null);
const followLive = ref(true);
const pendingCount = ref(0);

const activeAssistantEntry = computed(() => {
  for (let index = props.entries.length - 1; index >= 0; index -= 1) {
    const entry = props.entries[index];
    if (entry.kind !== 'Assistant' && entry.kind !== 'Error') continue;
    if ((entry.toolCalls ?? []).some((tool) => tool.status === 'running')) return entry;
  }
  return null;
});

const activeAssistantId = computed(() => activeAssistantEntry.value?.id ?? '');

// Accordion state — tracks which completed turns are expanded
const expandedTurns = reactive(new Set<string>());

function toggleTurn(id: string) {
  // Don't toggle while actively running — always expanded
  if (id === activeAssistantId.value) return;
  if (expandedTurns.has(id)) {
    expandedTurns.delete(id);
  } else {
    expandedTurns.add(id);
  }
}

function toolCallSummary(toolCalls: NonNullable<(typeof props.entries)[number]['toolCalls']>, isActive: boolean): string {
  const total = toolCalls.length;
  if (isActive) {
    const running = toolCalls.filter((t) => t.status === 'running').length;
    const current = toolCalls.filter((t) => t.status === 'running').at(-1)?.title ?? toolCalls.at(-1)?.title ?? 'Working…';
    return running > 0 ? `${current}  ·  ${total} calls` : `${total} tool calls`;
  }
  // Summarise by tool type from title prefix (e.g. "bash · git status" → "bash")
  const counts: Record<string, number> = {};
  for (const t of toolCalls) {
    const tool = t.title.split('·')[0].trim().split(' ')[0].toLowerCase();
    counts[tool] = (counts[tool] ?? 0) + 1;
  }
  const parts = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, n]) => (n > 1 ? `${n}× ${name}` : name));
  return `${total} tool call${total === 1 ? '' : 's'}  ·  ${parts.join(', ')}`;
}



function parseMessageBlocks(text: string) {
  const blocks: Array<{ kind: 'text' | 'diff' | 'code'; value: string }> = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const [full, langRaw, body] = match;
    const start = match.index;
    if (start > last) {
      const chunk = text.slice(last, start).trim();
      if (chunk) blocks.push({ kind: 'text', value: chunk });
    }
    const lang = (langRaw || '').toLowerCase();
    blocks.push({ kind: lang === 'diff' ? 'diff' : 'code', value: body.trim() });
    last = start + full.length;
  }
  if (last < text.length) {
    const tail = text.slice(last).trim();
    if (tail) blocks.push({ kind: 'text', value: tail });
  }
  return blocks.length ? blocks : [{ kind: 'text' as const, value: text }];
}

function renderMarkdown(text: string): string {
  const raw = marked.parse(text) as string;
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}

function groupToolCalls(tools: NonNullable<(typeof props.entries)[number]['toolCalls']>) {
  const grouped: Array<(typeof tools)[number] & { groupId: string; count: number }> = [];
  for (const tool of tools) {
    const key = `${tool.title}|${tool.status}|${tool.command ?? ''}|${tool.cwd ?? ''}`;
    const prev = grouped[grouped.length - 1];
    if (prev && `${prev.title}|${prev.status}|${prev.command ?? ''}|${prev.cwd ?? ''}` === key) {
      prev.count += 1;
      if (tool.preview && tool.preview.length >= (prev.preview?.length ?? 0)) prev.preview = tool.preview;
      if (tool.rawOutput && tool.rawOutput.length >= (prev.rawOutput?.length ?? 0)) prev.rawOutput = tool.rawOutput;
      continue;
    }
    grouped.push({ ...tool, groupId: tool.id, count: 1 });
  }
  return grouped;
}


function isNearBottom(el: HTMLDivElement, threshold = 80) {
  return el.scrollHeight - (el.scrollTop + el.clientHeight) <= threshold;
}

async function scrollToBottom(force = false) {
  await nextTick();
  const el = scrollerRef.value;
  if (!el) return;
  if (!force && !followLive.value) return;
  el.scrollTop = el.scrollHeight;
  pendingCount.value = 0;
}

function onScroll() {
  const el = scrollerRef.value;
  if (!el) return;
  followLive.value = isNearBottom(el, 60);
  if (followLive.value) pendingCount.value = 0;
}

async function jumpToLatest() {
  followLive.value = true;
  await scrollToBottom(true);
}

watch(
  () => props.entries.map((entry) => `${entry.id}:${entry.text.length}:${entry.level ?? 'info'}:${entry.toolCalls?.map((tool) => `${tool.id}:${tool.status}:${tool.preview?.length ?? 0}:${tool.rawOutput?.length ?? 0}:${tool.diff?.length ?? 0}`).join(',') ?? ''}`).join('|'),
  async () => {
    if (followLive.value) {
      await scrollToBottom(true);
    } else {
      pendingCount.value += 1;
    }
  }
);

onMounted(async () => {
  await scrollToBottom(true);
});
</script>
