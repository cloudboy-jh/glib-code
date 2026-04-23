<template>
  <div class="row">
    <input :value="parent" @input="$emit('update:parent', ($event.target as HTMLInputElement).value)" placeholder="Parent path" />
    <input :value="name" @input="$emit('update:name', ($event.target as HTMLInputElement).value)" placeholder="Project name" />
    <button @click="$emit('create')">New project</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ parent: string; name: string }>();
defineEmits<{ create: []; 'update:parent': [value: string]; 'update:name': [value: string] }>();
</script>

<style scoped>
.row{display:flex;gap:8px;align-items:center}input,button{background:#0c1220;color:#d6dbeb;border:1px solid #33415b;padding:6px 8px}
</style>
