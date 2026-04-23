<template>
  <details v-if="text"><summary>Context attached</summary><pre>{{ text }}</pre></details>
</template>

<script setup lang="ts">
defineProps<{ text: string }>();
</script>
