<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-stretch justify-center bg-black/55 p-4 sm:p-6" @click.self="$emit('close')">
    <div class="flex h-full max-h-[calc(100vh-2rem)] w-full max-w-[min(1500px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-2xl shadow-black/40 sm:max-h-[calc(100vh-3rem)]">
      <div class="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
        <div>
          <div class="text-sm font-medium">Session diff</div>
          <div class="mt-0.5 text-[11px] text-muted-foreground">
            <span v-if="loading">Loading…</span>
            <span v-else-if="error" class="text-red-300">{{ error }}</span>
            <span v-else-if="!diff.trim()">No changes</span>
            <span v-else>{{ filePatches.length }} file{{ filePatches.length === 1 ? '' : 's' }} changed</span>
          </div>
        </div>
        <button class="rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground" @click="$emit('close')">Close</button>
      </div>
      <template v-if="!loading && !error && diff.trim() && filePatches.length > 0">
        <div class="flex shrink-0 items-center gap-2 border-b border-border/70 px-4 py-2">
          <button
            class="h-7 rounded border border-border/70 px-2 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
            :disabled="selectedIndex <= 0"
            @click="selectFile(selectedIndex - 1)"
          >Prev</button>
          <div class="relative">
            <button
              type="button"
              class="inline-flex h-7 w-[260px] max-w-[420px] items-center gap-2 rounded border border-border/70 bg-background/70 px-2 text-[11px] text-foreground hover:bg-muted/50"
              :title="filePatches[selectedIndex]?.file || 'No file selected'"
              @click="fileMenuOpen = !fileMenuOpen"
            >
              <span class="min-w-0 flex-1 truncate text-left">{{ filePatches[selectedIndex]?.file || 'No file selected' }}</span>
              <ChevronDown class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
            <div v-if="fileMenuOpen" class="fixed inset-0 z-50 grid place-items-center bg-black/25 p-4" @click.self="fileMenuOpen = false">
              <div class="flex max-h-[min(72vh,560px)] w-[640px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-2xl shadow-black/40">
                <div class="flex items-center justify-between border-b border-border/70 px-3 py-2">
                  <div class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Select file</div>
                  <div class="text-[11px] text-muted-foreground">{{ filePatches.length }} files</div>
                </div>
                <div class="min-h-0 overflow-auto p-1">
                  <button
                    v-for="(entry, idx) in filePatches"
                    :key="entry.file"
                    :class="[
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] hover:bg-muted/70',
                      idx === selectedIndex ? 'bg-primary/20 text-primary' : 'text-foreground'
                    ]"
                    @click="selectFile(idx); fileMenuOpen = false"
                  >{{ entry.file }}</button>
                </div>
              </div>
            </div>
          </div>
          <button
            class="h-7 rounded border border-border/70 px-2 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
            :disabled="selectedIndex >= filePatches.length - 1"
            @click="selectFile(selectedIndex + 1)"
          >Next</button>
          <span class="ml-auto text-[11px] text-muted-foreground">{{ selectedIndex + 1 }} / {{ filePatches.length }}</span>
          <div class="rounded-md border border-border/80 bg-background/55 p-0.5">
            <button
              :class="['h-7 rounded px-2 text-[11px]', diffStyle === 'split' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground']"
              @click="$emit('update:diffStyle', 'split')"
            >Split</button>
            <button
              :class="['h-7 rounded px-2 text-[11px]', diffStyle === 'unified' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground']"
              @click="$emit('update:diffStyle', 'unified')"
            >Unified</button>
          </div>
        </div>
      </template>
      <div class="flex min-h-0 flex-1 overflow-hidden">
        <div class="min-h-0 flex-1 overflow-hidden p-3">
          <div v-if="loading" class="grid h-full place-items-center text-sm text-muted-foreground">Loading diff…</div>
          <div v-else-if="error" class="grid h-full place-items-center rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-100">{{ error }}</div>
          <div v-else-if="!diff.trim()" class="grid h-full place-items-center rounded-lg border border-border/70 text-sm text-muted-foreground">No session changes.</div>
          <DiffView v-else-if="filePatches.length > 0" :patch="filePatches[selectedIndex]?.patch ?? ''" :diff-style="diffStyle" :theme-type="themeType" :theme-preset="themePreset" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ChevronDown } from 'lucide-vue-next';
import DiffView from '../shared/DiffView.vue';
import type { ThemePreset } from '@glib-code/shared/theme/presets';

const props = defineProps<{
  open: boolean;
  diff: string;
  files: string[];
  focusFile: string;
  loading: boolean;
  error: string;
  diffStyle: 'split' | 'unified';
  themeType: 'dark' | 'light';
  themePreset: ThemePreset;
}>();

defineEmits<{
  close: [];
  'update:diffStyle': [value: 'split' | 'unified'];
}>();

const selectedIndex = ref(0);
const fileMenuOpen = ref(false);

interface FilePatch {
  file: string;
  patch: string;
}

function splitPatchByFile(fullPatch: string): FilePatch[] {
  if (!fullPatch.trim()) return [];
  const lines = fullPatch.split('\n');
  const entries: FilePatch[] = [];
  let current: string[] = [];
  let currentFile = '';

  for (const line of lines) {
    // git format: diff --git a/<file> b/<file>
    const gitMatch = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (gitMatch) {
      if (current.length) entries.push({ file: currentFile, patch: current.join('\n') });
      currentFile = (gitMatch[2] || gitMatch[1] || '').trim();
      current = [line];
      continue;
    }
    // unified diff format (from node `diff` library): Index: <file>
    const indexMatch = line.match(/^Index: (.+)$/);
    if (indexMatch) {
      if (current.length) entries.push({ file: currentFile, patch: current.join('\n') });
      currentFile = (indexMatch[1] || '').trim();
      current = [line];
      continue;
    }
    current.push(line);
  }
  if (current.length) entries.push({ file: currentFile, patch: current.join('\n') });

  return entries.filter((e) => e.file && e.patch.trim());
}

const filePatches = computed(() => splitPatchByFile(props.diff));

function selectFile(index: number) {
  selectedIndex.value = Math.max(0, Math.min(index, filePatches.value.length - 1));
}

function focusSelectedFile() {
  if (props.focusFile && filePatches.value.length) {
    const idx = filePatches.value.findIndex((f) => f.file === props.focusFile);
    selectedIndex.value = idx >= 0 ? idx : 0;
  } else {
    selectedIndex.value = 0;
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    focusSelectedFile();
    fileMenuOpen.value = false;
  }
});

// Refocus when the requested file changes while the overlay is already open.
watch(() => props.focusFile, () => {
  if (props.open) focusSelectedFile();
});

watch(filePatches, () => {
  if (selectedIndex.value >= filePatches.value.length) {
    selectedIndex.value = Math.max(0, filePatches.value.length - 1);
  }
});
</script>
