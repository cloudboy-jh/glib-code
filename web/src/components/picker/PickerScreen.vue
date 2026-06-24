<template>
  <div ref="pickerRoot" class="mx-auto w-full max-w-5xl px-6 outline-none" tabindex="0" @keydown="onPickerKeydown">
    <div class="mb-9 text-center">
      <div
        v-if="logoSrc"
        class="logo-wordmark mx-auto h-16 w-full max-w-[23.75rem]"
        :style="{ '--logo-url': `url(${logoSrc})` }"
        role="img"
        aria-label="glib-code"
      />
      <p class="mt-2 text-xs font-medium tracking-[0.01em] text-muted-foreground">Review changes first. Start sessions with context.</p>
    </div>

    <section class="mb-8">
      <div class="mb-3 flex items-center gap-3">
        <span class="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Get Started</span>
        <div class="h-px flex-1 bg-border/80" />
      </div>

      <div class="space-y-1">
        <button :class="['picker-row', pickerIndex === 0 ? 'picker-row-active' : '']" @click="emit('openProject')" @mouseenter="pickerIndex = 0">
          <span class="picker-row-left"><FolderOpen class="h-4 w-4" /><span>Open Project</span></span>
        </button>
        <button :class="['picker-row', pickerIndex === 1 ? 'picker-row-active' : '']" @click="emit('openClone')" @mouseenter="pickerIndex = 1">
          <span class="picker-row-left"><GitBranch class="h-4 w-4" /><span>Clone Repository</span></span>
        </button>
        <button :class="['picker-row', pickerIndex === 2 ? 'picker-row-active' : '']" @click="emit('openPalette')" @mouseenter="pickerIndex = 2">
          <span class="picker-row-left"><Command class="h-4 w-4" /><span>Open Command Palette</span></span>
        </button>
      </div>
    </section>

    <section>
      <div class="mb-3 flex items-center gap-3">
        <span class="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Recent Projects</span>
        <div class="h-px flex-1 bg-border/80" />
      </div>

      <RecentList
        :recents="recents"
        :sessions-by-path="sessionsByPath"
        :commits-by-path="commitsByPath"
        :active-index="pickerIndex"
        :active-offset="3"
        @open="emit('openRecent', $event)"
        @open-diff="emit('openRecentDiff', $event)"
        @continue-session="emit('continueRecentSession', $event)"
        @start-new-session="emit('startNewRecentSession', $event)"
        @forget="emit('forgetRecent', $event)"
        @fetch-commits="emit('fetchCommits', $event)"
      />
    </section>

    <section class="mt-8">
      <div class="mb-3 flex items-center gap-3">
        <span class="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Home Controls</span>
        <div class="h-px flex-1 bg-border/80" />
      </div>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-5">
        <button class="picker-row !justify-start" @click="emit('openSettings', 'Appearance')">
          <span class="picker-row-left"><Palette class="h-4 w-4" /><span>Theme</span></span>
        </button>
        <button class="picker-row !justify-start" @click="emit('openSettings', 'Integrations')">
          <span class="picker-row-left"><Code2 class="h-4 w-4" /><span>Editor</span></span>
        </button>
        <button class="picker-row !justify-start" @click="emit('openSettings', 'Git')">
          <span class="picker-row-left"><SlidersHorizontal class="h-4 w-4" /><span>GitTrix</span></span>
        </button>
        <button class="picker-row !justify-start" @click="emit('openSettings', 'Models')">
          <span class="picker-row-left"><Bot class="h-4 w-4" /><span>Model</span></span>
        </button>
        <button class="picker-row !justify-start" @click="emit('openSettings')">
          <span class="picker-row-left"><Settings class="h-4 w-4" /><span>Settings</span></span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { Bot, Code2, Command, FolderOpen, GitBranch, Palette, Settings, SlidersHorizontal } from 'lucide-vue-next';
import RecentList from './RecentList.vue';

const props = defineProps<{
  recents: Array<{ id: string; name: string; path: string; lastOpenedAt: string; status: 'ok' | 'missing_path' | 'missing_git' }>;
  sessionsByPath?: Record<string, Array<{ id: string; title: string; time: string; updatedAt?: string; status: 'connected' | 'connecting' | 'disconnected' | 'stale' | 'running' }>>;
  commitsByPath?: Record<string, Array<{ ref: string; shortRef: string; title: string }>>;
  logoSrc?: string;
}>();
const emit = defineEmits<{
  openProject: [];
  openClone: [];
  openPalette: [];
  openRecent: [payload: { name: string; path: string; mode: 'diff' | 'session' }];
  openRecentDiff: [payload: { name: string; path: string; source: 'uncommitted' | 'commit'; commitRef?: string }];
  continueRecentSession: [payload: { name: string; path: string; sessionId: string }];
  startNewRecentSession: [payload: { name: string; path: string }];
  forgetRecent: [id: string];
  openSettings: [tab?: 'Models' | 'Git' | 'Integrations' | 'Appearance'];
  fetchCommits: [path: string];
}>();

const pickerRoot = ref<HTMLElement | null>(null);
const pickerIndex = ref(0);
const totalPickerRows = computed(() => 3 + props.recents.length);
const lastPickerIndex = computed(() => Math.max(totalPickerRows.value - 1, 0));

watch(totalPickerRows, (count) => {
  if (pickerIndex.value >= count) pickerIndex.value = Math.max(count - 1, 0);
});

onMounted(() => {
  // Focus the container so keyboard navigation works without a click first.
  // Picker has no text inputs, so claiming focus here is safe.
  pickerRoot.value?.focus();
});

function runPickerSelection(index: number) {
  if (index === 0) emit('openProject');
  else if (index === 1) emit('openClone');
  else if (index === 2) emit('openPalette');
  else if (index <= 2 + props.recents.length) {
    const recent = props.recents[index - 3];
    if (recent && recent.status === 'ok') emit('openRecent', { name: recent.name, path: recent.path, mode: 'diff' });
  }
}

function onPickerKeydown(event: KeyboardEvent) {
  if (event.key === 'j' || event.key === 'J' || event.key === 'ArrowDown') {
    event.preventDefault();
    pickerIndex.value = Math.min(pickerIndex.value + 1, lastPickerIndex.value);
    return;
  }

  if (event.key === 'k' || event.key === 'K' || event.key === 'ArrowUp') {
    event.preventDefault();
    pickerIndex.value = Math.max(pickerIndex.value - 1, 0);
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    runPickerSelection(pickerIndex.value);
  }
}

</script>

<style scoped>
.logo-wordmark {
  background-color: hsl(var(--primary));
  -webkit-mask-image: var(--logo-url);
  mask-image: var(--logo-url);
  -webkit-mask-mode: luminance;
  mask-mode: luminance;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
  transition: opacity 0.2s ease, filter 0.2s ease;
}

.logo-wordmark:hover {
  opacity: 0.85;
  filter: drop-shadow(0 0 12px hsl(var(--primary) / 0.15));
}

.picker-row {
  position: relative;
  display: flex;
  height: 2.625rem;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  background: hsl(var(--background) / 0.25);
  padding: 0 0.75rem;
  color: hsl(var(--foreground));
  transition: transform 0.18s ease, border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.18s ease;
}

/* Leading accent bar — collapsed by default, expands on hover/selection. */
.picker-row::before {
  content: "";
  position: absolute;
  left: 0;
  top: 50%;
  height: 0;
  width: 0.1875rem;
  border-radius: 999px;
  background: hsl(var(--primary));
  transform: translateY(-50%);
  transition: height 0.16s ease, opacity 0.16s ease;
  opacity: 0;
}

.picker-row:hover {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.55);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px hsl(var(--primary) / 0.08);
}

.picker-row:active {
  transform: translateY(0);
  box-shadow: none;
}

.picker-row-active {
  border-color: hsl(var(--primary) / 0.55);
  background: hsl(var(--primary) / 0.08);
  box-shadow: inset 0 0 0 1px hsl(var(--primary) / 0.18);
}

.picker-row-active::before {
  height: 1.25rem;
  opacity: 1;
}

.picker-row-left {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 1.125rem;
}
</style>
