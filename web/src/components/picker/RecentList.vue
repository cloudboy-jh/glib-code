<template>
  <div class="space-y-1">
    <div
      v-for="(r, idx) in recents"
      :key="r.id"
      :class="['recent-row', activeIndex === activeOffset + idx ? 'recent-row-active' : '']"
    >
      <button class="recent-row-open" :disabled="r.status !== 'ok'" @click="$emit('open', r.path)">
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

    <div v-if="recents.length === 0" class="rounded-md border border-dashed border-border/70 bg-background/25 px-3 py-5 text-center text-sm text-muted-foreground">
      No recent projects
    </div>
  </div>
</template>

<script setup lang="ts">
import { Folder } from 'lucide-vue-next';

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
defineEmits<{ open: [path: string]; remove: [id: string]; forget: [id: string] }>();
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

.recent-row-open:disabled {
  opacity: 0.7;
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

</style>
