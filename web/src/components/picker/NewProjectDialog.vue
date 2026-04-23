<template>
  <div class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
    <UiInput
      :model-value="parent"
      placeholder="Parent path"
      class="h-10"
      @update:model-value="$emit('update:parent', $event)"
    />
    <UiInput
      :model-value="name"
      placeholder="Project name"
      class="h-10"
      @update:model-value="$emit('update:name', $event)"
    />
    <UiButton class="h-10 px-4" @click="$emit('create')">Create</UiButton>
  </div>
</template>

<script setup lang="ts">
import UiButton from '../ui/button.vue';
import UiInput from '../ui/input.vue';

defineProps<{ parent: string; name: string }>();
defineEmits<{ create: []; 'update:parent': [value: string]; 'update:name': [value: string] }>();
</script>
