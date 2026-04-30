<template>
  <div class="border-b border-border/70 bg-card/65 px-4 py-2.5 sm:px-5">
    <div class="mx-auto flex w-full max-w-5xl items-center gap-2.5">
      <div class="min-w-0 flex-1">
        <div class="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/85">Session context</div>
        <div class="truncate text-xs text-foreground/95">{{ summary }}</div>
      </div>

      <button class="ctx-btn" @click="$emit('view')">View</button>
      <button class="ctx-btn" @click="$emit('backToDiffs')">Back to diffs</button>
      <button class="ctx-btn-danger" @click="$emit('remove')">Remove</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ summary: string }>();
defineEmits<{ view: []; remove: []; backToDiffs: [] }>();
</script>

<style scoped>
.ctx-btn {
  display: inline-flex;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid hsl(var(--border) / 0.75);
  background: hsl(var(--background) / 0.55);
  padding: 0 10px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.ctx-btn:hover {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.75);
  color: hsl(var(--foreground));
}

.ctx-btn-danger {
  display: inline-flex;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid hsl(0 60% 45% / 0.45);
  background: hsl(0 55% 23% / 0.2);
  padding: 0 10px;
  font-size: 11px;
  color: hsl(0 72% 77%);
}

.ctx-btn-danger:hover {
  background: hsl(0 55% 26% / 0.35);
}
</style>
