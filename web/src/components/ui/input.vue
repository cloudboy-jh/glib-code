<template>
  <input :value="modelValue" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" :placeholder="placeholder" :class="cn('flex h-9 w-full rounded-md border border-input/80 bg-card/80 px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring', $props.class)" />
</template>

<script setup lang="ts">
import { cn } from "../../lib/utils";
defineProps<{ modelValue: string; placeholder?: string; class?: string }>();
defineEmits<{ 'update:modelValue': [value: string] }>();
</script>
