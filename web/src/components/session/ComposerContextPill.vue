<template>
  <div class="max-w-full px-1 text-[12px] text-muted-foreground/90">
    <span class="truncate">Commit context preloaded · ready for changes</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ context: string }>();
</script>
