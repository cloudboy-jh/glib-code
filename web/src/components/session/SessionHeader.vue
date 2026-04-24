<template>
  <header class="flex h-[54px] items-center gap-3 border-b border-border/80 px-3 sm:px-4">
    <div class="min-w-0 flex-1">
      <div class="truncate text-[15px] font-semibold tracking-tight text-foreground">{{ title }}</div>
      <div class="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span class="rounded-md border border-border/80 bg-background/55 px-1.5 py-0.5">{{ project }}</span>
        <span>{{ branch }}</span>
      </div>
    </div>

    <div class="flex items-center gap-1.5">
    <button class="header-button" @click="$emit('switchMode')">
      Diff
    </button>
    <button class="header-button" @click="$emit('openModel')">
      {{ model }}
    </button>
    <button class="header-button header-button-primary" @click="$emit('gitAction')">
      Commit + Push
    </button>
    <button class="header-button header-button-icon" @click="$emit('menu')">⋯</button>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string; project: string; branch: string; model: string }>();
defineEmits<{ switchMode: []; openModel: []; gitAction: []; menu: [] }>();
</script>

<style scoped>
.header-button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid hsl(var(--border) / 0.8);
  background: hsl(var(--background) / 0.55);
  padding: 0 10px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.header-button:hover {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.75);
  color: hsl(var(--foreground));
}

.header-button-primary {
  background: hsl(var(--primary) / 0.9);
  color: hsl(var(--primary-foreground));
  font-weight: 600;
}

.header-button-primary:hover {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.header-button-icon {
  width: 32px;
  padding: 0;
  font-size: 14px;
}
</style>
