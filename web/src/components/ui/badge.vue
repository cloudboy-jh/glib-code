<template>
  <span :class="cn('inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground', $props.class)"><slot /></span>
</template>

<script setup lang="ts">
import { cn } from "../../lib/utils";
defineProps<{ class?: string }>();
</script>
