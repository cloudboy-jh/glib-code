<template>
  <div class="relative">
    <textarea
      ref="textareaRef"
      :value="modelValue"
      :rows="expanded ? 10 : 5"
      :placeholder="placeholderText"
      :class="[
        'w-full resize-none border-0 bg-transparent px-3 pb-2 pt-3 text-[15px] leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none',
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
      :items="slashCommands"
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

const props = defineProps<{ modelValue: string; context?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string]; send: []; executeCommand: [value: string] }>();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const highlightedIndex = ref(0);
const commandDialogOpen = ref(false);
const expanded = ref(false);

const placeholderText = computed(() => (props.context?.trim() ? 'Commit context preloaded · ready for changes' : 'Ask for follow-up changes or attach context'));

const slashCommands = [
  { id: 'cmd-help', value: 'help', label: 'Help', description: 'Show available composer and app commands.' },
  { id: 'cmd-models', value: 'models', label: 'Models', description: 'Open the model picker.', aliases: ['model'] },
  { id: 'cmd-themes', value: 'themes', label: 'Themes', description: 'Open the theme picker.', aliases: ['theme'] },
  { id: 'cmd-new', value: 'new', label: 'New session', description: 'Start a fresh session.', aliases: ['clear'] },
  { id: 'cmd-sessions', value: 'sessions', label: 'Sessions', description: 'Browse or switch sessions.', aliases: ['resume', 'continue'] },
  { id: 'cmd-diff', value: 'diff', label: 'Switch to diffs', description: 'Jump to the diff review surface.' },
  { id: 'cmd-session', value: 'session', label: 'Switch to session', description: 'Stay in the session workspace.' },
  { id: 'cmd-undo', value: 'undo', label: 'Undo', description: 'Undo the previous step.' },
  { id: 'cmd-redo', value: 'redo', label: 'Redo', description: 'Redo the last undone step.' },
  { id: 'cmd-share', value: 'share', label: 'Share', description: 'Share the current session.' },
  { id: 'cmd-init', value: 'init', label: 'Initialize', description: 'Initialize workspace guidance.' }
];

const slashQuery = computed(() => {
  const trimmed = props.modelValue.trimStart();
  if (!trimmed.startsWith('/')) return null;
  return trimmed.slice(1);
});

const filteredCommands = computed(() => {
  const q = slashQuery.value;
  if (q === null) return [];
  if (!q) return slashCommands;
  return slashCommands.filter((command) => {
    const query = q.toLowerCase();
    return command.value.includes(query) || command.label.toLowerCase().includes(query) || command.aliases?.some((alias) => alias.includes(query));
  });
});

const commandMenuOpen = computed(() => slashQuery.value !== null && filteredCommands.value.length > 0);

const commandLookup = computed(() => {
  const entries = new Map<string, string>();
  for (const command of slashCommands) {
    entries.set(command.value, command.value);
    command.aliases?.forEach((alias) => entries.set(alias, command.value));
  }
  return entries;
});

defineExpose({
  openCommandDialog() {
    commandDialogOpen.value = true;
  }
});

function selectCommand(value: string) {
  emit('executeCommand', value);
  highlightedIndex.value = 0;
  commandDialogOpen.value = false;
}

function selectCommandFromDialog(value: string) {
  selectCommand(value);
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
    if (commandMenuOpen.value) {
      const item = filteredCommands.value[highlightedIndex.value];
      if (item) selectCommand(item.value);
      return;
    }
    if (props.modelValue.trim()) emit('send');
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
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
