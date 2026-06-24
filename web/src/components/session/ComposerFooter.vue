<template>
  <div :class="['flex items-center gap-3', isRunning || isStopping ? 'mt-1' : 'mt-2.5']">

    <!-- Running: sweep bar + stop button -->
    <template v-if="isRunning || isStopping">
      <div class="run-track min-w-0 flex-1">
        <div class="run-pong-wrap">
          <div :class="['run-pong', isStopping ? 'run-pong--stopping' : '']" />
        </div>
        <span :class="['run-shimmer', isStopping ? 'run-shimmer--stopping' : '']">
          {{ isStopping ? 'Stopping…' : (currentToolLabel || 'Working…') }}
        </span>
        <span v-if="elapsedLabel" class="run-elapsed">{{ elapsedLabel }}</span>
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
import { toRef } from 'vue';
import { FolderTree, Paperclip, Square } from 'lucide-vue-next';
import UiButton from '../ui/button.vue';
import { useElapsed } from '../../composables/useElapsed';

const props = withDefaults(
  defineProps<{
    meta: string;
    disabled?: boolean;
    isRunning?: boolean;
    isStopping?: boolean;
    currentToolLabel?: string;
    turnStartedAt?: string | null;
  }>(),
  {
    disabled: false,
    isRunning: false,
    isStopping: false,
    currentToolLabel: '',
    turnStartedAt: null
  }
);

defineEmits<{ send: []; stop: []; openCommands: []; attach: []; tree: [] }>();

const { label: elapsedLabel } = useElapsed(toRef(props, 'turnStartedAt'));
</script>

<style scoped>
/* Running indicator track */
.run-track {
  height: 2rem;
  border-radius: 0.5rem;
  background: hsl(var(--muted) / 0.18);
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 0.875rem;
  gap: 0.75rem;
}

/* Ping-pong bar lives at the bottom edge of the track */
.run-pong-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  overflow: hidden;
  pointer-events: none;
  background: hsl(var(--primary) / 0.08);
}

.run-pong {
  position: absolute;
  top: 0;
  height: 100%;
  width: 28%;
  border-radius: 999px;
  background: hsl(var(--primary));
  animation: run-pong 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
}

.run-pong--stopping {
  background: hsl(0 72% 70%);
  animation-duration: 2.6s;
  opacity: 0.55;
}

@keyframes run-pong {
  0%   { left: 0%; }
  100% { left: 72%; }
}

/* Text with shimmering gradient sweeping through it */
.run-shimmer {
  position: relative;
  z-index: 1;
  font-size: 0.75rem;
  font-weight: 500;
  pointer-events: none;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  background: linear-gradient(
    90deg,
    hsl(var(--foreground) / 0.35) 0%,
    hsl(var(--foreground) / 0.35) 40%,
    hsl(var(--foreground) / 0.95) 50%,
    hsl(var(--foreground) / 0.35) 60%,
    hsl(var(--foreground) / 0.35) 100%
  );
  background-size: 250% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: run-text-shimmer 2.2s linear infinite;
}

.run-shimmer--stopping {
  background: linear-gradient(
    90deg,
    hsl(0 72% 70% / 0.45) 0%,
    hsl(0 72% 70% / 0.45) 40%,
    hsl(0 72% 70% / 1) 50%,
    hsl(0 72% 70% / 0.45) 60%,
    hsl(0 72% 70% / 0.45) 100%
  );
  background-size: 250% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation-duration: 3s;
}

@keyframes run-text-shimmer {
  0%   { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

.run-elapsed {
  position: relative;
  z-index: 1;
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--muted-foreground) / 0.7);
  pointer-events: none;
  flex-shrink: 0;
}

/* Chips */
.command-chip {
  display: inline-flex;
  height: 1.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid hsl(var(--border) / 0.7);
  background: hsl(var(--background) / 0.45);
  padding: 0 0.625rem;
  font-size: 0.75rem;
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
  height: 2.25rem;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border-radius: 999px;
  border: 1px solid hsl(var(--destructive) / 0.5);
  background: hsl(var(--destructive) / 0.12);
  padding: 0 1rem;
  font-size: 0.8125rem;
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
  min-width: 4.5rem;
  text-align: center;
}

.btn-fade-enter-active,
.btn-fade-leave-active { transition: opacity 100ms ease; }
.btn-fade-enter-from,
.btn-fade-leave-to { opacity: 0; }
</style>
