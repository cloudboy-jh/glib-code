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
import type { ThemePreset } from '@glib-code/shared/theme/presets';
import { getDiffThemeVars } from '../../lib/diffThemes';

const props = withDefaults(
  defineProps<{
    patch: string;
    diffStyle?: 'split' | 'unified';
    themeType?: 'dark' | 'light';
    themePreset?: ThemePreset;
  }>(),
  {
    diffStyle: 'split',
    themeType: 'dark',
    themePreset: 'catppuccin-mocha'
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
  '--shiki-bg': 'hsl(var(--background))',
  '--shiki-dark-bg': 'hsl(var(--background))',
  '--shiki-light-bg': 'hsl(var(--background))',
  ...getDiffThemeVars(props.themePreset, props.themeType)
}));

function getOptions(): BaseDiffOptions {
  return {
    diffStyle: props.diffStyle,
    diffIndicators: 'bars',
    lineDiffType: 'word-alt',
    maxLineDiffLength: 2000,
    expandUnchanged: true,
    hunkSeparators: 'simple',
    overflow: 'scroll',
    disableBackground: false,
    themeType: props.themeType
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
  () => [props.patch, props.diffStyle, props.themeType, props.themePreset] as const,
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

<style scoped></style>
