<template>
  <div class="fixed inset-x-0 bottom-0 z-40 border-t border-border/90 bg-card/95">
    <div class="mx-auto max-w-[1400px] px-4 pb-3 pt-2">
      <div class="mb-2 flex items-center gap-2">
        <strong class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Terminal</strong>
        <span class="ml-auto" />
        <button class="h-7 rounded-md border border-border/80 bg-background/55 px-2 text-xs text-muted-foreground hover:text-foreground" @click="$emit('close')">
          Close
        </button>
      </div>

      <div class="grid gap-2 md:grid-cols-[1fr_auto]">
        <textarea
          :value="input"
          rows="3"
          class="terminal min-h-[84px] w-full resize-y rounded-md border border-input/80 bg-[hsl(var(--bg-sunken))]/80 px-3 py-2 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="command..."
          @input="$emit('update:input', ($event.target as HTMLTextAreaElement).value)"
        />
        <button class="h-9 rounded-md border border-border/80 bg-primary/90 px-4 text-xs font-semibold text-primary-foreground" @click="$emit('run')">Run</button>
      </div>

      <pre class="terminal mt-2 max-h-[180px] overflow-auto rounded-md border border-border/80 bg-[hsl(var(--bg-sunken))]/80 p-3 text-[12px] text-foreground/95">{{ output }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ input: string; output: string }>();
defineEmits<{ close: []; run: []; 'update:input': [value: string] }>();
</script>
