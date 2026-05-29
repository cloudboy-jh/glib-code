<template>
  <header class="flex h-[52px] items-center gap-2.5 border-b border-border/80 px-3 sm:px-4">
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-medium tracking-tight text-foreground">{{ title }}</div>
      <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/85">
        <span class="rounded-md border border-border/80 bg-background/55 px-1.5 py-0.5 text-[10px]">{{ project }}</span>
        <span>{{ branch }}</span>
        <span class="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/45 px-1.5 py-0.5 text-[10px]">
          <span :class="['h-1.5 w-1.5 rounded-full', statusDotClass]" />
          {{ status }}
        </span>
      </div>
    </div>

    <div class="flex items-center gap-1.5">
      <OpenInEditor target="project" :preferred-editor="preferredEditor" :session-id="sessionId" @open-settings="$emit('openEditorSettings')" />
      <button class="header-button" @click="$emit('diffCurrent')">
        <GitCompare class="header-icon" />
        <span>Diff</span>
      </button>

      <button class="header-button" @click="$emit('openModel')">
        <span>{{ model }}</span>
      </button>
      <button class="header-button header-button-primary" @click="$emit('gitAction')">
        <CloudUpload class="header-icon" />
        <span>{{ gitActionLabel }}</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CloudUpload, GitCompare } from 'lucide-vue-next';
import OpenInEditor from '../shared/OpenInEditor.vue';

const props = withDefaults(defineProps<{ title: string; project: string; branch: string; model: string; status: 'connected' | 'connecting' | 'disconnected' | 'stale' | 'running'; gitActionLabel?: string; preferredEditor?: string | null; sessionId?: string }>(), {
  preferredEditor: null,
  gitActionLabel: 'Commit'
});
defineEmits<{ diffCurrent: []; diffCommits: []; openModel: []; gitAction: []; openEditorSettings: [] }>();

const statusDotClass = computed(() => {
  if (props.status === 'stale') return 'bg-amber-400';
  if (props.status === 'running') return 'bg-sky-400';
  if (props.status === 'connecting') return 'bg-violet-400';
  if (props.status === 'disconnected') return 'bg-zinc-500';
  return 'bg-emerald-400';
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

.header-button-primary {
  background: hsl(var(--primary) / 0.9);
  color: hsl(var(--primary-foreground));
  font-weight: 500;
}

.header-button-primary:hover {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.header-icon {
  width: 15px;
  height: 15px;
  stroke-width: 2.1;
}

.menu-icon {
  width: 15px;
  height: 15px;
  stroke-width: 2.2;
}

.menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12px;
  color: hsl(var(--foreground));
  background: transparent;
  border: 0;
  text-align: left;
  transition: background-color 0.15s ease;
}

.menu-item:hover {
  background: hsl(var(--accent) / 0.7);
}
</style>
