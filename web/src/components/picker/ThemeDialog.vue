<template>
  <UiDialog dialog-class="max-w-[720px]" @close="$emit('close')">
    <div class="flex flex-col gap-2 p-6 pb-3">
      <h3 class="text-xl font-semibold leading-none">Theme</h3>
      <p class="text-sm text-muted-foreground">Switch the app theme and preview the active token palette.</p>
    </div>

    <div class="p-6 pt-1 pb-4">
      <input
        v-model="query"
        class="mb-3 h-10 w-full rounded-lg border border-input/80 bg-background/70 px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="Search themes"
      />

      <div class="max-h-[420px] space-y-1 overflow-auto pr-1">
        <button
          v-for="themeId in filteredThemes"
          :key="themeId"
          :class="[
            'flex h-11 w-full items-center rounded-lg border px-3 text-left transition',
            modelValue === themeId ? 'border-border bg-muted/80' : 'border-transparent hover:border-border/60 hover:bg-muted/55'
          ]"
          @click="$emit('update:modelValue', themeId)"
        >
          <span class="min-w-0 flex-1 truncate text-sm text-foreground">{{ formatName(themeId) }}</span>
          <span class="mr-2 inline-flex items-center gap-1.5">
            <span class="theme-dot" :style="{ backgroundColor: `hsl(${THEME_PRESETS[themeId].background})` }" />
            <span class="theme-dot" :style="{ backgroundColor: `hsl(${THEME_PRESETS[themeId].foreground})` }" />
            <span class="theme-dot" :style="{ backgroundColor: `hsl(${THEME_PRESETS[themeId].primary})` }" />
            <span class="theme-dot" :style="{ backgroundColor: `hsl(${THEME_PRESETS[themeId].border})` }" />
          </span>
          <Check v-if="modelValue === themeId" class="h-4 w-4 text-primary" />
        </button>

        <p v-if="!filteredThemes.length" class="px-1 py-3 text-sm text-muted-foreground">No themes found.</p>
      </div>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import { THEME_PRESETS, THEME_PRESET_IDS, type ThemePreset } from '@glib-code/shared/theme/presets';
import { Check } from 'lucide-vue-next';
import { computed, ref } from 'vue';
import UiDialog from '../ui/dialog.vue';

defineProps<{ modelValue: ThemePreset }>();
defineEmits<{ close: []; 'update:modelValue': [value: ThemePreset] }>();

const query = ref('');

const filteredThemes = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return THEME_PRESET_IDS;
  return THEME_PRESET_IDS.filter((id) => id.toLowerCase().includes(q) || formatName(id).toLowerCase().includes(q));
});

function formatName(value: string) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
</script>

<style scoped>
.theme-dot {
  display: inline-block;
  height: 12px;
  width: 12px;
  border-radius: 999px;
  border: 1px solid hsl(var(--border));
}
</style>
