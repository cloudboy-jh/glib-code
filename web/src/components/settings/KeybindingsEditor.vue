<template>
  <div class="space-y-2">
    <div
      v-for="k in modelValue"
      :key="k.command"
      class="grid grid-cols-[minmax(0,1fr)_150px] items-center gap-3 rounded-lg border border-border/70 bg-background/45 px-4 py-3"
    >
      <div class="min-w-0">
        <p class="text-sm font-medium text-foreground/95">{{ labelFor(k.command) }}</p>
        <p class="text-xs text-muted-foreground">{{ k.command }}</p>
      </div>
      <input
        :value="k.key"
        class="h-9 rounded-md border border-input/80 bg-card/80 px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        @input="$emit('change', { command: k.command, key: ($event.target as HTMLInputElement).value })"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue: Array<{ command: string; key: string }> }>();
defineEmits<{ change: [payload: { command: string; key: string }] }>();

function labelFor(command: string) {
  const labels: Record<string, string> = {
    'palette.toggle': 'Command palette',
    'palette.open': 'Command palette',
    'terminal.toggle': 'Terminal drawer',
    'mode.diff': 'Diff mode',
    'mode.session': 'Session mode'
  };
  return labels[command] ?? command;
}
</script>
