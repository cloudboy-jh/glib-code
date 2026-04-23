<template>
  <UiDialog @close="$emit('close')">
    <div class="flex flex-col gap-2 p-6 pb-3">
      <h3 class="text-xl font-semibold leading-none">Open Project</h3>
      <p class="text-sm text-muted-foreground">Enter a local repository path to open it in glib-code.</p>
    </div>

    <div class="space-y-4 p-6 pt-1 pb-4">
      <div>
        <label class="mb-1.5 block text-xs font-medium text-muted-foreground">Repository path</label>
        <UiInput :model-value="path" placeholder="C:/repos/my-repo" class="h-10 rounded-lg bg-background/70" @update:model-value="$emit('update:path', $event)" />
      </div>

      <div class="flex justify-end gap-2 border-t border-border/70 pt-4">
        <UiButton variant="outline" @click="$emit('close')">Cancel</UiButton>
        <UiButton @click="$emit('open')">Open Project</UiButton>
      </div>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import UiButton from '../ui/button.vue';
import UiDialog from '../ui/dialog.vue';
import UiInput from '../ui/input.vue';

defineProps<{ path: string }>();
defineEmits<{ close: []; open: []; 'update:path': [value: string] }>();
</script>
