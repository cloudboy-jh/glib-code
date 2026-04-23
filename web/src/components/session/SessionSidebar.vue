<template>
  <aside :class="['border-r border-border/80 bg-card/60', collapsed ? 'w-[76px]' : 'w-[320px]']">
    <div class="flex h-full flex-col p-3">
      <div class="mb-3 flex items-center gap-2 px-1">
        <div
          v-if="!collapsed && logoWordmarkSrc"
          class="logo-wordmark h-8 w-[150px]"
          :style="{ '--logo-url': `url(${logoWordmarkSrc})` }"
          role="img"
          aria-label="glib-code"
        />
        <div
          v-else-if="logoIconSrc"
          class="logo-icon h-8 w-8"
          :style="{ '--logo-url': `url(${logoIconSrc})` }"
          role="img"
          aria-label="glib-code icon"
        />
        <button v-else class="grid h-8 w-8 place-items-center rounded-md border border-border/80 bg-muted/50 text-xs text-foreground">▢</button>
        <div v-if="!collapsed && !logoWordmarkSrc" class="truncate text-sm font-semibold">glib-code</div>
        <button
          class="ml-auto rounded-md border border-border/80 bg-background/50 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
          @click="$emit('toggleCollapse')"
        >
          {{ collapsed ? '›' : '‹' }}
        </button>
      </div>

      <button
        v-if="!collapsed"
        :disabled="disabled"
        class="mb-3 flex h-9 items-center gap-2 rounded-md border border-border/80 bg-background/45 px-3 text-left text-sm text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>⌕</span>
        <span class="flex-1">Search sessions</span>
        <span class="text-[10px]">⌘K</span>
      </button>

      <div class="min-h-0 flex-1 overflow-auto pr-1">
        <div v-for="section in grouped" :key="section.label" class="mb-4">
          <div v-if="!collapsed" class="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
            {{ section.label }}
          </div>

          <div class="space-y-1">
            <button
              v-for="s in section.rows"
              :key="s.id"
              :disabled="disabled"
              :class="[
                'flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left transition',
                s.id === activeId
                  ? 'border-border bg-muted/80'
                  : 'border-transparent hover:border-border/60 hover:bg-muted/55'
              ]"
              @click="$emit('select', s.id)"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="s.status === 'Working' ? 'bg-sky-400' : 'bg-emerald-400'" />
              <span v-if="!collapsed" class="min-w-0 flex-1 truncate text-[13px] text-foreground/95">{{ s.title }}</span>
              <span v-if="!collapsed" class="text-[11px] text-muted-foreground">{{ s.time }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="mt-2 border-t border-border/80 pt-3">
        <button
          :disabled="disabled"
          class="mb-1 flex h-8 w-full items-center justify-center rounded-md border border-border/80 bg-background/45 text-xs font-medium hover:bg-muted/60"
          @click="$emit('new')"
        >
          {{ collapsed ? '+' : '+ New session' }}
        </button>
        <button
          class="flex h-8 w-full items-center justify-center rounded-md border border-border/80 bg-background/45 text-xs text-muted-foreground hover:text-foreground"
          @click="$emit('openSettings')"
        >
          {{ collapsed ? '⚙' : 'Settings' }}
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

defineEmits<{ select: [id: string]; new: []; openSettings: []; toggleCollapse: [] }>();

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
