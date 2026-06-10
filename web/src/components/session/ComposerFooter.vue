<template>
  <div class="mt-2.5 flex items-center gap-3">

    <!-- Running: sweep bar + stop button -->
    <template v-if="isRunning || isStopping">
      <div class="run-track min-w-0 flex-1">
        <div :class="['run-bar', isStopping ? 'run-bar--stopping' : '']" />
      </div>

      <div class="btn-slot">
        <Transition name="btn-fade" mode="out-in">
          <button v-if="isStopping" key="stopping" class="stop-btn stop-btn--stopping" disabled>
            <span class="stopping-dots"><span /><span /><span /></span>
            Stopping
          </button>
          <button v-else key="stop" class="stop-btn" @click="$emit('stop')">
            <Square class="h-3.5 w-3.5 fill-current" />
            Stop
          </button>
        </Transition>
      </div>
    </template>

    <!-- Idle: meta + chips + send -->
    <template v-else>
      <div class="min-w-0 flex flex-1 items-center gap-2 text-xs text-muted-foreground">
        <span class="hidden truncate pl-1 sm:inline">{{ meta }}</span>
        <button class="command-chip" @click="$emit('openCommands')">Commands</button>
      </div>

      <div class="flex items-center gap-2">
        <button class="command-chip" :disabled="disabled" @click="$emit('tree')"><FolderTree class="h-3.5 w-3.5" /></button>
        <button class="command-chip" :disabled="disabled" @click="$emit('attach')"><Paperclip class="h-3.5 w-3.5" /></button>
        <div class="btn-slot">
          <UiButton class="h-9 rounded-full px-4" :disabled="disabled" @click="$emit('send')">Send</UiButton>
        </div>
      </div>
    </template>

  </div>
</template>

<script setup lang="ts">
import { FolderTree, Paperclip, Square } from 'lucide-vue-next';
import UiButton from '../ui/button.vue';

defineProps<{ meta: string; disabled?: boolean; isRunning?: boolean; isStopping?: boolean }>();
defineEmits<{ send: []; stop: []; openCommands: []; attach: []; tree: [] }>(); 
</script>

<style scoped>
/* Running indicator track */
.run-track {
  height: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 18%, transparent);
  overflow: hidden;
  position: relative;
}

.run-bar {
  position: absolute;
  top: 0;
  height: 100%;
  width: 40%;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in srgb, var(--primary) 90%, transparent) 50%,
    transparent 100%
  );
  animation: run-sweep 1.4s ease-in-out infinite alternate;
}

.run-bar--stopping {
  animation-duration: 2.4s;
  opacity: 0.4;
}

@keyframes run-sweep {
  0%   { left: -40%; }
  100% { left: 100%; }
}

/* Chips */
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
.command-chip:disabled { opacity: 0.45; }

/* Stop button */
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
.stop-btn--stopping {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}

.stopping-dots {
  display: inline-flex;
  gap: 3px;
  align-items: center;
}
.stopping-dots span {
  display: block;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  animation: stopping-dot-pulse 1s ease-in-out infinite;
}
.stopping-dots span:nth-child(2) { animation-delay: 0.2s; }
.stopping-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes stopping-dot-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
  40%            { opacity: 1;   transform: scale(1); }
}

.btn-slot {
  display: inline-block;
  min-width: 72px;
  text-align: center;
}

.btn-fade-enter-active,
.btn-fade-leave-active { transition: opacity 100ms ease; }
.btn-fade-enter-from,
.btn-fade-leave-to { opacity: 0; }
</style>
