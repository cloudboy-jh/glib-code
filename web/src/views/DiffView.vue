<template>
  <DiffWorkbench
    :current-project="currentProject"
    :diff-style="diffStyle"
    :open-request="openRequest"
    :theme-type="themeType"
    :theme-preset="themePreset"
    :preferred-editor="preferredEditor"
    :session-id="sessionId"
    @update:diff-style="$emit('update:diffStyle', $event)"
    @open-projects="$emit('openProjects')"
    @start-session-from-diff="$emit('startSessionFromDiff', $event)"
    @open-settings="$emit('openSettings')"
  />
</template>

<script setup lang="ts">
import type { ThemePreset } from '@glib-code/shared/theme/presets';
import DiffWorkbench from '../components/diff/DiffWorkbench.vue';

defineProps<{
  currentProject: { id: string; name: string; path: string; branch: string } | null;
  diffStyle: 'split' | 'unified';
  openRequest?: { token: number; mode: 'session' | 'history' | 'commit' | 'uncommitted'; files?: string[]; commitRef?: string } | null;
  themeType: 'dark' | 'light';
  themePreset: ThemePreset;
  preferredEditor: string | null;
  sessionId?: string;
}>();

defineEmits<{
  'update:diffStyle': [value: 'split' | 'unified'];
  openProjects: [];
  startSessionFromDiff: [payload: { source: 'uncommitted' | 'commit'; ref?: string; file?: string; files?: string[]; context?: string }];
  openSettings: [];
}>();
</script>
