<template>
  <div class="min-h-0 flex-1 overflow-auto px-6 py-5">
    <div class="mx-auto max-w-5xl space-y-4">
      <article
        v-for="e in entries"
        :key="e.id"
        class="rounded-lg border border-border/80 bg-card/50 p-4"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{{ e.kind }}</span>
          <span class="text-[11px] text-muted-foreground/80">{{ e.time }}</span>
        </div>

        <div v-if="e.level === 'error'" class="rounded-md border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-300">
          {{ e.text }}
        </div>
        <p v-else class="whitespace-pre-wrap text-sm text-foreground/95">{{ e.text }}</p>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  entries: Array<{
    id: string;
    kind: string;
    text: string;
    time: string;
    level?: 'info' | 'error';
  }>;
}>();
</script>
