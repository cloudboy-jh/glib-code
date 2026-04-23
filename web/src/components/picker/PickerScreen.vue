<template>
  <section class="panel">
    <h1>Open a project</h1>
    <div class="row">
      <input :value="openPath" @input="$emit('update:openPath', ($event.target as HTMLInputElement).value)" placeholder="Existing repo path" />
      <button @click="$emit('open')">Open existing</button>
    </div>
    <NewProjectDialog :parent="parent" :name="name" @update:parent="$emit('update:parent', $event)" @update:name="$emit('update:name', $event)" @create="$emit('create')" />
    <h2>Recent</h2>
    <RecentList :recents="recents" @open="$emit('openRecent', $event)" />
  </section>
</template>

<script setup lang="ts">
import NewProjectDialog from './NewProjectDialog.vue';
import RecentList from './RecentList.vue';

defineProps<{ openPath: string; parent: string; name: string; recents: Array<{ id: string; name: string; path: string; lastOpenedAt: string }> }>();
defineEmits<{ open: []; create: []; openRecent: [path: string]; 'update:openPath': [value: string]; 'update:parent': [value: string]; 'update:name': [value: string] }>();
</script>

<style scoped>
.panel{display:grid;gap:10px}.row{display:flex;gap:8px;align-items:center}input,button{background:#0c1220;color:#d6dbeb;border:1px solid #33415b;padding:6px 8px}
</style>
