<template>
  <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2.5">
    <div class="min-w-0 flex items-center gap-2 text-xs text-muted-foreground">
      <span class="hidden truncate pl-1 sm:inline">{{ meta }}</span>
      <button class="command-chip" @click="$emit('openCommands')">Commands</button>
    </div>

    <div class="flex items-center gap-2">
      <button class="command-chip" :disabled="disabled || isRunning" @click="$emit('tree')"><FolderTree class="h-3.5 w-3.5" /></button>
      <button class="command-chip" :disabled="disabled || isRunning" @click="$emit('attach')"><Paperclip class="h-3.5 w-3.5" /></button>

      <div class="btn-slot">
        <Transition name="btn-fade" mode="out-in">
          <button
            v-if="isRunning"
            key="stop"
            class="stop-btn"
            @click="$emit('stop')"
          >
            <Square class="h-3.5 w-3.5 fill-current" />
            Stop
          </button>

          <UiButton v-else key="send" class="h-9 rounded-full px-4" :disabled="disabled" @click="$emit('send')">Send</UiButton>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FolderTree, Paperclip, Square } from 'lucide-vue-next';
import UiButton from '../ui/button.vue';

defineProps<{ meta: string; disabled?: boolean; isRunning?: boolean }>();
defineEmits<{ send: []; stop: []; openCommands: []; attach: []; tree: [] }>();
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

.command-chip:disabled {
  opacity: 0.45;
}

.stop-btn {
  display: inline-flex;
  height: 36px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid hsl(var(--destructive) / 0.5);
  background: hsl(var(--destructive) / 0.12);
  padding: 0 16px;
  font-size: 13px;
  font-weight: 500;
  color: hsl(0 72% 70%);
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.stop-btn:hover {
  border-color: hsl(var(--destructive) / 0.75);
  background: hsl(var(--destructive) / 0.22);
  color: hsl(0 80% 78%);
}

.btn-slot {
  display: inline-block;
  min-width: 72px;
  text-align: center;
}

.btn-fade-enter-active,
.btn-fade-leave-active {
  transition: opacity 100ms ease;
}
.btn-fade-enter-from,
.btn-fade-leave-to {
  opacity: 0;
}
</style>
