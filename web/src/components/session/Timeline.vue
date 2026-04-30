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
        <p v-else class="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/95">{{ e.text }}</p>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  entries: Array<{
    id: string;
    kind: string;
    text: string;
    time: string;
    level?: 'info' | 'error';
  }>;
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
  () => props.entries.length,
  async (next, prev) => {
    await scrollToBottom(prev === 0 || next > prev);
  }
);

onMounted(async () => {
  await scrollToBottom(true);
});
</script>
