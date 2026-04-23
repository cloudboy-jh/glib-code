<template>
  <div class="row">
    <button class="ghost" @click="$emit('trigger', '/')">/</button>
    <button class="ghost" @click="$emit('trigger', '@')">@</button>
    <button class="ghost" @click="$emit('trigger', '#')">#</button>
    <span class="muted">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ text: string }>();
defineEmits<{ trigger: [k: '/' | '@' | '#'] }>();
</script>

<style scoped>
.row{display:flex;gap:8px;align-items:center}.ghost{background:transparent;border:1px solid #33415b;color:#d6dbeb;padding:6px 8px}.muted{color:#8e99b2}
</style>
