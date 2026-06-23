<template>
  <div class="sticky bottom-3 z-10 rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl shadow-black/20 backdrop-blur-sm">
    <div class="flex flex-wrap items-center gap-2">
      <div class="min-w-0 flex-1">
        <div class="text-xs font-medium text-foreground">Selected diff context</div>
        <div class="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>{{ fileCount }} files</span>
          <span>{{ hunkCount }} hunks</span>
          <span v-if="additions">{{ additions }} additions</span>
          <span v-if="deletions">{{ deletions }} deletions</span>
          <span v-if="truncationCount">{{ truncationCount }} truncated lines</span>
        </div>
      </div>
      <button
        type="button"
        class="h-8 rounded border border-border/70 px-2.5 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
        :disabled="!fileCount && !hunkCount"
        @click="$emit('clear')"
      >
        Clear
      </button>
      <button
        type="button"
        class="h-8 rounded border border-primary/55 bg-primary/12 px-2.5 text-[11px] font-medium text-primary hover:bg-primary/18 disabled:opacity-40"
        :disabled="!fileCount && !hunkCount"
        @click="$emit('new')"
      >
        Start session
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  fileCount: number;
  hunkCount: number;
  additions?: number;
  deletions?: number;
  truncationCount?: number;
}>();

defineEmits<{ clear: []; new: [] }>();
</script>
