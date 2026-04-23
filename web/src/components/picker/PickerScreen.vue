<template>
  <div class="mx-auto w-full max-w-3xl px-6">
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

    <template v-if="pendingProject">
      <section class="mb-8">
        <div class="mb-4 text-center">
          <div class="text-sm font-semibold text-foreground">{{ pendingProject.name }}</div>
          <div class="mt-1 text-xs text-muted-foreground">Choose where to land for this project.</div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <button class="mode-card" @click="$emit('selectProjectMode', 'diff')">
            <span class="mode-card-icon mode-card-icon-primary"><GitBranch class="h-5 w-5" /></span>
            <span class="mode-card-title">Diffs</span>
            <span class="mode-card-text">Review changes first and enter the diff workbench.</span>
          </button>

          <button class="mode-card" @click="$emit('selectProjectMode', 'session')">
            <span class="mode-card-icon mode-card-glyph">&gt;_</span>
            <span class="mode-card-title">Session</span>
            <span class="mode-card-text">Jump straight into the session surface and start working.</span>
          </button>
        </div>

        <div class="mt-4 flex justify-center">
          <button class="picker-inline-button" @click="$emit('cancelProjectMode')">Cancel</button>
        </div>
      </section>
    </template>

    <template v-else>
    <section class="mb-8">
      <div class="mb-3 flex items-center gap-3">
        <span class="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Get Started</span>
        <div class="h-px flex-1 bg-border/80" />
      </div>

      <div class="space-y-1">
        <button class="picker-row" @click="$emit('openProject')">
          <span class="picker-row-left"><FolderOpen class="h-4 w-4" /><span>Open Project</span></span>
          <span class="picker-kbd">Ctrl+O</span>
        </button>
        <button class="picker-row" @click="$emit('openClone')">
          <span class="picker-row-left"><GitBranch class="h-4 w-4" /><span>Clone Repository</span></span>
          <span class="picker-kbd">Ctrl+Shift+O</span>
        </button>
        <button class="picker-row" @click="$emit('openPalette')">
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

      <RecentList :recents="recents" @open="$emit('openRecent', $event)" />
    </section>

    <section class="mt-8">
      <div class="mb-3 flex items-center gap-3">
        <span class="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Appearance</span>
        <div class="h-px flex-1 bg-border/80" />
      </div>

      <button class="picker-row" @click="$emit('openTheme')">
        <span class="picker-row-left"><Palette class="h-4 w-4" /><span>Theme</span></span>
        <span class="picker-kbd">Customize</span>
      </button>
    </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Command, FolderOpen, GitBranch, Palette } from 'lucide-vue-next';
import RecentList from './RecentList.vue';

defineProps<{
  recents: Array<{ id: string; name: string; path: string; lastOpenedAt: string }>;
  logoSrc?: string;
  pendingProject?: { name: string; path: string } | null;
}>();
defineEmits<{
  openProject: [];
  openClone: [];
  openPalette: [];
  openRecent: [path: string];
  openTheme: [];
  selectProjectMode: [mode: 'diff' | 'session'];
  cancelProjectMode: [];
}>();
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

.mode-card {
  display: flex;
  min-height: 168px;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  border-radius: 12px;
  border: 1px solid hsl(var(--border) / 0.8);
  background: hsl(var(--background) / 0.55);
  padding: 18px;
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.mode-card:hover {
  border-color: hsl(var(--border));
  background: hsl(var(--muted) / 0.7);
}

.mode-card-icon {
  display: inline-flex;
  height: 36px;
  width: 36px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 700;
}

.mode-card-glyph {
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: -0.03em;
}

.mode-card-icon-primary {
  background: hsl(var(--primary) / 0.14);
  color: hsl(var(--primary));
}

.mode-card-title {
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.mode-card-text {
  font-size: 14px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

.picker-inline-button {
  display: inline-flex;
  height: 32px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.picker-inline-button:hover {
  background: hsl(var(--muted) / 0.7);
  color: hsl(var(--foreground));
}
</style>
