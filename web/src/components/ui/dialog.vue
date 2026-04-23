<template>
  <div class="fixed inset-0 z-50" @click.self="$emit('close')">
    <div class="absolute inset-0 bg-black/32 backdrop-blur-sm" />
    <div class="fixed inset-0 z-10 grid grid-rows-[1fr_auto_3fr] justify-items-center p-4 max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12">
      <div :class="['relative row-start-2 flex w-full min-w-0 max-w-lg flex-col rounded-2xl border border-border/90 bg-card/95 text-card-foreground shadow-lg shadow-black/20', dialogClass]">
        <button
          v-if="showCloseButton"
          type="button"
          class="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          @click="$emit('close')"
        >
          ×
        </button>
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    showCloseButton?: boolean;
    dialogClass?: string;
  }>(),
  { showCloseButton: true, dialogClass: '' }
);

defineEmits<{ close: [] }>();
</script>
