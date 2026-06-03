<template>
  <div class="relative">
    <textarea
      ref="textareaRef"
      :value="modelValue"
      :disabled="disabled"
      :rows="expanded ? 10 : 5"
      :placeholder="placeholderText"
      :class="[
        'w-full resize-none border-0 bg-transparent px-3 pb-2 pt-3 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60',
        expanded ? 'min-h-[240px]' : 'min-h-[132px]'
      ]"
      @input="onInput"
      @keydown="onKeydown"
    />

    <button
      type="button"
      class="absolute right-2 top-2 inline-flex h-8 items-center gap-1 rounded-md border border-border/70 bg-background/70 px-2 text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-muted/70 hover:text-foreground"
      @click="expanded = !expanded"
    >
      <component :is="expanded ? Minimize2 : Maximize2" class="h-3.5 w-3.5" />
      <span>{{ expanded ? 'Collapse' : 'Expand' }}</span>
    </button>

    <ComposerCommandMenu
      :open="commandMenuOpen"
      :items="filteredCommands"
      :highlighted-index="highlightedIndex"
      @select="selectCommand"
    />

    <ComposerCommandDialog
      v-if="commandDialogOpen"
      :items="categorizedCommands"
      @close="commandDialogOpen = false"
      @select="selectCommandFromDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Maximize2, Minimize2 } from 'lucide-vue-next';
import ComposerCommandDialog from './ComposerCommandDialog.vue';
import ComposerCommandMenu from './ComposerCommandMenu.vue';
import { getSlashCommands, parseCommandInput, type SlashCommand } from '../../composables/useSlashCommands';

const props = defineProps<{ modelValue: string; context?: string; disabled?: boolean; isRunning?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; send: []; executeCommand: [value: string, args?: string] }>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const highlightedIndex = ref(0);
const commandDialogOpen = ref(false);
const expanded = ref(false);

const placeholderText = computed(() => (props.context?.trim() ? 'Commit context preloaded · ready for changes' : 'Ask for follow-up changes or attach context'));

const allCommands = computed(() => getSlashCommands(props.isRunning));

const categorizedCommands = computed(() => allCommands.value);

const slashQuery = computed(() => {
  const trimmed = props.modelValue.trimStart();
  if (!trimmed.startsWith('/')) return null;
  return trimmed.slice(1);
});

const filteredCommands = computed(() => {
  const q = slashQuery.value;
  if (q === null) return [];
  if (!q) return allCommands.value;
  const query = q.toLowerCase().split(' ')[0];
  return allCommands.value.filter((cmd) =>
    cmd.value.includes(query) || cmd.label.toLowerCase().includes(query) || cmd.aliases?.some((alias) => alias.includes(query))
  );
});

const commandMenuOpen = computed(() => slashQuery.value !== null && filteredCommands.value.length > 0);

defineExpose({
  openCommandDialog() {
    commandDialogOpen.value = true;
  }
});

function selectCommand(cmd: SlashCommand) {
  const parsed = parseCommandInput(props.modelValue);
  const args = cmd.inlineArgs && parsed?.args ? parsed.args : undefined;
  emit('executeCommand', cmd.value, args);
  highlightedIndex.value = 0;
  commandDialogOpen.value = false;
}

function selectCommandFromDialog(value: string) {
  const cmd = allCommands.value.find((c) => c.value === value);
  if (cmd) selectCommand(cmd);
  textareaRef.value?.focus();
}

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
}

function onKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    commandDialogOpen.value = true;
    return;
  }

  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    if (props.disabled) return;
    if (commandMenuOpen.value) {
      const item = filteredCommands.value[highlightedIndex.value];
      if (item) selectCommand(item);
      return;
    }
    if (props.modelValue.trim()) emit('send');
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    if (props.disabled) return;
    if (props.modelValue.trim()) emit('send');
    return;
  }

  if (!commandMenuOpen.value) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    highlightedIndex.value = Math.min(highlightedIndex.value + 1, filteredCommands.value.length - 1);
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
    return;
  }

  if (event.key === 'Escape') {
    highlightedIndex.value = 0;
  }
}
</script>
