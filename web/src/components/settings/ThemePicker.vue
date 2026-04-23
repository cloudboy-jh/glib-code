<template>
  <div>
    <label class="mb-1 block text-xs text-muted-foreground">Theme preset</label>
    <select
      :value="modelValue"
      class="h-9 w-full rounded-md border border-input/80 bg-card/80 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option>tokyo-night</option>
      <option>catppuccin-mocha</option>
      <option>gruvbox-dark</option>
      <option>nord</option>
    </select>
  </div>
</template>

<script setup lang="ts">
defineProps<{ modelValue: string }>();
defineEmits<{ 'update:modelValue': [value: string] }>();
</script>
