<template>
  <div class="mx-auto w-full max-w-3xl px-6" tabindex="0" @keydown="onPickerKeydown">
    <div class="mb-9 text-center">
      <div
        v-if="logoSrc"
        class="logo-wordmark mx-auto h-16 w-full max-w-[380px]"
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
        <button :class="['picker-row', pickerIndex === 0 ? 'picker-row-active' : '']" @click="emit('openProject')">
          <span class="picker-row-left"><FolderOpen class="h-4 w-4" /><span>Open Project</span></span>
          <span class="picker-kbd">Ctrl+O</span>
        </button>
        <button :class="['picker-row', pickerIndex === 1 ? 'picker-row-active' : '']" @click="emit('openClone')">
          <span class="picker-row-left"><GitBranch class="h-4 w-4" /><span>Clone Repository</span></span>
          <span class="picker-kbd">Ctrl+Shift+O</span>
        </button>
        <button :class="['picker-row', pickerIndex === 2 ? 'picker-row-active' : '']" @click="emit('openPalette')">
          <span class="picker-row-left"><Command class="h-4 w-4" /><span>Open Command Palette</span></span>
          <span class="picker-kbd">Ctrl+K</span>
        </button>
      </div>
    </section>

    <section v-if="authenticatedProviderCount === 0" class="mb-8 rounded-lg border border-border/70 bg-background/35 p-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-medium text-foreground">Agent setup</p>
          <p class="mt-1 text-xs text-muted-foreground">Optional for browsing projects and reviewing diffs. Add a key when you want the agent to work.</p>
        </div>
        <button class="text-xs text-primary underline underline-offset-2" @click="emit('openModel')">Settings</button>
      </div>
      <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[160px_1fr_auto]">
        <select v-model="providerDraft" class="h-9 rounded-md border border-border/70 bg-background px-2 text-xs">
          <option v-for="provider in providers" :key="provider.id" :value="provider.id">{{ provider.id }}</option>
        </select>
        <input
          v-model="apiKeyDraft"
          type="password"
          class="h-9 rounded-md border border-border/70 bg-background px-3 text-xs"
          placeholder="Paste API key"
        />
        <button class="h-9 rounded-md border border-border/80 bg-primary/90 px-3 text-xs font-semibold text-primary-foreground" @click="saveProviderKey">
          Save
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
        :active-index="pickerIndex"
        :active-offset="3"
        :pending-path="pendingProjectPath"
        :pending-name="pendingProjectName"
        :pending-mode="pendingMode"
        @open="emit('openRecent', $event)"
        @remove="emit('removeRecent', $event)"
        @forget="emit('forgetRecent', $event)"
        @select-mode="emit('selectProjectMode', $event)"
        @set-mode="pendingMode = $event"
        @cancel-mode="emit('cancelProjectMode')"
      />
    </section>

    <section class="mt-8">
      <div class="mb-3 flex items-center gap-3">
        <span class="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Home Controls</span>
        <div class="h-px flex-1 bg-border/80" />
      </div>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button class="picker-row !justify-start" @click="emit('openTheme')">
          <span class="picker-row-left"><Palette class="h-4 w-4" /><span>Theme</span></span>
        </button>
        <button class="picker-row !justify-start" @click="emit('openGittrix')">
          <span class="picker-row-left"><SlidersHorizontal class="h-4 w-4" /><span>GitTrix</span></span>
        </button>
        <button class="picker-row !justify-start" @click="emit('openModel')">
          <span class="picker-row-left"><Bot class="h-4 w-4" /><span>Model</span></span>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Bot, Command, FolderOpen, GitBranch, Palette, SlidersHorizontal } from 'lucide-vue-next';
import RecentList from './RecentList.vue';

const props = defineProps<{
  recents: Array<{ id: string; name: string; path: string; lastOpenedAt: string; status: 'ok' | 'missing_path' | 'missing_git' }>;
  providers: Array<{ id: string; hasAuth: boolean; modelIds: string[] }>;
  logoSrc?: string;
  pendingProjectPath?: string | null;
  pendingProjectName?: string;
  defaultOpenMode?: 'diff' | 'session';
}>();
const emit = defineEmits<{
  openProject: [];
  openClone: [];
  openPalette: [];
  openRecent: [path: string];
  removeRecent: [id: string];
  forgetRecent: [id: string];
  openTheme: [];
  openGittrix: [];
  openModel: [];
  providerAuthSave: [providerId: string, apiKey: string];
  selectProjectMode: [mode: 'diff' | 'session'];
  cancelProjectMode: [];
}>();

const pickerIndex = ref(0);
const pendingMode = ref<'diff' | 'session'>(props.defaultOpenMode ?? 'diff');
const providerDraft = ref('openrouter');
const apiKeyDraft = ref('');
const totalPickerRows = computed(() => 3 + props.recents.length);
const lastPickerIndex = computed(() => Math.max(totalPickerRows.value - 1, 0));
const authenticatedProviderCount = computed(() => props.providers.filter((provider) => provider.hasAuth).length);

watch(
  () => props.providers,
  (next) => {
    if (!next.length) return;
    if (!next.some((provider) => provider.id === providerDraft.value)) {
      providerDraft.value = next.find((provider) => provider.id === 'openrouter')?.id ?? next[0]?.id ?? 'openrouter';
    }
  },
  { immediate: true }
);

watch(totalPickerRows, (count) => {
  if (pickerIndex.value >= count) pickerIndex.value = Math.max(count - 1, 0);
});

watch(
  () => props.pendingProjectPath,
  (next) => {
    if (!next) {
      pickerIndex.value = 0;
      pendingMode.value = props.defaultOpenMode ?? 'diff';
    }
  }
);

function runPickerSelection(index: number) {
  if (index === 0) emit('openProject');
  else if (index === 1) emit('openClone');
  else if (index === 2) emit('openPalette');
  else if (index <= 2 + props.recents.length) {
    const recent = props.recents[index - 3];
    if (recent && recent.status === 'ok') emit('openRecent', recent.path);
  }
}

function onPickerKeydown(event: KeyboardEvent) {
  if (props.pendingProjectPath) {
    if (event.key === 'ArrowLeft' || event.key === 'h' || event.key === 'H') {
      event.preventDefault();
      pendingMode.value = 'diff';
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'l' || event.key === 'L') {
      event.preventDefault();
      pendingMode.value = 'session';
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      emit('selectProjectMode', pendingMode.value);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      emit('cancelProjectMode');
      return;
    }

    return;
  }

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

function saveProviderKey() {
  const key = apiKeyDraft.value.trim();
  if (!providerDraft.value || !key) return;
  emit('providerAuthSave', providerDraft.value, key);
  apiKeyDraft.value = '';
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
}

.picker-row {
  display: flex;
  height: 42px;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  border-radius: 8px;
  border: 1px solid transparent;
  background: hsl(var(--background) / 0.25);
  padding: 0 12px;
  color: hsl(var(--foreground));
}

.picker-row:hover {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.55);
}

.picker-row-active {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.7);
}

.picker-row-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
}

.picker-kbd {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
</style>
