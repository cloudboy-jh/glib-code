<template>
  <div class="multi-diff-shell max-h-[calc(100vh-220px)] overflow-auto rounded-lg border border-border/80 bg-[hsl(var(--card))]/65">
    <div v-if="errorMessage" class="p-3 text-xs text-red-300">{{ errorMessage }}</div>
    <div v-else-if="!patch.trim()" class="p-3 text-xs text-muted-foreground">No diff available.</div>
    <template v-else>
      <div
        v-for="(file, i) in parsedFiles"
        :key="i"
        class="multi-diff-file"
      >
        <component
          :is="DIFFS_TAG_NAME"
          :ref="(el: unknown) => setRef(el, i)"
          class="block w-full"
          :style="diffCssVars"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { FileDiff, DIFFS_TAG_NAME, parsePatchFiles, type BaseDiffOptions, type FileDiffMetadata } from '@pierre/diffs';
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

const errorMessage = ref('');
const containerRefs = ref<(HTMLElement | null)[]>([]);
const instances = ref<(FileDiff | null)[]>([]);

const parsedFiles = computed<FileDiffMetadata[]>(() => {
  if (!props.patch.trim()) return [];
  try {
    errorMessage.value = '';
    const patches = parsePatchFiles(props.patch);
    return patches.flatMap((p) => p.files);
  } catch (e) {
    errorMessage.value = `Failed to parse patch: ${e instanceof Error ? e.message : String(e)}`;
    return [];
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

function setRef(el: unknown, i: number) {
  if (el instanceof HTMLElement || el === null) {
    containerRefs.value[i] = el as HTMLElement | null;
  }
}

function cleanUpAll() {
  for (const inst of instances.value) {
    if (inst) inst.cleanUp();
  }
  instances.value = [];
  containerRefs.value = [];
}

async function mountAll() {
  await nextTick();
  const files = parsedFiles.value;
  // clean up extras if file count shrank
  for (let i = files.length; i < instances.value.length; i++) {
    instances.value[i]?.cleanUp();
    instances.value[i] = null;
  }
  instances.value.length = files.length;

  for (let i = 0; i < files.length; i++) {
    const el = containerRefs.value[i];
    if (!el) continue;
    const fileDiff = files[i];
    const opts = getOptions();
    if (!instances.value[i]) {
      const inst = new FileDiff(opts, undefined, true);
      inst.hydrate({ fileContainer: el, fileDiff });
      instances.value[i] = inst;
    } else {
      instances.value[i]!.setOptions(opts);
      instances.value[i]!.render({ forceRender: true, fileDiff });
    }
  }
}

watch(
  () => [props.patch, props.diffStyle, props.themeType, props.themePreset] as const,
  async () => { await mountAll(); }
);

onMounted(async () => { await mountAll(); });
onUnmounted(() => { cleanUpAll(); });
</script>

<style scoped>
.multi-diff-file + .multi-diff-file {
  border-top: 1px solid hsl(var(--border) / 0.5);
}
</style>
