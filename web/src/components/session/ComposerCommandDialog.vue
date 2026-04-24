<template>
  <UiDialog dialog-class="max-w-[560px]" @close="$emit('close')">
    <div class="flex flex-col gap-2 p-6 pb-3">
      <h3 class="text-xl font-semibold leading-none">Commands</h3>
      <p class="text-sm text-muted-foreground">Quick actions for the composer.</p>
    </div>

    <div class="p-6 pt-1 pb-4">
      <div class="mb-3 rounded-xl border border-input/80 bg-background/70 px-3 py-2 text-sm text-muted-foreground">Type <span class="font-mono text-foreground">/</span> in the input for inline commands.</div>
      <div class="space-y-1">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/70"
          @click="$emit('select', item.value)"
        >
          <span class="mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-background/70 px-2 font-mono text-[11px] text-primary">/{{ item.value }}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-foreground">{{ item.label }}</span>
            <span class="block text-xs text-muted-foreground">{{ item.description }}</span>
            <span v-if="item.aliases?.length" class="mt-1 block text-[11px] text-muted-foreground/80">Aliases: {{ item.aliases.map((alias) => `/${alias}`).join(', ') }}</span>
          </span>
        </button>
      </div>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import UiDialog from '../ui/dialog.vue';

defineProps<{ items: Array<{ id: string; value: string; label: string; description: string; aliases?: string[] }> }>();
defineEmits<{ close: []; select: [value: string] }>();
</script>
