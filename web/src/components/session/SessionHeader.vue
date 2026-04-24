<template>
  <header class="flex h-[54px] items-center gap-3 border-b border-border/80 px-3 sm:px-4">
    <div class="min-w-0 flex-1">
      <div class="truncate text-[15px] font-semibold tracking-tight text-foreground">{{ title }}</div>
      <div class="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span class="rounded-md border border-border/80 bg-background/55 px-1.5 py-0.5">{{ project }}</span>
        <span>{{ branch }}</span>
      </div>
    </div>

    <div class="flex items-center gap-1.5">
      <div ref="diffMenuRoot" class="relative inline-flex items-center">
        <button class="header-button header-button-split rounded-r-none pr-2" @click="$emit('diffCurrent')">
          <GitCompare class="header-icon" />
          <span>Diff</span>
        </button>
        <button
          class="header-button header-button-split rounded-l-none border-l-0 px-2"
          :aria-expanded="diffMenuOpen"
          aria-label="Open diff actions"
          @click="diffMenuOpen = !diffMenuOpen"
        >
          <ChevronDown class="header-icon" />
        </button>

        <div
          v-if="diffMenuOpen"
          class="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[190px] overflow-hidden rounded-lg border border-border/80 bg-card/95 py-1 shadow-lg shadow-black/20"
        >
          <button class="menu-item" @click="onDiffMenuSelect('current')">
            <GitCompare class="menu-icon" />
            <span>Current session diff</span>
          </button>
          <button class="menu-item" @click="onDiffMenuSelect('commits')">
            <List class="menu-icon" />
            <span>Commits list</span>
          </button>
        </div>
      </div>

      <button class="header-button" @click="$emit('openModel')">
        <span>{{ model }}</span>
      </button>
      <button class="header-button header-button-primary" @click="$emit('gitAction')">
        <CloudUpload class="header-icon" />
        <span>Commit + Push</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { ChevronDown, CloudUpload, GitCompare, List } from 'lucide-vue-next';

defineProps<{ title: string; project: string; branch: string; model: string }>();
const emit = defineEmits<{ diffCurrent: []; diffCommits: []; openModel: []; gitAction: [] }>();

const diffMenuOpen = ref(false);
const diffMenuRoot = ref<HTMLElement | null>(null);

function onDiffMenuSelect(action: 'current' | 'commits') {
  diffMenuOpen.value = false;
  if (action === 'current') emit('diffCurrent');
  else emit('diffCommits');
}

function onWindowPointerDown(event: MouseEvent) {
  if (!diffMenuOpen.value) return;
  const root = diffMenuRoot.value;
  if (!root) return;
  if (!(event.target instanceof Node)) return;
  if (!root.contains(event.target)) diffMenuOpen.value = false;
}

onMounted(() => window.addEventListener('mousedown', onWindowPointerDown));
onUnmounted(() => window.removeEventListener('mousedown', onWindowPointerDown));
</script>

<style scoped>
.header-button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 8px;
  border: 1px solid hsl(var(--border) / 0.8);
  background: hsl(var(--background) / 0.55);
  padding: 0 10px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.header-button:hover {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.75);
  color: hsl(var(--foreground));
}

.header-button-split {
  min-width: auto;
}

.header-button-primary {
  background: hsl(var(--primary) / 0.9);
  color: hsl(var(--primary-foreground));
  font-weight: 600;
}

.header-button-primary:hover {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.header-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2.2;
}

.menu-icon {
  width: 15px;
  height: 15px;
  stroke-width: 2.2;
}

.menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  font-size: 12px;
  color: hsl(var(--foreground));
  background: transparent;
  border: 0;
  text-align: left;
  transition: background-color 0.15s ease;
}

.menu-item:hover {
  background: hsl(var(--accent) / 0.7);
}
</style>
