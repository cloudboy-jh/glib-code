<template>
  <div class="shrink-0 px-3 pb-3 pt-1.5 sm:px-5 sm:pt-2">
    <div class="mx-auto w-full max-w-5xl rounded-[22px] border border-border/80 bg-card/90 p-2.5 shadow-sm shadow-black/10 sm:p-3">
      <ComposerInput
        ref="composerInputRef"
        :context="context"
        :model-value="prompt"
        :disabled="disabled"
        @update:model-value="$emit('update:prompt', $event)"
        @send="$emit('send')"
        @execute-command="$emit('executeCommand', $event)"
      />

      <div v-if="contextChips.length" class="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
        <button
          v-for="chip in contextChips"
          :key="chip.id"
          type="button"
          class="inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-2 py-1 text-[11px] text-primary hover:bg-primary/15"
          :title="chip.label"
          @click="$emit('removeContextChip', chip.id)"
        >
          <span class="truncate">{{ chip.label }}</span>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <ComposerFooter :meta="meta" :disabled="disabled" @send="$emit('send')" @open-commands="composerInputRef?.openCommandDialog()" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ComposerFooter from './ComposerFooter.vue';
import ComposerInput from './ComposerInput.vue';

const composerInputRef = ref<{ openCommandDialog: () => void } | null>(null);

const props = withDefaults(
  defineProps<{
    context: string;
    prompt: string;
    meta?: string;
    contextChips?: Array<{ id: string; label: string }>;
    disabled?: boolean;
  }>(),
  { meta: 'GPT-5.3 Codex · High · Full access', contextChips: () => [], disabled: false }
);

const emit = defineEmits<{ send: []; 'update:prompt': [value: string]; executeCommand: [value: string]; removeContextChip: [id: string] }>();

function emitSend() {
  if (!props.prompt.trim()) return;
  emit('send');
}
</script>
