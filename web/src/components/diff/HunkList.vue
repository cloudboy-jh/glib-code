<template>
  <div class="box">
    <h3>Hunks</h3>
    <div class="list">
      <button class="item" v-for="h in hunks" :key="h.id" @click="$emit('toggle', h.id)">
        <span>{{ selected.has(h.id) ? '☑' : '☐' }} {{ h.header }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ hunks: Array<{ id: string; header: string }>; selected: Set<string> }>();
defineEmits<{ toggle: [id: string] }>();
</script>

<style scoped>
.box{border:1px solid #2a3448;background:#111827;padding:10px}.list{display:grid;gap:4px}.item{display:flex;padding:6px 8px;border:1px solid #36435b;background:#0f1522;color:#d6dbeb}
</style>
