<template>
  <header class="topbar">
    <button class="ghost" @click="$emit('openPicker')">glib-code</button>
    <span v-if="project">repo: {{ project.name }}</span>
    <span class="muted" v-if="project">{{ project.branch }}</span>
    <span class="spacer" />
    <button class="ghost" @click="$emit('openPalette')">⌘K</button>
  </header>
</template>

<script setup lang="ts">
defineProps<{ project: null | { name: string; branch: string } }>();
defineEmits<{ openPicker: []; openPalette: [] }>();
</script>

<style scoped>
.topbar{height:40px;border-bottom:1px solid #263042;display:flex;align-items:center;gap:10px;padding:0 12px}
.ghost{background:transparent;border:1px solid #33415b;color:#d6dbeb;padding:6px 8px}
.muted{color:#8e99b2}.spacer{flex:1}
</style>
