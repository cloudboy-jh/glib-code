<template>
  <div class="shrink-0 px-3 pb-2 pt-1 sm:px-4 sm:pt-1.5">
    <div class="mx-auto w-full max-w-4xl rounded-2xl border border-border/80 bg-card/90 p-2 shadow-sm shadow-black/10 sm:p-2.5">
      <!-- Input area — hidden while agent is running -->
      <template v-if="!isRunning">
        <ComposerInput
          ref="composerInputRef"
          :context="context"
          :model-value="prompt"
          :disabled="disabled"
          :is-running="isRunning"
          @update:model-value="$emit('update:prompt', $event)"
          @send="onSend"
          @execute-command="handleCommand"
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

        <div v-if="attachments.length" class="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
          <div
            v-for="file in attachments"
            :key="file.localId"
            class="inline-flex max-w-[320px] items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2 py-1 text-[11px]"
          >
            <span class="truncate" :title="file.name">{{ file.name }}</span>
            <span class="text-muted-foreground">{{ file.status }}</span>
            <button v-if="file.status === 'failed'" type="button" class="text-amber-300" @click="$emit('retryAttachment', file.localId)">retry</button>
            <button type="button" class="text-muted-foreground" @click="$emit('removeAttachment', file.localId)">×</button>
          </div>
        </div>
      </template>

      <ComposerFooter :meta="meta" :disabled="disabled" :is-running="isRunning" @send="onSend" @stop="$emit('stop')" @open-commands="composerInputRef?.openCommandDialog()" @attach="$emit('attach')" @tree="$emit('showTree')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ComposerFooter from './ComposerFooter.vue';
import ComposerInput from './ComposerInput.vue';

const composerInputRef = ref<{ openCommandDialog: () => void; reset: () => void } | null>(null);

const props = withDefaults(
  defineProps<{
    context: string;
    prompt: string;
    meta?: string;
    contextChips?: Array<{ id: string; label: string }>;
    attachments?: Array<{ localId: string; name: string; status: 'queued' | 'uploading' | 'uploaded' | 'failed' | 'removing' }>;
    disabled?: boolean;
    isRunning?: boolean;
  }>(),
  { meta: 'GPT-5.3 Codex · High · Full access', contextChips: () => [], attachments: () => [], disabled: false, isRunning: false }
);

const emit = defineEmits<{ send: []; stop: []; 'update:prompt': [value: string]; executeCommand: [value: string, args?: string]; removeContextChip: [id: string]; attach: []; showTree: []; removeAttachment: [id: string]; retryAttachment: [id: string] }>();

function handleCommand(value: string, args?: string) {
  emit('executeCommand', value, args);
}

function onSend() {
  if (!props.prompt.trim()) return;
  composerInputRef.value?.reset();
  emit('send');
}
</script>
