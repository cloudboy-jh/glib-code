<template>
  <header class="flex h-[44px] items-center gap-2.5 border-b border-border/80 px-3 sm:px-4">
    <!-- Left sidebar re-open -->
    <button
      v-if="!leftSidebarOpen"
      type="button"
      class="header-button shrink-0 px-2"
      aria-label="Open left sidebar"
      @click="$emit('toggleLeftSidebar')"
    >
      <PanelLeftOpen class="header-icon" />
    </button>

    <div class="flex min-w-0 flex-1 items-center gap-2">
      <div class="flex min-w-0 items-center gap-1.5 text-sm tracking-tight">
        <span v-if="projectName" class="shrink-0 truncate font-medium text-muted-foreground/80">{{ projectName }}</span>
        <span v-if="projectName" class="shrink-0 text-muted-foreground/40">/</span>
        <span class="truncate font-medium text-foreground">{{ title }}</span>
      </div>
      <span :class="['inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]', statusBadgeClass]">
        <span :class="['h-1.5 w-1.5 rounded-full', statusDotClass]" />
        {{ statusLabel }}
      </span>
    </div>

    <div class="flex items-center gap-1.5">
      <OpenInEditor target="project" :preferred-editor="preferredEditor" :session-id="sessionId" @open-settings="$emit('openEditorSettings')" />

      <button class="header-button" @click="$emit('openModel')">
        <span>{{ model }}</span>
      </button>
    </div>

    <!-- Right sidebar re-open -->
    <button
      v-if="!rightSidebarOpen"
      type="button"
      class="header-button shrink-0 px-2"
      aria-label="Open right sidebar"
      @click="$emit('toggleRightSidebar')"
    >
      <PanelRightOpen class="header-icon" />
    </button>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { PanelLeftOpen, PanelRightOpen } from 'lucide-vue-next';
import OpenInEditor from '../shared/OpenInEditor.vue';

const props = withDefaults(defineProps<{
  title: string;
  projectName?: string;
  model: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'stale' | 'running' | 'done';
  themeType?: 'dark' | 'light';
  preferredEditor?: string | null;
  sessionId?: string;
  leftSidebarOpen?: boolean;
  rightSidebarOpen?: boolean;
}>(), {
  projectName: '',
  preferredEditor: null,
  themeType: 'dark',
  leftSidebarOpen: true,
  rightSidebarOpen: true,
});
defineEmits<{ openModel: []; openEditorSettings: []; toggleLeftSidebar: []; toggleRightSidebar: [] }>();

const statusDotClass = computed(() => {
  if (props.status === 'stale') return 'bg-amber-400';
  if (props.status === 'running') return 'bg-sky-400';
  if (props.status === 'connecting') return 'bg-violet-400';
  if (props.status === 'done' || props.status === 'disconnected') return 'bg-zinc-500';
  return 'bg-emerald-400';
});

const statusLabel = computed(() => {
  if (props.status === 'running') return 'Agent is live';
  if (props.status === 'connecting') return 'Connecting';
  if (props.status === 'stale') return 'Stream stale';
  if (props.status === 'done') return 'Promoted';
  if (props.status === 'disconnected') return 'Disconnected';
  return 'Connected';
});

const statusBadgeClass = computed(() => {
  const light = props.themeType === 'light';
  if (props.status === 'running') return light
    ? 'border-sky-600/50 bg-sky-500/12 text-sky-700'
    : 'border-sky-500/45 bg-sky-500/15 text-sky-100';
  if (props.status === 'stale') return light
    ? 'border-amber-600/50 bg-amber-500/12 text-amber-700'
    : 'border-amber-500/40 bg-amber-500/12 text-amber-100';
  if (props.status === 'connecting') return light
    ? 'border-violet-600/50 bg-violet-500/12 text-violet-700'
    : 'border-violet-500/35 bg-violet-500/12 text-violet-100';
  if (props.status === 'done') return light
    ? 'border-zinc-400/60 bg-zinc-500/10 text-zinc-600'
    : 'border-zinc-500/40 bg-zinc-500/15 text-zinc-300';
  if (props.status === 'disconnected') return 'border-border/70 bg-background/45 text-muted-foreground';
  // connected
  return light
    ? 'border-emerald-600/50 bg-emerald-500/12 text-emerald-700'
    : 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100';
});

</script>

<style scoped>
.header-button {
  display: inline-flex;
  height: 30px;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border-radius: 8px;
  border: 1px solid hsl(var(--border) / 0.8);
  background: hsl(var(--background) / 0.5);
  padding: 0 9px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.header-button:hover {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.75);
  color: hsl(var(--foreground));
}

.header-button-split {
  min-width: auto;
}

.header-icon {
  width: 15px;
  height: 15px;
  stroke-width: 2.1;
}
</style>
