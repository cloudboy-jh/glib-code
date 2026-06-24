<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        @click.self="$emit('close')"
        @keydown.escape="$emit('close')"
      >
        <div class="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-border/80 bg-card shadow-2xl shadow-black/40">
          <!-- Header -->
          <div class="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
            <div class="flex items-center gap-2 text-sm font-medium">
              <FileText class="h-4 w-4 text-amber-400" />
              Pasted Text
            </div>
            <button
              type="button"
              class="rounded-md p-1 text-muted-foreground/60 hover:bg-muted/40 hover:text-foreground"
              @click="$emit('close')"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <!-- Content -->
          <div class="min-h-0 flex-1 overflow-auto p-4">
            <pre class="whitespace-pre-wrap break-words font-mono text-[0.8125rem] leading-6 text-foreground/90">{{ content }}</pre>
          </div>

          <!-- Footer -->
          <div class="flex shrink-0 items-center justify-between border-t border-border/60 px-4 py-3">
            <span class="text-[0.6875rem] text-muted-foreground/60">{{ wordCount }} words · {{ charCount }} chars</span>
            <button
              type="button"
              class="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[0.75rem] font-medium text-red-400 hover:bg-destructive/20"
              @click="$emit('remove'); $emit('close')"
            >
              Remove attachment
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { FileText, X } from 'lucide-vue-next';

const props = defineProps<{
  open: boolean;
  content: string;
}>();

defineEmits<{ close: []; remove: [] }>();

const wordCount = computed(() => props.content.trim().split(/\s+/).filter(Boolean).length);
const charCount = computed(() => props.content.length);
</script>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 150ms ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
