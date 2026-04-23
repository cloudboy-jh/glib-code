<template>
  <div class="space-y-1.5">
    <div
      v-for="k in modelValue"
      :key="k.command"
      class="grid grid-cols-[1fr_140px] items-center gap-3 rounded-md border border-border/80 bg-background/45 px-3 py-2"
    >
      <span class="text-xs text-foreground/95">{{ k.command }}</span>
      <input
        :value="k.key"
        class="h-8 rounded-md border border-input/80 bg-card/80 px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        @input="$emit('change', { command: k.command, key: ($event.target as HTMLInputElement).value })"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue: Array<{ command: string; key: string }> }>();
defineEmits<{ change: [payload: { command: string; key: string }] }>();
</script>
