<template>
  <div class="tabs">
    <button v-for="s in sources" :key="s" :class="{active: s===source}" @click="$emit('change', s)">{{ s }}</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ source: string; sources: string[] }>();
defineEmits<{ change: [source: string] }>();
</script>

<style scoped>
.tabs{display:flex;gap:8px}button{background:#0c1220;color:#d6dbeb;border:1px solid #33415b;padding:6px 8px}.active{border-color:#6f86ff}
</style>
