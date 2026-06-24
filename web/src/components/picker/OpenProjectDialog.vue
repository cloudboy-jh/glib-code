<template>
  <UiDialog @close="$emit('close')">
    <div class="flex flex-col gap-2 p-6 pb-3">
      <h3 class="text-xl font-semibold leading-none">Open Project</h3>
      <p class="text-sm text-muted-foreground">Enter a local repository path to open it in glib-code.</p>
    </div>

    <div class="space-y-4 p-6 pt-1 pb-4">
      <div class="rounded-xl border border-border/70 bg-background/35 p-3">
        <div class="mb-2 flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">Browse for a repository folder</p>
            <p class="mt-0.5 text-xs text-muted-foreground">Navigate to the repo, or search recents/zoxide below.</p>
          </div>
          <UiButton v-if="canBrowseNative" variant="outline" class="h-7 px-2 text-xs" @click="browseNative">Native picker…</UiButton>
        </div>
        <DirectoryBrowser :start-path="path" @update:path="$emit('update:path', $event)" />
      </div>

      <div>
        <label class="mb-1.5 block text-xs font-medium text-muted-foreground">Search projects</label>
        <UiInput :model-value="path" placeholder="Search recents/zoxide or paste a path" class="h-10 rounded-lg bg-background/70" @update:model-value="$emit('update:path', $event)" />
      </div>

      <div class="rounded-lg border border-border/70 bg-background/35 p-2">
        <div class="mb-2 flex items-center justify-between px-1 text-[0.6875rem] uppercase tracking-[0.12em] text-muted-foreground">
          <span>Project picker</span>
          <span>{{ candidates.length ? 'zoxide' : 'manual path' }}</span>
        </div>
        <div class="max-h-56 overflow-auto">
          <button
            v-for="candidate in filteredCandidates"
            :key="candidate.path"
            type="button"
            class="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60"
            @click="$emit('update:path', candidate.path)"
            @dblclick="$emit('open', { mode: 'diff' })"
          >
            <span class="min-w-0">
              <span class="block truncate text-foreground">{{ candidate.name }}</span>
              <span class="block truncate text-[0.6875rem] text-muted-foreground">{{ candidate.path }}</span>
            </span>
            <span class="shrink-0 rounded border border-border/60 px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">{{ candidate.source }}</span>
          </button>
          <div v-if="!filteredCandidates.length" class="px-2 py-5 text-center text-xs text-muted-foreground">No zoxide matches. Paste a path above.</div>
        </div>
      </div>

      <div class="flex justify-between gap-2 border-t border-border/70 pt-4">
        <UiButton variant="outline" @click="$emit('close')">Cancel</UiButton>
        <div class="flex gap-2">
          <UiButton variant="outline" @click="$emit('open', { mode: 'diff' })">Open in Diffs</UiButton>
          <UiButton @click="$emit('open', { mode: 'session' })">Open in Session</UiButton>
        </div>
      </div>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import UiButton from '../ui/button.vue';
import UiDialog from '../ui/dialog.vue';
import UiInput from '../ui/input.vue';
import DirectoryBrowser from './DirectoryBrowser.vue';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:4273/api';
const props = defineProps<{ path: string }>();
const emit = defineEmits<{ close: []; open: [payload: { mode: 'diff' | 'session' }]; 'update:path': [value: string] }>();

type Candidate = { name: string; path: string; source: string };
const candidates = ref<Candidate[]>([]);
// Desktop native picker as a shortcut; the server-driven DirectoryBrowser is
// the cross-platform path (works in the browser too).
const canBrowseNative = typeof window !== 'undefined' && Boolean(window.glibDesktop?.pickProjectDirectory);

const filteredCandidates = computed(() => {
  const q = props.path.trim().toLowerCase();
  if (!q) return candidates.value;
  return candidates.value.filter((candidate) => candidate.name.toLowerCase().includes(q) || candidate.path.toLowerCase().includes(q));
});

async function loadCandidates() {
  const q = props.path.trim();
  const response = await fetch(`${API_BASE}/projects/candidates${q ? `?q=${encodeURIComponent(q)}` : ''}`).catch(() => null);
  if (!response?.ok) return;
  candidates.value = await response.json();
}

async function browseNative() {
  const selected = await window.glibDesktop?.pickProjectDirectory();
  if (!selected) return;
  emit('update:path', selected);
}

let candidateTimer: number | undefined;
watch(() => props.path, () => {
  window.clearTimeout(candidateTimer);
  candidateTimer = window.setTimeout(() => void loadCandidates(), 150);
});

onMounted(() => void loadCandidates());
</script>
