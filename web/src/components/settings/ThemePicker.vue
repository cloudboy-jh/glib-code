<template>
  <div>
    <div class="mb-3 flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold">Theme preset</p>
        <p class="text-xs text-muted-foreground">Choose a color palette.</p>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button
        v-for="theme in themes"
        :key="theme"
        type="button"
        :class="[
          'inline-flex min-h-12 items-center justify-between gap-3 rounded-lg border px-3 text-sm transition-colors',
          modelValue === theme
            ? 'border-primary/40 bg-primary/10 text-foreground'
            : 'border-border/60 bg-background/55 text-muted-foreground hover:border-border hover:bg-muted/55 hover:text-foreground'
        ]"
        @click="$emit('update:modelValue', theme)"
      >
        <span class="min-w-0 truncate">{{ pretty(theme) }}</span>
        <span class="inline-flex items-center gap-1.5">
          <span class="theme-dot" :style="{ backgroundColor: `hsl(${THEME_PRESETS[theme].background})` }" />
          <span class="theme-dot" :style="{ backgroundColor: `hsl(${THEME_PRESETS[theme].primary})` }" />
          <span v-if="modelValue === theme" class="ml-1 text-xs text-primary">Active</span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { THEME_PRESETS, THEME_PRESET_IDS } from '@glib-code/shared/theme/presets';

defineProps<{ modelValue: string }>();
defineEmits<{ 'update:modelValue': [value: string] }>();

const themes = THEME_PRESET_IDS;

function pretty(value: string) {
  return value
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
</script>

<style scoped>
.theme-dot {
  display: inline-block;
  height: 12px;
  width: 12px;
  border-radius: 999px;
  border: 1px solid hsl(var(--border) / 0.75);
}
</style>
