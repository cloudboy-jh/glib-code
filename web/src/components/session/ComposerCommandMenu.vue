<template>
  <div v-if="open && items.length" class="absolute bottom-full left-0 z-20 mb-2 w-[21.25rem] max-h-[25rem] overflow-y-auto rounded-2xl border border-border/80 bg-card/95 shadow-lg shadow-black/20">
    <template v-for="group in groupedItems" :key="group.category">
      <div class="border-b border-border/70 px-3 py-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">{{ group.label }}</div>
      <div class="p-1.5">
        <button
          v-for="item in group.items"
          :key="item.id"
          type="button"
          :class="[
            'flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors',
            item.value === highlightedValue ? 'bg-accent text-foreground' : 'text-foreground hover:bg-accent/70'
          ]"
          @mousedown.prevent
          @click="$emit('select', item)"
        >
          <span class="mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-background/70 px-2 font-mono text-[0.6875rem] text-primary">/{{ item.value }}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium">{{ item.label }}</span>
            <span class="block text-xs text-muted-foreground">{{ item.description }}</span>
            <span v-if="item.inlineArgs && item.argHint" class="mt-0.5 block text-[0.6875rem] text-muted-foreground/60">{{ item.argHint }}</span>
          </span>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CATEGORY_ORDER, CATEGORY_LABELS, type SlashCommand, type SlashCommandCategory } from '../../composables/useSlashCommands';

const props = defineProps<{
  open: boolean;
  items: SlashCommand[];
  highlightedIndex: number;
}>();

defineEmits<{ select: [cmd: SlashCommand] }>();

const highlightedValue = computed(() => props.items[props.highlightedIndex]?.value);

const groupedItems = computed(() => {
  const groups: Array<{ category: SlashCommandCategory; label: string; items: SlashCommand[] }> = [];
  for (const cat of CATEGORY_ORDER) {
    const items = props.items.filter((i) => i.category === cat);
    if (items.length) groups.push({ category: cat, label: CATEGORY_LABELS[cat], items });
  }
  return groups;
});
</script>
