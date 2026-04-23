<template>
  <div class="space-y-1">
    <button
      v-for="r in recents"
      :key="r.id"
      class="recent-row"
      @click="$emit('open', r.path)"
    >
      <span class="recent-row-left">
        <Folder class="h-4 w-4" />
        <span class="truncate">{{ r.name }}</span>
      </span>
    </button>

    <div v-if="recents.length === 0" class="rounded-md border border-dashed border-border/70 bg-background/25 px-3 py-5 text-center text-sm text-muted-foreground">
      No recent projects
    </div>
  </div>
</template>

<script setup lang="ts">
import { Folder } from 'lucide-vue-next';

defineProps<{ recents: Array<{ id: string; name: string; path: string; lastOpenedAt: string }> }>();
defineEmits<{ open: [path: string] }>();
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

.recent-row:hover {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.55);
}

.recent-row-left {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  font-size: 18px;
}

</style>
