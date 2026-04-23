<template>
  <textarea :value="modelValue" @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)" :rows="rows" :placeholder="placeholder" :class="cn('flex min-h-[80px] w-full rounded-lg border border-input/80 bg-card/80 px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring', $props.class)" />
</template>

<script setup lang="ts">
import { cn } from "../../lib/utils";
withDefaults(defineProps<{ modelValue: string; placeholder?: string; rows?: number; class?: string }>(), { rows: 4 });
defineEmits<{ 'update:modelValue': [value: string] }>();
</script>
