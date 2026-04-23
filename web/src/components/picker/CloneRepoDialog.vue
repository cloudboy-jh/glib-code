<template>
  <UiDialog @close="$emit('close')">
    <div class="flex flex-col gap-2 p-6 pb-3">
      <h3 class="text-xl font-semibold leading-none">Clone Repository</h3>
      <p class="text-sm text-muted-foreground">Clone a remote repository, then choose whether to land in Diffs or Session.</p>
    </div>

    <div class="space-y-4 p-6 pt-1 pb-4">
      <div>
        <label class="mb-1.5 block text-xs font-medium text-muted-foreground">Repository URL</label>
        <UiInput :model-value="url" placeholder="https://github.com/org/repo.git" class="h-10 rounded-lg bg-background/70" @update:model-value="$emit('update:url', $event)" />
      </div>

      <div>
        <label class="mb-1.5 block text-xs font-medium text-muted-foreground">Destination path</label>
        <UiInput :model-value="destination" placeholder="C:/repos/repo" class="h-10 rounded-lg bg-background/70" @update:model-value="$emit('update:destination', $event)" />
      </div>

      <div class="flex justify-end gap-2 border-t border-border/70 pt-4">
        <UiButton variant="outline" @click="$emit('close')">Cancel</UiButton>
        <UiButton @click="$emit('clone')">Clone</UiButton>
      </div>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import UiButton from '../ui/button.vue';
import UiDialog from '../ui/dialog.vue';
import UiInput from '../ui/input.vue';

defineProps<{ url: string; destination: string }>();
defineEmits<{ close: []; clone: []; 'update:url': [value: string]; 'update:destination': [value: string] }>();
</script>
