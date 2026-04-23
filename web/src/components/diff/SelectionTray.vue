<template>
  <div class="tray">
    <span>{{ count }} hunks selected</span>
    <button :disabled="count===0" @click="$emit('add')">Add to current</button>
    <button :disabled="count===0" @click="$emit('new')">New session</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ count: number }>();
defineEmits<{ add: []; new: [] }>();
</script>

<style scoped>
.tray{display:flex;justify-content:flex-end;gap:8px;align-items:center}button{background:#0c1220;color:#d6dbeb;border:1px solid #33415b;padding:6px 8px}
</style>
