<template>
  <UiDialog dialog-class="max-w-[35rem] max-h-[80vh] overflow-y-auto" @close="$emit('close')">
    <div class="flex flex-col gap-2 p-6 pb-3">
      <h3 class="text-xl font-semibold leading-none">Commands</h3>
      <p class="text-sm text-muted-foreground">Quick actions for the composer.</p>
    </div>

    <div class="p-6 pt-1 pb-4">
      <div class="mb-3 rounded-xl border border-input/80 bg-background/70 px-3 py-2 text-sm text-muted-foreground">Type <span class="font-mono text-foreground">/</span> in the input for inline commands.</div>
      <template v-for="group in groupedItems" :key="group.category">
        <div class="mt-4 mb-1 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">{{ group.label }}</div>
        <div class="space-y-1">
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            class="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/70"
            @click="$emit('select', item.value)"
          >
            <span class="mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-background/70 px-2 font-mono text-[0.6875rem] text-primary">/{{ item.value }}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium text-foreground">{{ item.label }}</span>
              <span class="block text-xs text-muted-foreground">{{ item.description }}</span>
              <span v-if="item.inlineArgs && item.argHint" class="mt-0.5 block text-[0.6875rem] text-muted-foreground/60">Usage: /{{ item.value }} {{ item.argHint }}</span>
              <span v-if="item.aliases?.length" class="mt-1 block text-[0.6875rem] text-muted-foreground/80">Aliases: {{ item.aliases.map((alias) => `/${alias}`).join(', ') }}</span>
            </span>
          </button>
        </div>
      </template>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import UiDialog from '../ui/dialog.vue';
import { CATEGORY_ORDER, CATEGORY_LABELS, type SlashCommand, type SlashCommandCategory } from '../../composables/useSlashCommands';

const props = defineProps<{ items: SlashCommand[] }>();
defineEmits<{ close: []; select: [value: string] }>();

const groupedItems = computed(() => {
  const groups: Array<{ category: SlashCommandCategory; label: string; items: SlashCommand[] }> = [];
  for (const cat of CATEGORY_ORDER) {
    const items = props.items.filter((i) => i.category === cat);
    if (items.length) groups.push({ category: cat, label: CATEGORY_LABELS[cat], items });
  }
  return groups;
});
</script>
