<template>
  <div class="grid h-full place-items-center px-6">
    <PickerScreen
      :recents="recents"
      :providers="providers"
      :sessions-by-path="sessionsByPath"
      :logo-src="logoSrc"
      @open-project="emit('openProject')"
      @open-clone="emit('openClone')"
      @open-palette="emit('openPalette')"
      @open-theme="emit('openTheme')"
      @open-editor="emit('openEditor')"
      @open-gittrix="emit('openGittrix')"
      @open-model="emit('openModel')"
      @open-recent="emit('openRecent', $event)"
      @continue-recent-session="emit('continueRecentSession', $event)"
      @start-new-recent-session="emit('startNewRecentSession', $event)"
      @forget-recent="emit('forgetRecent', $event)"
      @provider-auth-save="onProviderAuthSave"
    />
  </div>
</template>

<script setup lang="ts">
import PickerScreen from '../components/picker/PickerScreen.vue';

defineProps<{
  recents: Array<{ id: string; name: string; path: string; lastOpenedAt: string; status: 'ok' | 'missing_path' | 'missing_git' }>;
  providers: Array<{ id: string; hasAuth: boolean; modelIds: string[] }>;
  sessionsByPath: Record<string, Array<{ id: string; title: string; time: string; updatedAt?: string; status: 'connected' | 'connecting' | 'disconnected' | 'stale' | 'running' }> >;
  logoSrc?: string;
}>();

const emit = defineEmits<{
  openProject: [];
  openClone: [];
  openPalette: [];
  openTheme: [];
  openEditor: [];
  openGittrix: [];
  openModel: [];
  openRecent: [payload: { name: string; path: string; mode: 'diff' | 'session' }];
  continueRecentSession: [payload: { name: string; path: string; sessionId: string }];
  startNewRecentSession: [payload: { name: string; path: string }];
  forgetRecent: [id: string];
  providerAuthSave: [providerId: string, apiKey: string];
}>();

function onProviderAuthSave(providerId: string, apiKey: string) {
  emit('providerAuthSave', providerId, apiKey);
}
</script>
