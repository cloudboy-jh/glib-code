<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/60" @click.self="$emit('close')">
    <UiCard class="w-full max-w-lg rounded-xl border-border/90 bg-card/95 p-4">
      <div class="mb-3 flex items-center">
        <h3 class="text-sm font-semibold">Open Project</h3>
        <UiButton variant="ghost" size="sm" class="ml-auto" @click="$emit('close')">Close</UiButton>
      </div>

      <label class="mb-1 block text-xs text-muted-foreground">Repository path</label>
      <UiInput :model-value="path" placeholder="C:/repos/my-repo" class="h-10" @update:model-value="$emit('update:path', $event)" />

      <div class="mt-4 flex justify-end gap-2">
        <UiButton variant="outline" @click="$emit('close')">Cancel</UiButton>
        <UiButton @click="$emit('open')">Open Project</UiButton>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import UiButton from '../ui/button.vue';
import UiCard from '../ui/card.vue';
import UiInput from '../ui/input.vue';

defineProps<{ path: string }>();
defineEmits<{ close: []; open: []; 'update:path': [value: string] }>();
</script>
