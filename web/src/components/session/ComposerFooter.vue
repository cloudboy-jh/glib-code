<template>
  <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2.5">
    <div class="min-w-0 flex items-center gap-2 text-xs text-muted-foreground">
      <span class="hidden truncate pl-1 sm:inline">{{ meta }}</span>
      <button class="command-chip" @click="$emit('openCommands')">Commands</button>
    </div>

    <div class="flex items-center gap-2">
      <UiButton class="h-9 rounded-full px-4" @click="$emit('send')">Send</UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import UiButton from '../ui/button.vue';

defineProps<{ meta: string }>();
defineEmits<{ send: []; openCommands: [] }>();
</script>

<style scoped>
.command-chip {
  display: inline-flex;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid hsl(var(--border) / 0.7);
  background: hsl(var(--background) / 0.45);
  padding: 0 10px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.command-chip:hover {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.75);
  color: hsl(var(--foreground));
}
</style>
