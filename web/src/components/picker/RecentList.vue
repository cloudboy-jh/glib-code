<template>
  <div class="list">
    <button class="item" v-for="r in recents" :key="r.id" @click="$emit('open', r.path)">
      <span>{{ r.name }}</span><span class="muted">{{ r.lastOpenedAt }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ recents: Array<{ id: string; name: string; path: string; lastOpenedAt: string }> }>();
defineEmits<{ open: [path: string] }>();
</script>

<style scoped>
.list{display:grid;gap:4px;max-height:300px;overflow:auto}.item{display:flex;justify-content:space-between;padding:6px 8px;border:1px solid #36435b;background:#0f1522;color:#d6dbeb}
.muted{color:#8e99b2}
</style>
