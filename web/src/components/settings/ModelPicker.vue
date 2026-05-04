<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6" @click.self="$emit('close')">
    <div class="flex max-h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-2xl shadow-black/40">
      <div class="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div>
          <div class="text-sm font-semibold">Select model</div>
          <div class="mt-0.5 text-[11px] text-muted-foreground">{{ modelRows.length }} models · {{ authenticatedRows.length }} usable</div>
        </div>
        <button class="rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground" @click="$emit('close')">Close</button>
      </div>

      <div class="border-b border-border/70 p-3">
        <div class="flex items-center gap-2">
          <input
            v-model="query"
            class="h-10 min-w-0 flex-1 rounded-md border border-border/70 bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-border"
            placeholder="Search models or providers..."
            autofocus
          />
          <div class="relative">
            <button
              class="inline-flex h-10 items-center gap-2 rounded-md border border-border/70 bg-background px-3 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              @click.stop="filterMenuOpen = !filterMenuOpen"
            >
              <SlidersHorizontal class="h-4 w-4" />
              <span>Filters</span>
            </button>

            <div v-if="filterMenuOpen" class="absolute right-0 top-[calc(100%+8px)] z-50 w-80 overflow-hidden rounded-lg border border-border/80 bg-card shadow-xl shadow-black/50">
              <div class="border-b border-border/70 p-2">
                <button v-for="item in primaryFilters" :key="item.id" :class="menuFilterClass(filter === item.id)" @click.stop="selectFilter(item.id)">
                  <span>{{ item.label }}</span>
                  <span class="shrink-0 text-[11px] text-muted-foreground">{{ item.count }}</span>
                </button>
              </div>
              <div class="max-h-72 overflow-auto p-2">
                <p class="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Providers</p>
                <button v-for="provider in providerFilters" :key="provider.id" :class="menuFilterClass(filter === provider.id)" @click.stop="selectFilter(provider.id)">
                  <span class="flex min-w-0 items-center gap-2">
                    <ModelIcon :provider="provider.id" :size="18" theme="dark" />
                    <span class="truncate">{{ provider.id }}</span>
                  </span>
                  <span class="shrink-0 text-[11px] text-muted-foreground">{{ provider.modelIds.length }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span class="rounded-full border border-border/60 bg-background/45 px-2 py-1">{{ currentFilterLabel }}</span>
          <span v-if="query.trim()" class="rounded-full border border-border/60 bg-background/45 px-2 py-1">Search: {{ query.trim() }}</span>
          <span>{{ filteredRows.length }} shown</span>
          <button v-if="filter !== 'authenticated' || query.trim()" class="ml-auto text-primary underline underline-offset-2" @click="clearFilters">Reset</button>
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-auto p-2">
        <button
          v-for="row in filteredRows"
          :key="`${row.providerId}:${row.modelId}`"
          class="flex w-full items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border/60 hover:bg-muted/45"
          @click="onSelect(row)"
        >
          <div class="flex min-w-0 items-center gap-3">
            <ModelIcon :provider="row.providerId" :size="24" theme="dark" />
            <div class="min-w-0">
              <div class="truncate text-sm font-medium text-foreground">{{ row.modelId }}</div>
              <div class="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{{ row.providerId }}</span>
                <span>·</span>
                <span :class="row.hasAuth ? 'text-emerald-300' : 'text-amber-300'">{{ row.hasAuth ? 'authenticated' : 'needs key' }}</span>
              </div>
            </div>
          </div>
          <div class="shrink-0 text-xs">
            <span v-if="isSelected(row)" class="rounded-full border border-primary/50 bg-primary/15 px-2 py-1 text-primary">Selected</span>
            <span v-else-if="row.hasAuth" class="text-muted-foreground">Select</span>
            <span v-else class="text-primary underline underline-offset-2">Add key</span>
          </div>
        </button>

        <div v-if="filteredRows.length === 0" class="grid h-44 place-items-center text-sm text-muted-foreground">
          No models match that search.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { SlidersHorizontal } from 'lucide-vue-next';
import ModelIcon from '../shared/ModelIcon.vue';

type ProviderCapability = { id: string; hasAuth: boolean; modelIds: string[] };
type ModelRow = { providerId: string; modelId: string; hasAuth: boolean };

const props = defineProps<{
  providers: ProviderCapability[];
  defaultProvider: string;
  defaultModel: string;
}>();

const emit = defineEmits<{
  close: [];
  select: [providerId: string, modelId: string];
  needsAuth: [providerId: string, modelId: string];
}>();

const query = ref('');
const filter = ref('authenticated');
const filterMenuOpen = ref(false);

const primaryFilters = computed(() => [
  { id: 'authenticated', label: 'Usable', count: authenticatedRows.value.length },
  { id: 'all', label: 'All models', count: modelRows.value.length }
]);
const providerFilters = computed(() => [...props.providers].sort((a, b) => Number(b.hasAuth) - Number(a.hasAuth) || a.id.localeCompare(b.id)));

const modelRows = computed<ModelRow[]>(() => props.providers.flatMap((provider) => provider.modelIds.map((modelId) => ({ providerId: provider.id, modelId, hasAuth: provider.hasAuth }))));
const authenticatedRows = computed(() => modelRows.value.filter((row) => row.hasAuth));

const filteredRows = computed(() => {
  const q = query.value.trim().toLowerCase();
  return modelRows.value.filter((row) => {
    if (filter.value === 'authenticated' && !row.hasAuth) return false;
    if (filter.value !== 'all' && filter.value !== 'authenticated' && row.providerId !== filter.value) return false;
    if (!q) return true;
    return row.modelId.toLowerCase().includes(q) || row.providerId.toLowerCase().includes(q);
  });
});

const currentFilterLabel = computed(() => {
  if (filter.value === 'authenticated') return 'Usable models';
  if (filter.value === 'all') return 'All models';
  return `Provider: ${filter.value}`;
});

function menuFilterClass(active: boolean) {
  return [
    'flex h-9 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-sm transition-colors',
    active ? 'bg-muted/80 text-foreground' : 'text-muted-foreground hover:bg-muted/55 hover:text-foreground'
  ];
}

function selectFilter(value: string) {
  filter.value = value;
  filterMenuOpen.value = false;
}

function clearFilters() {
  query.value = '';
  filter.value = 'authenticated';
}

function isSelected(row: ModelRow) {
  return row.providerId === props.defaultProvider && row.modelId === props.defaultModel;
}

function onSelect(row: ModelRow) {
  if (!row.hasAuth) {
    emit('needsAuth', row.providerId, row.modelId);
    return;
  }
  emit('select', row.providerId, row.modelId);
}
</script>
