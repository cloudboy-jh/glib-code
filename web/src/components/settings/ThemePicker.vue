<template>
  <div>
    <div class="mb-3 flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold">Theme preset</p>
        <p class="text-xs text-muted-foreground">Choose a color palette.</p>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div v-if="inHouseThemes.length" class="col-span-full flex items-center gap-2 pt-1">
        <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">In-House Glib Themes</span>
        <span class="rounded border border-border/60 px-1 py-px text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">Curated</span>
      </div>
      <button
        v-for="theme in inHouseThemes"
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

      <div v-if="inHouseThemes.length && otherThemes.length" class="col-span-full my-1 h-px bg-border/50" />

      <button
        v-for="theme in otherThemes"
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
import { computed } from 'vue';

defineProps<{ modelValue: string }>();
defineEmits<{ 'update:modelValue': [value: string] }>();

const IN_HOUSE_THEMES = ['minimal-dark', 'minimal-paper'] as const;
const inHouseThemes = computed(() => (THEME_PRESET_IDS as readonly string[]).filter((id) => (IN_HOUSE_THEMES as readonly string[]).includes(id)));
const otherThemes = computed(() => (THEME_PRESET_IDS as readonly string[]).filter((id) => !(IN_HOUSE_THEMES as readonly string[]).includes(id)));

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
