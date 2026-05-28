<template>
  <div class="inline-flex items-center gap-1.5">
    <button
      v-if="preferredEditor"
      type="button"
      class="inline-flex items-center gap-1.5 rounded border border-border/70 bg-background/70 px-2 py-1 text-[11px] text-foreground hover:bg-muted/60 transition-colors"
      :title="`Open in ${editorDisplayName}`"
      @click="openTarget()"
    >
      <EditorIcon :editor="preferredEditor" :size="14" />
      <span>Open</span>
    </button>
    
    <button
      v-else
      type="button"
      class="inline-flex items-center gap-1.5 rounded border border-border/70 bg-background/70 px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
      title="Set preferred editor in settings"
      @click="openSettings"
    >
      <Settings class="h-3.5 w-3.5" />
      <span>Set editor</span>
    </button>
    
    <button
      v-if="showObsidian && isMarkdown && preferredEditor !== 'obsidian'"
      type="button"
      class="inline-flex items-center gap-1.5 rounded border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[11px] text-purple-300 hover:bg-purple-500/20 transition-colors"
      title="Open in Obsidian"
      @click="openInObsidian"
    >
      <EditorIcon editor="obsidian" :size="14" />
      <span>Obsidian</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Settings } from 'lucide-vue-next';
import EditorIcon from './EditorIcon.vue';

const props = defineProps<{
  target?: 'file' | 'project';
  filePath?: string;
  preferredEditor: string | null;
  showObsidian?: boolean;
}>();

const emit = defineEmits<{
  'open-settings': [];
}>();

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:4273/api';

const isMarkdown = computed(() => {
  const path = (props.filePath ?? '').toLowerCase();
  return path.endsWith('.md') || path.endsWith('.markdown') || path.endsWith('.mdx');
});

const editorDisplayName = computed(() => {
  const names: Record<string, string> = {
    'vscode': 'VS Code',
    'cursor': 'Cursor',
    'zed': 'Zed',
    'obsidian': 'Obsidian'
  };
  return names[props.preferredEditor ?? ''] || props.preferredEditor || '';
});

async function openTarget(editor?: string) {
  const target = props.target ?? 'file';
  if (!editor && !props.preferredEditor) return;
  if (target === 'file' && !props.filePath) return;
  
  try {
    const response = await fetch(`${API_BASE}/open/editor`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ target, path: props.filePath, editor })
    });

    const result = await response.json();
    
    if (!result.ok) {
      alert(`Failed to open file: ${result.message}`);
    }
  } catch (error) {
    alert(`Error opening file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function openInObsidian() {
  await openTarget('obsidian');
}

function openSettings() {
  emit('open-settings');
}
</script>
