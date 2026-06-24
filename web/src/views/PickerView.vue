<template>
  <div class="grid h-full place-items-center px-6">
    <PickerScreen
      :recents="recents"
      :sessions-by-path="sessionsByPath"
      :commits-by-path="commitsByPath"
      :logo-src="logoSrc"
      @open-project="emit('openProject')"
      @open-clone="emit('openClone')"
      @open-palette="emit('openPalette')"
      @open-settings="emit('openSettings', $event)"
      @open-recent="emit('openRecent', $event)"
      @open-recent-diff="emit('openRecentDiff', $event)"
      @continue-recent-session="emit('continueRecentSession', $event)"
      @start-new-recent-session="emit('startNewRecentSession', $event)"
      @forget-recent="emit('forgetRecent', $event)"
      @fetch-commits="emit('fetchCommits', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import PickerScreen from '../components/picker/PickerScreen.vue';

defineProps<{
  recents: Array<{ id: string; name: string; path: string; lastOpenedAt: string; status: 'ok' | 'missing_path' | 'missing_git' }>;
  sessionsByPath: Record<string, Array<{ id: string; title: string; time: string; updatedAt?: string; status: 'connected' | 'connecting' | 'disconnected' | 'stale' | 'running' | 'done' }>>;
  commitsByPath?: Record<string, Array<{ ref: string; shortRef: string; title: string }>>;
  logoSrc?: string;
}>();

const emit = defineEmits<{
  openProject: [];
  openClone: [];
  openPalette: [];
  openSettings: [tab?: 'Models' | 'Git' | 'Integrations' | 'Appearance'];
  openRecent: [payload: { name: string; path: string; mode: 'diff' | 'session' }];
  openRecentDiff: [payload: { name: string; path: string; source: 'uncommitted' | 'commit'; commitRef?: string }];
  continueRecentSession: [payload: { name: string; path: string; sessionId: string }];
  startNewRecentSession: [payload: { name: string; path: string }];
  forgetRecent: [id: string];
  fetchCommits: [path: string];
}>();
</script>
