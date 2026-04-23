<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/60" @click.self="$emit('close')">
    <UiCard class="w-full max-w-lg rounded-xl border-border/90 bg-card/95 p-4">
      <div class="mb-3 flex items-center">
        <h3 class="text-sm font-semibold">Clone Repository</h3>
        <UiButton variant="ghost" size="sm" class="ml-auto" @click="$emit('close')">Close</UiButton>
      </div>

      <div class="space-y-3">
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">Repository URL</label>
          <UiInput :model-value="url" placeholder="https://github.com/org/repo.git" class="h-10" @update:model-value="$emit('update:url', $event)" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-muted-foreground">Destination path</label>
          <UiInput :model-value="destination" placeholder="C:/repos/repo" class="h-10" @update:model-value="$emit('update:destination', $event)" />
        </div>
      </div>

      <div class="mt-4 flex justify-end gap-2">
        <UiButton variant="outline" @click="$emit('close')">Cancel</UiButton>
        <UiButton @click="$emit('clone')">Clone</UiButton>
      </div>
    </UiCard>
  </div>
</template>

<script setup lang="ts">
import UiButton from '../ui/button.vue';
import UiCard from '../ui/card.vue';
import UiInput from '../ui/input.vue';

defineProps<{ url: string; destination: string }>();
defineEmits<{ close: []; clone: []; 'update:url': [value: string]; 'update:destination': [value: string] }>();
</script>
