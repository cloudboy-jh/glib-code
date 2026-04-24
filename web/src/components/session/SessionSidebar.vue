<template>
  <aside class="flex h-full flex-col bg-card/95 text-foreground">
    <div :class="['flex h-full flex-col', collapsed ? 'px-2 py-3' : 'px-3 py-3']">
      <div :class="['relative flex h-9 items-center justify-center']">
        <div v-if="!collapsed" class="min-w-0">
          <div class="flex min-w-0 items-center justify-center rounded-lg px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground">
            <div
              v-if="logoWordmarkSrc"
              class="logo-wordmark h-4 w-[112px] shrink-0"
              :style="{ '--logo-url': `url(${logoWordmarkSrc})` }"
              role="img"
              aria-label="glib-code"
            />
            <div v-else class="truncate text-sm font-medium tracking-tight text-foreground">glib-code</div>
          </div>
        </div>

        <div
          v-else
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground"
          aria-label="glib-code"
        >
          <div v-if="logoIconSrc" class="logo-icon h-5 w-5" :style="{ '--logo-url': `url(${logoIconSrc})` }" role="img" aria-label="glib-code icon" />
          <span v-else class="text-base font-semibold leading-none">g</span>
        </div>

        <button
          type="button"
          :class="[
            'inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            'absolute right-0 h-8 w-8'
          ]"
          @click="$emit('toggleCollapse')"
        >
          {{ collapsed ? '›' : '‹' }}
        </button>
      </div>

      <button
        v-if="!collapsed"
        type="button"
        :disabled="disabled"
        class="mt-3 mb-3 flex h-10 items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-3 text-left text-sm text-muted-foreground shadow-sm/5 transition-colors hover:bg-accent/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span class="text-sm">⌕</span>
        <span class="flex-1">Search sessions</span>
        <span class="rounded-md border border-border/70 bg-muted/70 px-1.5 py-0.5 text-[11px] text-muted-foreground">⌘K</span>
      </button>

      <div v-else class="mt-3 mb-3 flex justify-center">
        <button
          type="button"
          :disabled="disabled"
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-background/70 text-muted-foreground/80 shadow-sm/5 transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span class="text-sm">⌕</span>
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-auto">
        <div v-for="section in grouped" :key="section.label" class="mb-3">
          <div v-if="!collapsed" class="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
            {{ section.label }}
          </div>

          <div class="space-y-1">
            <button
              v-for="s in section.rows"
              :key="s.id"
              type="button"
              :disabled="disabled"
              :class="[
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                s.id === activeId
                  ? 'bg-accent text-foreground shadow-sm/5'
                  : 'text-foreground/92 hover:bg-accent/70'
              ]"
              @click="$emit('select', s.id)"
            >
              <span class="h-2 w-2 shrink-0 rounded-full" :class="s.status === 'Working' ? 'bg-sky-400' : 'bg-emerald-400'" />
              <template v-if="!collapsed">
                <span class="min-w-0 flex-1 truncate text-sm leading-none">{{ s.title }}</span>
                <span class="shrink-0 text-xs text-muted-foreground/80">{{ s.time }}</span>
              </template>
              <span v-else class="h-2 w-2 rounded-full bg-current/70 opacity-80" />
            </button>
          </div>
        </div>
      </div>

      <div class="mt-2 border-t border-border/70 pt-2">
        <button
          type="button"
          :class="[
            'flex items-center rounded-lg text-sm transition-colors',
            collapsed
              ? 'mx-auto mb-0.5 h-9 w-9 justify-center text-muted-foreground/70 hover:bg-accent hover:text-foreground'
              : 'mb-0.5 h-9 w-full gap-2 px-3 text-muted-foreground/75 hover:bg-accent hover:text-foreground'
          ]"
          @click="$emit('goHome')"
        >
          <span class="text-sm">⌂</span>
          <span v-if="!collapsed">Home</span>
        </button>
        <button
          type="button"
          :disabled="disabled"
          :class="[
            'flex items-center rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            collapsed
              ? 'mx-auto h-9 w-9 justify-center text-muted-foreground/70 hover:bg-accent hover:text-foreground'
              : 'mb-0.5 h-9 w-full gap-2 px-3 text-muted-foreground/75 hover:bg-accent hover:text-foreground'
          ]"
          @click="$emit('new')"
        >
          <span class="text-sm">+</span>
          <span v-if="!collapsed">New session</span>
        </button>
        <button
          type="button"
          :class="[
            'flex items-center rounded-lg text-sm transition-colors',
            collapsed
              ? 'mx-auto h-9 w-9 justify-center text-muted-foreground/70 hover:bg-accent hover:text-foreground'
              : 'h-9 w-full gap-2 px-3 text-muted-foreground/75 hover:bg-accent hover:text-foreground'
          ]"
          @click="$emit('openSettings')"
        >
          <span class="text-sm">⚙</span>
          <span v-if="!collapsed">Settings</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type SessionRow = {
  id: string;
  title: string;
  time: string;
  section: 'Now' | 'Today' | 'Yesterday' | 'Older';
  status: 'Working' | 'Completed';
};

const props = withDefaults(
  defineProps<{
    sessions: SessionRow[];
    activeId: string;
    collapsed?: boolean;
    logoWordmarkSrc?: string;
    logoIconSrc?: string;
    disabled?: boolean;
  }>(),
  { collapsed: false, disabled: false }
);

defineEmits<{ select: [id: string]; new: []; openSettings: []; toggleCollapse: []; goHome: [] }>();

const grouped = computed(() => {
  const order: SessionRow['section'][] = ['Now', 'Today', 'Yesterday', 'Older'];
  return order
    .map((label) => ({ label, rows: props.sessions.filter((s) => s.section === label) }))
    .filter((s) => s.rows.length > 0);
});
</script>

<style scoped>
.logo-wordmark,
.logo-icon {
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
</style>
