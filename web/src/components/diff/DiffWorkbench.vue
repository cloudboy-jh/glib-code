<template>
  <section class="grid h-full grid-rows-[auto_auto_1fr] p-5">
    <div class="mb-3 flex items-center gap-2 rounded-md border border-border/80 bg-card/55 p-3">
      <label class="text-xs text-muted-foreground">Project</label>
      <select
        :value="selectedProjectId"
        class="h-8 min-w-[240px] rounded-md border border-input/80 bg-background/55 px-2 text-xs"
        @change="$emit('update:selectedProjectId', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>

      <label class="ml-3 text-xs text-muted-foreground">Commit</label>
      <select
        :value="selectedCommitId"
        class="h-8 min-w-[340px] rounded-md border border-input/80 bg-background/55 px-2 text-xs"
        @change="$emit('update:selectedCommitId', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="c in commits" :key="c.id" :value="c.id">{{ c.label }}</option>
      </select>

      <span class="ml-auto" />
      <div class="rounded-md border border-border/80 bg-background/55 p-0.5">
        <button
          :class="['h-7 rounded px-2 text-[11px]', diffStyle === 'split' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground']"
          @click="$emit('update:diffStyle', 'split')"
        >
          Split
        </button>
        <button
          :class="['h-7 rounded px-2 text-[11px]', diffStyle === 'unified' ? 'bg-muted/80 text-foreground' : 'text-muted-foreground']"
          @click="$emit('update:diffStyle', 'unified')"
        >
          Unified
        </button>
      </div>
    </div>

    <div class="mb-2 flex items-center text-xs text-muted-foreground">
      <span>{{ files.length }} changed files</span>
      <span class="mx-2">·</span>
      <span>{{ selectedFilePath || 'No file selected' }}</span>
    </div>

    <div class="grid min-h-0 grid-cols-[300px_1fr] gap-4">
      <div class="min-h-0 overflow-auto rounded-lg border border-border/80 bg-card/50 p-2">
        <button
          v-for="f in files"
          :key="f.path"
          :class="[
            'mb-1 flex h-10 w-full items-center justify-between rounded-md border px-2 text-left text-xs',
            selectedFilePath === f.path ? 'border-border bg-muted/80' : 'border-transparent hover:border-border/70 hover:bg-muted/55'
          ]"
          @click="$emit('update:selectedFilePath', f.path)"
        >
          <span class="truncate pr-2">{{ f.path }}</span>
          <span class="shrink-0 text-muted-foreground">{{ f.stats }}</span>
        </button>
      </div>

      <DiffView :patch="selectedPatch" :diff-style="diffStyle" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DiffView from '../shared/DiffView.vue';

type DiffFile = { path: string; stats: string; diff: string };
type DiffCommit = { id: string; label: string; files: DiffFile[] };
type DiffProject = { id: string; name: string; commits: DiffCommit[] };

const props = withDefaults(
  defineProps<{
    projects: DiffProject[];
    selectedProjectId: string;
    selectedCommitId: string;
    selectedFilePath: string;
    diffStyle?: 'split' | 'unified';
  }>(),
  {
    diffStyle: 'split'
  }
);

defineEmits<{
  'update:selectedProjectId': [value: string];
  'update:selectedCommitId': [value: string];
  'update:selectedFilePath': [value: string];
  'update:diffStyle': [value: 'split' | 'unified'];
}>();

const project = computed(() => props.projects.find((p) => p.id === props.selectedProjectId));
const commits = computed(() => project.value?.commits ?? []);
const commit = computed(() => commits.value.find((c) => c.id === props.selectedCommitId));
const files = computed(() => commit.value?.files ?? []);
const selectedPatch = computed(() => files.value.find((f) => f.path === props.selectedFilePath)?.diff ?? '');
</script>
