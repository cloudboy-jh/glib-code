<template>
  <div class="diff-shell min-h-0 overflow-hidden rounded-lg border border-border/80 bg-[hsl(var(--bg-sunken))]/85">
    <div v-if="errorMessage" class="p-3 text-xs text-red-300">{{ errorMessage }}</div>
    <div v-else-if="!patch.trim()" class="p-3 text-xs text-muted-foreground">No diff available for this file.</div>
    <component :is="DIFFS_TAG_NAME" v-else ref="containerRef" class="block h-full w-full overflow-auto" />
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

function getOptions(): BaseDiffOptions {
  return {
    diffStyle: props.diffStyle,
    diffIndicators: 'bars',
    hunkSeparators: 'line-info-basic',
    lineDiffType: 'word',
    overflow: 'scroll',
    disableBackground: false,
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
