<template>
  <div class="shrink-0 px-3 pb-3 pt-1.5 sm:px-5 sm:pt-2">
    <div class="mx-auto w-full max-w-5xl rounded-[22px] border border-border/80 bg-card/90 p-2.5 shadow-sm shadow-black/10 sm:p-3">
      <ComposerInput
        ref="composerInputRef"
        :context="context"
        :model-value="prompt"
        @update:model-value="$emit('update:prompt', $event)"
        @send="$emit('send')"
        @execute-command="$emit('executeCommand', $event)"
      />

      <ComposerFooter :meta="meta" @send="$emit('send')" @open-commands="composerInputRef?.openCommandDialog()" />
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
  }>(),
  { meta: 'GPT-5.3 Codex · High · Full access' }
);

const emit = defineEmits<{ send: []; 'update:prompt': [value: string]; executeCommand: [value: string] }>();

function emitSend() {
  if (!props.prompt.trim()) return;
  emit('send');
}
</script>
