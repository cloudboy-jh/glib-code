<template>
  <UiDialog @close="$emit('close')">
    <div class="flex flex-col gap-2 p-6 pb-3">
      <h3 class="text-xl font-semibold leading-none">Open project</h3>
      <p class="text-sm text-muted-foreground">Choose where to land for <span class="font-medium text-foreground">{{ projectName }}</span>.</p>
    </div>

    <div class="space-y-3 p-6 pt-1 pb-6">
      <button
        type="button"
        autofocus
        class="flex w-full items-start gap-3 rounded-xl border border-border/80 bg-background/70 px-4 py-4 text-left transition hover:bg-accent/70"
        @click="$emit('selectMode', 'diff')"
      >
        <span class="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-sm font-semibold text-primary">D</span>
        <span class="min-w-0 flex-1">
          <span class="mb-1 block text-sm font-semibold text-foreground">Diffs</span>
          <span class="block text-sm text-muted-foreground">Review repo changes first and enter the diff workbench.</span>
        </span>
      </button>

      <button
        type="button"
        class="flex w-full items-start gap-3 rounded-xl border border-border/80 bg-background/70 px-4 py-4 text-left transition hover:bg-accent/70"
        @click="$emit('selectMode', 'session')"
      >
        <span class="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-foreground">S</span>
        <span class="min-w-0 flex-1">
          <span class="mb-1 block text-sm font-semibold text-foreground">Session</span>
          <span class="block text-sm text-muted-foreground">Jump straight into the session surface and start working with the agent.</span>
        </span>
      </button>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import UiDialog from '../ui/dialog.vue';

defineProps<{ projectName: string }>();
defineEmits<{ close: []; selectMode: [mode: 'diff' | 'session'] }>();
</script>
