<template>
  <div v-if="open && items.length" class="absolute bottom-full left-0 z-20 mb-2 w-[320px] overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-lg shadow-black/20">
    <div class="border-b border-border/70 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Commands</div>
    <div class="p-1.5">
      <button
        v-for="(item, index) in items"
        :key="item.id"
        type="button"
        :class="[
          'flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors',
          index === highlightedIndex ? 'bg-accent text-foreground' : 'text-foreground hover:bg-accent/70'
        ]"
        @mousedown.prevent
        @click="$emit('select', item.value)"
      >
        <span class="mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-background/70 px-2 font-mono text-[11px] text-primary">/{{ item.value }}</span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium">{{ item.label }}</span>
          <span class="block text-xs text-muted-foreground">{{ item.description }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean;
  items: Array<{ id: string; value: string; label: string; description: string }>;
  highlightedIndex: number;
}>();

defineEmits<{ select: [value: string] }>();
</script>
