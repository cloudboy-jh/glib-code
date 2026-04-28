<template>
  <div class="space-y-1">
    <template v-for="(r, idx) in recents" :key="r.id">
      <div :class="['recent-row', activeIndex === activeOffset + idx ? 'recent-row-active' : '']">
        <button class="recent-row-open" @click="$emit('open', r.path)">
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
          <button class="recent-row-action" type="button" @click="$emit('remove', r.id)">Remove</button>
          <button class="recent-row-action" type="button" @click="$emit('forget', r.id)">Forget</button>
        </span>
      </div>

      <div v-if="pendingPath && pendingPath === r.path" class="recent-mode-popover">
        <div class="recent-mode-head">
          <div class="recent-mode-title">Open {{ pendingName || r.name }} as</div>
          <button class="recent-mode-cancel" type="button" @click="$emit('cancelMode')">Cancel</button>
        </div>
        <div class="recent-mode-actions">
          <button
            :class="['recent-mode-button', pendingMode === 'diff' ? 'recent-mode-button-active' : '']"
            type="button"
            @mouseenter="$emit('setMode', 'diff')"
            @click="$emit('selectMode', 'diff')"
          >
            <span class="recent-mode-icon recent-mode-icon-primary"><GitBranch class="h-4 w-4" /></span>
            <span>
              <span class="recent-mode-label">Diffs</span>
              <span class="recent-mode-text">Review changes first</span>
            </span>
          </button>
          <button
            :class="['recent-mode-button', pendingMode === 'session' ? 'recent-mode-button-active' : '']"
            type="button"
            @mouseenter="$emit('setMode', 'session')"
            @click="$emit('selectMode', 'session')"
          >
            <span class="recent-mode-icon recent-mode-glyph">&gt;_</span>
            <span>
              <span class="recent-mode-label">Session</span>
              <span class="recent-mode-text">Start prompting now</span>
            </span>
          </button>
        </div>
      </div>
    </template>

    <div v-if="recents.length === 0" class="rounded-md border border-dashed border-border/70 bg-background/25 px-3 py-5 text-center text-sm text-muted-foreground">
      No recent projects
    </div>
  </div>
</template>

<script setup lang="ts">
import { Folder, GitBranch } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    recents: Array<{ id: string; name: string; path: string; lastOpenedAt: string; status: 'ok' | 'missing_path' | 'missing_git' }>;
    activeIndex?: number;
    activeOffset?: number;
    pendingPath?: string | null;
    pendingName?: string;
    pendingMode?: 'diff' | 'session';
  }>(),
  {
    activeIndex: -1,
    activeOffset: 0,
    pendingPath: null,
    pendingName: '',
    pendingMode: 'diff'
  }
);
defineEmits<{
  open: [path: string];
  remove: [id: string];
  forget: [id: string];
  selectMode: [mode: 'diff' | 'session'];
  setMode: [mode: 'diff' | 'session'];
  cancelMode: [];
}>();
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

.recent-mode-popover {
  margin-left: 12px;
  margin-top: -2px;
  margin-bottom: 8px;
  width: min(100%, 460px);
  padding: 4px 0 0;
}

.recent-mode-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.recent-mode-title {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.recent-mode-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.recent-mode-button {
  display: flex;
  min-height: 68px;
  align-items: flex-start;
  gap: 10px;
  border-radius: 9px;
  border: 1px solid hsl(var(--border) / 0.7);
  padding: 10px;
  text-align: left;
  color: hsl(var(--foreground));
}

.recent-mode-button-active {
  border-color: hsl(var(--primary) / 0.55);
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
}

.recent-mode-icon {
  display: inline-flex;
  height: 28px;
  width: 28px;
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
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.recent-mode-text {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.recent-mode-cancel {
  height: 24px;
  border-radius: 7px;
  padding: 0 6px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.recent-mode-cancel:hover {
  background: hsl(var(--muted) / 0.7);
  color: hsl(var(--foreground));
}

</style>
