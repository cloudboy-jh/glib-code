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

type DiffThemeVars = Record<string, string>;

const DIFF_THEME_VARS_BY_PRESET: Record<ThemePreset, DiffThemeVars> = {
  'tokyo-night': {
    '--diffs-bg-buffer-override': 'hsl(var(--card))',
    '--diffs-bg-hover-override': 'hsl(var(--muted) / 0.34)',
    '--diffs-bg-context-override': 'hsl(var(--muted) / 0.2)',
    '--diffs-bg-separator-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-fg-number-override': 'hsl(var(--muted-foreground) / 0.9)',
    '--diffs-fg-number-addition-override': 'hsl(160 68% 60%)',
    '--diffs-fg-number-deletion-override': 'hsl(0 76% 63%)',
    '--diffs-bg-addition-override': 'hsl(160 72% 40% / 0.08)',
    '--diffs-bg-addition-number-override': 'hsl(160 72% 40% / 0.13)',
    '--diffs-bg-addition-hover-override': 'hsl(160 72% 40% / 0.16)',
    '--diffs-bg-addition-emphasis-override': 'hsl(160 72% 40% / 0.22)',
    '--diffs-bg-deletion-override': 'hsl(0 76% 56% / 0.14)',
    '--diffs-bg-deletion-number-override': 'hsl(0 76% 56% / 0.22)',
    '--diffs-bg-deletion-hover-override': 'hsl(0 76% 56% / 0.22)',
    '--diffs-bg-deletion-emphasis-override': 'hsl(0 76% 56% / 0.28)'
  },
  'catppuccin-mocha': {
    '--diffs-bg-buffer-override': 'hsl(var(--card))',
    '--diffs-bg-hover-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-bg-context-override': 'hsl(var(--muted) / 0.2)',
    '--diffs-bg-separator-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-fg-number-override': 'hsl(var(--muted-foreground) / 0.9)',
    '--diffs-fg-number-addition-override': 'hsl(142 70% 62%)',
    '--diffs-fg-number-deletion-override': 'hsl(0 78% 66%)',
    '--diffs-bg-addition-override': 'hsl(142 70% 48% / 0.08)',
    '--diffs-bg-addition-number-override': 'hsl(142 70% 48% / 0.13)',
    '--diffs-bg-addition-hover-override': 'hsl(142 70% 48% / 0.16)',
    '--diffs-bg-addition-emphasis-override': 'hsl(142 70% 48% / 0.22)',
    '--diffs-bg-deletion-override': 'hsl(0 78% 58% / 0.14)',
    '--diffs-bg-deletion-number-override': 'hsl(0 78% 58% / 0.22)',
    '--diffs-bg-deletion-hover-override': 'hsl(0 78% 58% / 0.22)',
    '--diffs-bg-deletion-emphasis-override': 'hsl(0 78% 58% / 0.28)'
  },
  'gruvbox-dark': {
    '--diffs-bg-buffer-override': 'hsl(var(--card))',
    '--diffs-bg-hover-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-bg-context-override': 'hsl(var(--muted) / 0.2)',
    '--diffs-bg-separator-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-fg-number-override': 'hsl(var(--muted-foreground) / 0.9)',
    '--diffs-fg-number-addition-override': 'hsl(93 52% 58%)',
    '--diffs-fg-number-deletion-override': 'hsl(4 62% 63%)',
    '--diffs-bg-addition-override': 'hsl(93 52% 44% / 0.09)',
    '--diffs-bg-addition-number-override': 'hsl(93 52% 44% / 0.14)',
    '--diffs-bg-addition-hover-override': 'hsl(93 52% 44% / 0.17)',
    '--diffs-bg-addition-emphasis-override': 'hsl(93 52% 44% / 0.23)',
    '--diffs-bg-deletion-override': 'hsl(4 62% 52% / 0.15)',
    '--diffs-bg-deletion-number-override': 'hsl(4 62% 52% / 0.24)',
    '--diffs-bg-deletion-hover-override': 'hsl(4 62% 52% / 0.23)',
    '--diffs-bg-deletion-emphasis-override': 'hsl(4 62% 52% / 0.3)'
  },
  nord: {
    '--diffs-bg-buffer-override': 'hsl(var(--card))',
    '--diffs-bg-hover-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-bg-context-override': 'hsl(var(--muted) / 0.2)',
    '--diffs-bg-separator-override': 'hsl(var(--muted) / 0.35)',
    '--diffs-fg-number-override': 'hsl(var(--muted-foreground) / 0.9)',
    '--diffs-fg-number-addition-override': 'hsl(145 45% 67%)',
    '--diffs-fg-number-deletion-override': 'hsl(355 58% 70%)',
    '--diffs-bg-addition-override': 'hsl(145 45% 50% / 0.08)',
    '--diffs-bg-addition-number-override': 'hsl(145 45% 50% / 0.13)',
    '--diffs-bg-addition-hover-override': 'hsl(145 45% 50% / 0.16)',
    '--diffs-bg-addition-emphasis-override': 'hsl(145 45% 50% / 0.22)',
    '--diffs-bg-deletion-override': 'hsl(355 58% 58% / 0.14)',
    '--diffs-bg-deletion-number-override': 'hsl(355 58% 58% / 0.22)',
    '--diffs-bg-deletion-hover-override': 'hsl(355 58% 58% / 0.22)',
    '--diffs-bg-deletion-emphasis-override': 'hsl(355 58% 58% / 0.28)'
  }
};

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
  '--shiki-bg': 'hsl(var(--card))',
  '--shiki-dark-bg': 'hsl(var(--card))',
  '--shiki-light-bg': 'hsl(var(--card))',
  ...(DIFF_THEME_VARS_BY_PRESET[props.themePreset] ?? DIFF_THEME_VARS_BY_PRESET['catppuccin-mocha'])
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
