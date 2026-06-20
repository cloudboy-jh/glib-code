<template>
  <UiDialog @close="$emit('close')">
    <div class="flex flex-col gap-2 p-6 pb-3">
      <h3 class="text-xl font-semibold leading-none">Clone Repository</h3>
      <p class="text-sm text-muted-foreground">Clone a remote repository, then choose whether to land in Diffs or Session.</p>
    </div>

    <div class="space-y-4 p-6 pt-1 pb-4">
      <div>
        <label class="mb-1.5 block text-xs font-medium text-muted-foreground">Repository URL</label>
        <UiInput :model-value="url" placeholder="https://github.com/org/repo.git" class="h-10 rounded-lg bg-background/70" @update:model-value="$emit('update:url', $event)" />
      </div>

      <div>
        <div class="mb-1.5 flex items-center justify-between">
          <label class="block text-xs font-medium text-muted-foreground">Destination folder</label>
          <UiButton v-if="canBrowseNative" variant="outline" class="h-7 px-2 text-xs" @click="browseNative">Native picker…</UiButton>
        </div>
        <DirectoryBrowser :start-path="destination" @update:path="$emit('update:destination', $event)" />
        <p class="mt-1.5 text-xs text-muted-foreground">Navigate to the folder to clone into. The repo lands in a new subfolder here.</p>
      </div>

      <div>
        <label class="mb-1.5 block text-xs font-medium text-muted-foreground">Open mode</label>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" class="inline-flex h-9 items-center justify-center gap-1.5 rounded border border-border/70 text-xs" :class="mode === 'diff' ? 'bg-muted/70 text-foreground' : 'text-muted-foreground'" @click="$emit('update:mode', 'diff')">
            <GitBranch class="h-3.5 w-3.5" />
            <span>Diff</span>
          </button>
          <button type="button" class="inline-flex h-9 items-center justify-center gap-1.5 rounded border border-border/70 text-xs" :class="mode === 'session' ? 'bg-muted/70 text-foreground' : 'text-muted-foreground'" @click="$emit('update:mode', 'session')">
            <MessageSquare class="h-3.5 w-3.5" />
            <span>Session</span>
          </button>
        </div>
      </div>

      <div v-if="error" class="rounded border border-red-500/35 bg-red-500/10 px-2.5 py-2 text-xs text-red-200">{{ error }}</div>

      <div class="flex justify-end gap-2 border-t border-border/70 pt-4">
        <UiButton variant="outline" @click="$emit('close')">Cancel</UiButton>
        <UiButton :disabled="!url.trim() || !destination.trim()" @click="$emit('clone', mode)">Clone</UiButton>
      </div>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import UiButton from '../ui/button.vue';
import UiDialog from '../ui/dialog.vue';
import UiInput from '../ui/input.vue';
import DirectoryBrowser from './DirectoryBrowser.vue';
import { GitBranch, MessageSquare } from 'lucide-vue-next';

defineProps<{ url: string; destination: string; mode: 'diff' | 'session'; error?: string }>();
const emit = defineEmits<{ close: []; clone: [mode: 'diff' | 'session']; 'update:url': [value: string]; 'update:destination': [value: string]; 'update:mode': [value: 'diff' | 'session'] }>();

// Desktop gets the OS-native picker as a shortcut; the server-driven
// DirectoryBrowser is the cross-platform path that always works (incl. browser).
const canBrowseNative = typeof window !== 'undefined' && Boolean(window.glibDesktop?.pickProjectDirectory);

async function browseNative() {
  const selected = await window.glibDesktop?.pickProjectDirectory();
  if (selected) emit('update:destination', selected);
}
</script>
