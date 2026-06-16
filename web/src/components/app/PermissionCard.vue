<template>
  <div class="flex gap-3 rounded-xl border border-border/70 bg-background/40 px-4 py-3.5">
    <!-- Icon -->
    <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/30">
      <!-- folder -->
      <svg v-if="icon === 'folder'" class="h-4 w-4 text-primary/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
      <!-- network / globe -->
      <svg v-else-if="icon === 'network'" class="h-4 w-4 text-primary/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
      <!-- generic shield -->
      <svg v-else class="h-4 w-4 text-primary/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    </div>

    <!-- Copy -->
    <div class="min-w-0">
      <div class="text-sm font-medium text-foreground">{{ title }}</div>
      <div class="mt-0.5 text-xs leading-relaxed text-muted-foreground">{{ rationale }}</div>
      <div v-if="when" class="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground/80">
        <svg class="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        {{ when }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  icon: "folder" | "network" | "shield";
  title: string;
  rationale: string;
  when?: string;
}>();
</script>
