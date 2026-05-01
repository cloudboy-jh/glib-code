<template>
  <UiDialog size="lg" placement="top" dialog-class="overflow-hidden" :show-close-button="false" @close="$emit('close')">
      <div class="border-b border-border/80 p-3">
        <UiInput :model-value="query" placeholder="Type a command..." class="h-10" @update:model-value="$emit('update:query', $event)" />
      </div>

      <div class="max-h-[420px] overflow-auto p-2">
        <button
          v-for="(c, i) in commands"
          :key="c.id"
          :class="[
            'flex h-10 w-full items-center justify-between rounded-md border px-3 text-left text-sm transition',
            i === highlightedIndex ? 'border-border bg-muted/80' : 'border-transparent hover:border-border/70 hover:bg-muted/55'
          ]"
          @click="$emit('run', c.id)"
        >
          <span>{{ c.label }}</span>
          <span class="text-[11px] text-muted-foreground">{{ c.id }}</span>
        </button>
      </div>
  </UiDialog>
</template>

<script setup lang="ts">
import UiDialog from '../ui/dialog.vue';
import UiInput from '../ui/input.vue';

withDefaults(
  defineProps<{
    query: string;
    commands: Array<{ id: string; label: string }>;
    highlightedIndex?: number;
  }>(),
  {
    highlightedIndex: 0
  }
);

defineEmits<{ close: []; run: [id: string]; 'update:query': [value: string] }>();
</script>
