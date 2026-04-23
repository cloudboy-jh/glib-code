<template>
  <div class="border-t border-border/80 px-6 pb-4 pt-3">
    <div class="mx-auto max-w-5xl rounded-2xl border border-border/80 bg-card/55 p-3">
      <div v-if="context" class="mb-3 rounded-md border border-border/80 bg-background/45 px-2.5 py-1.5 text-xs text-muted-foreground">
        Context: {{ context }}
      </div>

      <UiTextarea
        :model-value="prompt"
        :rows="4"
        placeholder="Ask for follow-up changes or attach context"
        class="min-h-[108px] resize-none rounded-xl border-input/80 bg-[hsl(var(--bg-sunken))]/80 text-[14px]"
        @update:model-value="$emit('update:prompt', $event)"
      />

      <div class="mt-3 flex items-center justify-between">
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <button class="rounded-md border border-border/80 bg-background/45 px-2 py-1" @click="$emit('trigger', '/')">/</button>
          <button class="rounded-md border border-border/80 bg-background/45 px-2 py-1" @click="$emit('trigger', '@')">@</button>
          <button class="rounded-md border border-border/80 bg-background/45 px-2 py-1" @click="$emit('trigger', '#')">#</button>
          <span class="pl-1">{{ meta }}</span>
        </div>

        <UiButton class="h-9 rounded-full px-4" @click="$emit('send')">Send</UiButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import UiButton from '../ui/button.vue';
import UiTextarea from '../ui/textarea.vue';

withDefaults(
  defineProps<{
    context: string;
    prompt: string;
    meta?: string;
  }>(),
  { meta: 'GPT-5.3 Codex · High · Full access' }
);

defineEmits<{ send: []; trigger: [k: '/' | '@' | '#']; 'update:prompt': [value: string] }>();
</script>
