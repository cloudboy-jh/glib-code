<template>
  <div>
    <label class="mb-2 block text-xs text-muted-foreground">Theme preset</label>
    <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      <button
        v-for="theme in themes"
        :key="theme"
        type="button"
        :class="[
          'inline-flex h-10 items-center justify-between rounded-md border px-3 text-sm transition-colors',
          modelValue === theme
            ? 'border-border bg-muted/80 text-foreground'
            : 'border-border/60 bg-background/55 text-muted-foreground hover:border-border hover:bg-muted/55 hover:text-foreground'
        ]"
        @click="$emit('update:modelValue', theme)"
      >
        <span>{{ pretty(theme) }}</span>
        <span v-if="modelValue === theme" class="text-xs text-primary">Active</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue: string }>();
defineEmits<{ 'update:modelValue': [value: string] }>();

const themes = ['tokyo-night', 'catppuccin-mocha', 'gruvbox-dark', 'nord'];

function pretty(value: string) {
  return value
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
</script>
