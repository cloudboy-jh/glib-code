<template>
  <div class="fixed inset-0 z-50" @click.self="$emit('close')">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
    <div :class="containerClass">
      <div :class="['relative flex w-full min-w-0 flex-col rounded-2xl border border-border/90 bg-card/95 text-card-foreground shadow-2xl shadow-black/45', maxWidthClass, props.dialogClass]">
        <button
          v-if="props.showCloseButton"
          type="button"
          class="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/80 bg-background/55 text-muted-foreground transition-colors hover:text-foreground"
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
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    showCloseButton?: boolean;
    dialogClass?: string;
    placement?: 'center' | 'top';
    size?: 'md' | 'lg' | 'xl';
  }>(),
  { showCloseButton: true, dialogClass: '', placement: 'center', size: 'md' }
);

defineEmits<{ close: [] }>();

const containerClass = computed(() => {
  if (props.placement === 'top') {
    return 'fixed inset-0 z-10 grid place-items-start px-4 pt-[12vh] max-sm:px-0 max-sm:pt-12';
  }
  return 'fixed inset-0 z-10 grid grid-rows-[1fr_auto_3fr] justify-items-center p-4 max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12';
});

const maxWidthClass = computed(() => {
  if (props.size === 'xl') return 'max-w-[760px]';
  if (props.size === 'lg') return 'max-w-[680px]';
  return 'max-w-lg';
});
</script>
