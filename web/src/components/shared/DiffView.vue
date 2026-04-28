<template>
  <div class="diff-shell max-h-[calc(100vh-220px)] overflow-auto rounded-lg border border-border/80 bg-[hsl(var(--card))]/65">
    <div v-if="errorMessage" class="p-3 text-xs text-red-300">{{ errorMessage }}</div>
    <div v-else-if="!patch.trim()" class="p-3 text-xs text-muted-foreground">No diff available for this file.</div>
    <component :is="DIFFS_TAG_NAME" v-else ref="containerRef" class="block w-full" :style="diffCssVars" />
  </div>
</template>

<script setup lang="ts">
import { FileDiff, DIFFS_TAG_NAME, getSingularPatch, type BaseDiffOptions, type FileDiffMetadata } from '@pierre/diffs';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    patch: string;
    diffStyle?: 'split' | 'unified';
  }>(),
  {
    diffStyle: 'split'
  }
);

const containerRef = ref<HTMLElement | null>(null);
const errorMessage = ref('');
let instance: FileDiff | null = null;

const parsedPatch = computed<FileDiffMetadata | undefined>(() => {
  if (!props.patch.trim()) return undefined;
  try {
    errorMessage.value = '';
    return getSingularPatch(props.patch);
  } catch {
    errorMessage.value = 'Failed to parse patch.';
    return undefined;
  }
});

const diffCssVars = computed<Record<string, string>>(() => ({
  '--shiki-bg': 'hsl(var(--card))',
  '--shiki-dark-bg': 'hsl(var(--card))',
  '--shiki-light-bg': 'hsl(var(--card))',
  '--diffs-bg-buffer-override': 'hsl(var(--card))',
  '--diffs-bg-hover-override': 'hsl(var(--muted) / 0.35)',
  '--diffs-bg-context-override': 'hsl(var(--muted) / 0.2)',
  '--diffs-bg-separator-override': 'hsl(var(--muted) / 0.35)',
  '--diffs-fg-number-override': 'hsl(var(--muted-foreground) / 0.9)',
  '--diffs-fg-number-addition-override': 'hsl(var(--primary) / 0.9)',
  '--diffs-fg-number-deletion-override': 'hsl(var(--destructive, 0 72% 51%) / 0.9)',
  '--diffs-bg-addition-override': 'hsl(var(--primary) / 0.08)',
  '--diffs-bg-addition-number-override': 'hsl(var(--primary) / 0.14)',
  '--diffs-bg-addition-hover-override': 'hsl(var(--primary) / 0.15)',
  '--diffs-bg-addition-emphasis-override': 'hsl(var(--primary) / 0.22)',
  '--diffs-bg-deletion-override': 'hsl(var(--destructive, 0 72% 51%) / 0.08)',
  '--diffs-bg-deletion-number-override': 'hsl(var(--destructive, 0 72% 51%) / 0.14)',
  '--diffs-bg-deletion-hover-override': 'hsl(var(--destructive, 0 72% 51%) / 0.15)',
  '--diffs-bg-deletion-emphasis-override': 'hsl(var(--destructive, 0 72% 51%) / 0.22)'
}));

function getOptions(): BaseDiffOptions {
  return {
    diffStyle: props.diffStyle,
    diffIndicators: 'bars',
    hunkSeparators: 'line-info-basic',
    lineDiffType: 'word',
    overflow: 'scroll',
    disableBackground: true,
    themeType: 'dark'
  };
}

async function mountOrRender() {
  if (!containerRef.value || !parsedPatch.value) return;

  if (!instance) {
    instance = new FileDiff(getOptions(), undefined, true);
    instance.hydrate({
      fileContainer: containerRef.value,
      fileDiff: parsedPatch.value
    });
    return;
  }

  instance.setOptions(getOptions());
  instance.render({
    forceRender: true,
    fileDiff: parsedPatch.value
  });
}

watch(
  () => [props.patch, props.diffStyle] as const,
  async () => {
    await nextTick();
    if (!parsedPatch.value && instance) {
      instance.cleanUp();
      instance = null;
      return;
    }
    await mountOrRender();
  }
);

onMounted(async () => {
  await nextTick();
  await mountOrRender();
});

onUnmounted(() => {
  if (instance) {
    instance.cleanUp();
    instance = null;
  }
});
</script>

<style scoped>
.diff-shell :deep(pre),
.diff-shell :deep(code) {
  background-color: transparent !important;
}
</style>
