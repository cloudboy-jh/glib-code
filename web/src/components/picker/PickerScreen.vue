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
        <span class="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Appearance</span>
        <div class="h-px flex-1 bg-border/80" />
      </div>

      <button :class="['picker-row', pickerIndex === lastPickerIndex ? 'picker-row-active' : '']" @click="emit('openTheme')">
        <span class="picker-row-left"><Palette class="h-4 w-4" /><span>Theme</span></span>
        <span class="picker-kbd">Customize</span>
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Command, FolderOpen, GitBranch, Palette } from 'lucide-vue-next';
import RecentList from './RecentList.vue';

const props = defineProps<{
  recents: Array<{ id: string; name: string; path: string; lastOpenedAt: string; status: 'ok' | 'missing_path' | 'missing_git' }>;
  logoSrc?: string;
  pendingProjectPath?: string | null;
  pendingProjectName?: string;
}>();
const emit = defineEmits<{
  openProject: [];
  openClone: [];
  openPalette: [];
  openRecent: [path: string];
  removeRecent: [id: string];
  forgetRecent: [id: string];
  openTheme: [];
  selectProjectMode: [mode: 'diff' | 'session'];
  cancelProjectMode: [];
}>();

const pickerIndex = ref(0);
const pendingMode = ref<'diff' | 'session'>('diff');
const totalPickerRows = computed(() => 4 + props.recents.length);
const lastPickerIndex = computed(() => Math.max(totalPickerRows.value - 1, 0));

watch(totalPickerRows, (count) => {
  if (pickerIndex.value >= count) pickerIndex.value = Math.max(count - 1, 0);
});

watch(
  () => props.pendingProjectPath,
  (next) => {
    if (!next) {
      pickerIndex.value = 0;
      pendingMode.value = 'diff';
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
  } else emit('openTheme');
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
