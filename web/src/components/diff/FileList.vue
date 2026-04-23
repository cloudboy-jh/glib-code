<template>
  <div class="box">
    <h3>Files</h3>
    <div class="list">
      <button class="item" :class="{selected:selectedPath===f.path}" v-for="f in files" :key="f.path" @click="$emit('select', f)">
        <span>{{ f.path }}</span><span class="muted">{{ f.stats }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ files: Array<{ path: string; stats: string }>; selectedPath?: string }>();
defineEmits<{ select: [file: { path: string; stats: string }] }>();
</script>

<style scoped>
.box{border:1px solid #2a3448;background:#111827;padding:10px}.list{display:grid;gap:4px}.item{display:flex;justify-content:space-between;padding:6px 8px;border:1px solid #36435b;background:#0f1522;color:#d6dbeb}
.selected{border-color:#6f86ff}.muted{color:#8e99b2}
</style>
