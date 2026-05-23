<template>
  <div class="space-y-1">
    <template v-for="(r, idx) in recents" :key="r.id">
      <div :class="['recent-row', activeIndex === activeOffset + idx ? 'recent-row-active' : '']">
        <button class="recent-row-open" @click="toggleModeCards(r.path)">
          <span class="recent-row-left">
            <Folder class="h-4 w-4" />
            <span class="min-w-0">
              <span class="block truncate">{{ r.name }}</span>
              <span v-if="r.status === 'missing_path'" class="recent-row-status">Missing path</span>
              <span v-else-if="r.status === 'missing_git'" class="recent-row-status">Not a git repo</span>
            </span>
          </span>
        </button>

        <span class="recent-row-actions">
          <button class="recent-row-action" type="button" title="Forget this project and remove glib metadata" @click="$emit('forget', r.id)">Forget</button>
        </span>
      </div>

      <div v-if="expandedPath === r.path" class="recent-mode-cards">
        <button
          :class="['recent-mode-button', hoveredMode === 'diff' ? 'recent-mode-button-active' : '']"
          type="button"
          @mouseenter="hoveredMode = 'diff'"
          @click="$emit('open', { name: r.name, path: r.path, mode: 'diff' })"
        >
          <span class="recent-mode-icon recent-mode-icon-primary"><GitBranch class="h-4 w-4" /></span>
          <span>
            <span class="recent-mode-label">Diffs</span>
            <span class="recent-mode-text">Review changes first</span>
          </span>
        </button>

        <button
          :class="['recent-mode-button', hoveredMode === 'session' ? 'recent-mode-button-active' : '']"
          type="button"
          @mouseenter="hoveredMode = 'session'"
          @click="$emit('open', { name: r.name, path: r.path, mode: 'session' })"
        >
          <span class="recent-mode-icon recent-mode-glyph">&gt;_</span>
          <span>
            <span class="recent-mode-label">Session</span>
            <span class="recent-mode-text">Start prompting now</span>
          </span>
        </button>
      </div>
    </template>

    <div v-if="recents.length === 0" class="rounded-md border border-dashed border-border/70 bg-background/25 px-3 py-5 text-center text-sm text-muted-foreground">
      No recent projects
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Folder } from 'lucide-vue-next';
import { GitBranch } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    recents: Array<{ id: string; name: string; path: string; lastOpenedAt: string; status: 'ok' | 'missing_path' | 'missing_git' }>;
    activeIndex?: number;
    activeOffset?: number;
  }>(),
  {
    activeIndex: -1,
    activeOffset: 0
  }
);
defineEmits<{
  open: [payload: { name: string; path: string; mode: 'diff' | 'session' }];
  forget: [id: string];
}>();

const expandedPath = ref<string | null>(null);
const hoveredMode = ref<'diff' | 'session'>('diff');

function toggleModeCards(path: string) {
  expandedPath.value = expandedPath.value === path ? null : path;
  hoveredMode.value = 'diff';
}
</script>

<style scoped>
.recent-row {
  display: flex;
  height: 42px;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  border-radius: 8px;
  border: 1px solid transparent;
  background: hsl(var(--background) / 0.25);
  padding: 0 12px;
  color: hsl(var(--foreground));
}

.recent-row-open {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  border-radius: 8px;
  color: inherit;
}

.recent-row:hover {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.55);
}

.recent-row-active {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.7);
}

.recent-row-left {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.recent-row-status {
  display: block;
  font-size: 11px;
  color: hsl(var(--muted-foreground) / 0.85);
}

.recent-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.recent-row-action {
  display: inline-flex;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  padding: 0 8px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.recent-row-action:hover {
  background: hsl(var(--muted) / 0.75);
  color: hsl(var(--foreground));
}

.recent-mode-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 6px 0 2px;
  padding: 0 2px;
}

.recent-mode-button {
  display: flex;
  min-height: 88px;
  align-items: flex-start;
  gap: 12px;
  border-radius: 9px;
  border: 1px solid hsl(var(--border) / 0.7);
  background: hsl(var(--background) / 0.25);
  padding: 14px;
  text-align: left;
  color: hsl(var(--foreground));
}

.recent-mode-button:hover,
.recent-mode-button-active {
  border-color: hsl(var(--primary) / 0.55);
  background: hsl(var(--primary) / 0.12);
}

.recent-mode-icon {
  display: inline-flex;
  height: 34px;
  width: 34px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
}

.recent-mode-glyph {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.recent-mode-icon-primary {
  background: hsl(var(--primary) / 0.14);
  color: hsl(var(--primary));
}

.recent-mode-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.recent-mode-text {
  display: block;
  margin-top: 2px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

</style>
