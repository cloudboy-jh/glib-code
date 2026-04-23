<template>
  <header class="flex h-[54px] items-center gap-3 border-b border-border/80 px-4">
    <div class="min-w-0 flex-1">
      <div class="truncate text-[15px] font-semibold tracking-tight">{{ title }}</div>
      <div class="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span class="rounded border border-border/80 px-1.5 py-0.5">{{ project }}</span>
        <span>{{ branch }}</span>
      </div>
    </div>

    <button class="h-8 rounded-md border border-border/80 bg-background/55 px-2.5 text-xs text-muted-foreground hover:text-foreground" @click="$emit('switchMode')">
      Diff
    </button>
    <button class="h-8 rounded-md border border-border/80 bg-background/55 px-2.5 text-xs text-muted-foreground hover:text-foreground" @click="$emit('openModel')">
      {{ model }}
    </button>
    <button class="h-8 rounded-md border border-border/80 bg-primary/90 px-2.5 text-xs font-semibold text-primary-foreground" @click="$emit('gitAction')">
      Commit + Push
    </button>
    <button class="h-8 w-8 rounded-md border border-border/80 bg-background/55 text-xs text-muted-foreground hover:text-foreground" @click="$emit('menu')">⋯</button>
  </header>
</template>

<script setup lang="ts">
defineProps<{ title: string; project: string; branch: string; model: string }>();
defineEmits<{ switchMode: []; openModel: []; gitAction: []; menu: [] }>();
</script>
