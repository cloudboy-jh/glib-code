<template>
  <DiffWorkbench
    :current-project="currentProject"
    :diff-style="diffStyle"
    :theme-type="themeType"
    :theme-preset="themePreset"
    @update:diff-style="$emit('update:diffStyle', $event)"
    @open-projects="$emit('openProjects')"
    @start-session-from-diff="$emit('startSessionFromDiff', $event)"
  />
</template>

<script setup lang="ts">
import type { ThemePreset } from '@glib-code/shared/theme/presets';
import DiffWorkbench from '../components/diff/DiffWorkbench.vue';

defineProps<{
  currentProject: { id: string; name: string; path: string; branch: string } | null;
  diffStyle: 'split' | 'unified';
  themeType: 'dark' | 'light';
  themePreset: ThemePreset;
}>();

defineEmits<{
  'update:diffStyle': [value: 'split' | 'unified'];
  openProjects: [];
  startSessionFromDiff: [payload: { source: 'uncommitted' | 'commits'; ref?: string; file?: string; paths?: string[]; context?: string }];
}>();
</script>
