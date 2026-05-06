<template>
  <UiDialog size="lg" placement="center" dialog-class="overflow-hidden" :show-close-button="false" @close="$emit('close')">
      <div class="border-b border-border/80 p-3">
        <input
          ref="inputRef"
          :value="query"
          placeholder="Type a command..."
          class="flex h-11 w-full rounded-md border border-input/80 bg-background/70 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          @input="$emit('update:query', ($event.target as HTMLInputElement).value)"
        />
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

        <div v-if="commands.length === 0" class="px-3 py-8 text-center text-sm text-muted-foreground">No matching commands</div>
      </div>
  </UiDialog>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import UiDialog from '../ui/dialog.vue';

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

const inputRef = ref<HTMLInputElement | null>(null);

onMounted(() => {
  void nextTick(() => inputRef.value?.focus());
});
</script>
