<template>
  <div class="rounded-xl border border-border/70 bg-background/35">
    <!-- Breadcrumb / current location -->
    <div class="flex items-center gap-2 border-b border-border/60 px-3 py-2">
      <button
        type="button"
        class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-40"
        :disabled="!current.parent || loading"
        title="Up one folder"
        aria-label="Up one folder"
        @click="navigate(current.parent)"
      >
        <ChevronUp class="h-4 w-4" />
      </button>
      <div class="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{{ current.path || '…' }}</div>
      <span v-if="loading" class="shrink-0 text-[0.625rem] uppercase tracking-[0.1em] text-muted-foreground/70">Loading…</span>
    </div>

    <!-- Folder list -->
    <div class="max-h-56 overflow-auto p-1.5">
      <button
        v-for="entry in current.entries"
        :key="entry.path"
        type="button"
        :class="[
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
          selectedPath === entry.path ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
        ]"
        @click="select(entry.path)"
        @dblclick="navigate(entry.path)"
      >
        <Folder class="h-4 w-4 shrink-0 opacity-70" />
        <span class="min-w-0 flex-1 truncate">{{ entry.name }}</span>
        <ChevronRight class="h-3.5 w-3.5 shrink-0 opacity-40" />
      </button>
      <div v-if="!loading && !current.entries.length" class="px-2 py-6 text-center text-xs text-muted-foreground">
        No subfolders here.
      </div>
    </div>

    <!-- New folder (optional) -->
    <div v-if="allowCreate" class="flex items-center gap-2 border-t border-border/60 px-3 py-2">
      <span class="shrink-0 text-[0.6875rem] text-muted-foreground">New folder:</span>
      <input
        v-model="newFolder"
        class="h-7 min-w-0 flex-1 rounded-md border border-input/70 bg-background/70 px-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="folder-name"
        @keydown.enter.prevent="applyNewFolder"
      />
    </div>

    <!-- Selected footer -->
    <div class="flex items-center gap-2 border-t border-border/60 px-3 py-2">
      <span class="shrink-0 text-[0.6875rem] text-muted-foreground">Selected:</span>
      <span class="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{{ effectivePath }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ChevronUp, ChevronRight, Folder } from 'lucide-vue-next';

type BrowseEntry = { name: string; path: string };
type BrowseResult = { path: string; parent: string | null; entries: BrowseEntry[] };

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:4273/api';

const props = withDefaults(
  defineProps<{
    // Initial directory to open at. Falls back to the server's home root.
    startPath?: string;
    // Show a "new folder" input that appends to the current dir.
    allowCreate?: boolean;
  }>(),
  { startPath: '', allowCreate: false }
);

// v-model:path — the resolved absolute path the consumer should use.
const emit = defineEmits<{ 'update:path': [value: string] }>();

const current = ref<BrowseResult>({ path: '', parent: null, entries: [] });
const selectedPath = ref('');
const newFolder = ref('');
const loading = ref(false);

// The path the consumer gets: current dir, optionally + a new-folder segment,
// or a selected subfolder.
const effectivePath = computed(() => {
  const base = selectedPath.value || current.value.path;
  const folder = newFolder.value.trim();
  if (props.allowCreate && folder) return `${base.replace(/\/$/, '')}/${folder}`;
  return base;
});

watch(effectivePath, (value) => emit('update:path', value), { immediate: false });

async function navigate(path: string | null) {
  loading.value = true;
  try {
    const query = path ? `?path=${encodeURIComponent(path)}` : '';
    const response = await fetch(`${API_BASE}/fs/browse${query}`).catch(() => null);
    if (!response?.ok) return;
    const data = (await response.json()) as BrowseResult & { ok: boolean };
    current.value = { path: data.path, parent: data.parent, entries: data.entries };
    selectedPath.value = '';
    emit('update:path', effectivePath.value);
  } finally {
    loading.value = false;
  }
}

function select(path: string) {
  // Single click selects the folder as the destination without entering it.
  selectedPath.value = selectedPath.value === path ? '' : path;
}

function applyNewFolder() {
  emit('update:path', effectivePath.value);
}

onMounted(() => void navigate(props.startPath || null));
</script>
