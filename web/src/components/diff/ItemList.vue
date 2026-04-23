<template>
  <div class="box">
    <h3>Items</h3>
    <div class="list">
      <button class="item" :class="{selected:selectedId===i.id}" v-for="i in items" :key="i.id" @click="$emit('select', i)">
        <span>{{ i.title }}</span><span class="muted">{{ i.meta }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ items: Array<{ id: string; title: string; meta: string }>; selectedId?: string }>();
defineEmits<{ select: [item: { id: string; title: string; meta: string }] }>();
</script>

<style scoped>
.box{border:1px solid #2a3448;background:#111827;padding:10px}.list{display:grid;gap:4px}.item{display:flex;justify-content:space-between;padding:6px 8px;border:1px solid #36435b;background:#0f1522;color:#d6dbeb}
.selected{border-color:#6f86ff}.muted{color:#8e99b2}
</style>
