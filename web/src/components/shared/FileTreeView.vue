<template>
  <div class="file-tree-shell rounded-lg border border-border/80 bg-[hsl(var(--card))]/65">
    <div ref="containerRef" class="w-full" :style="{ height: containerHeight, ...treeCssVars }" />
  </div>
</template>

<script setup lang="ts">
import { FileTree, themeToTreeStyles, type GitStatusEntry } from '@pierre/trees';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { THEME_PRESETS, type ThemePreset } from '@glib-code/shared/theme/presets';

const props = withDefaults(
  defineProps<{
    paths: string[];
    gitStatus?: Record<string, string>;
    themePreset?: ThemePreset;
  }>(),
  {
    gitStatus: () => ({}),
    themePreset: 'catppuccin-mocha'
  }
);

const containerRef = ref<HTMLElement | null>(null);
let instance: FileTree | null = null;

const ROW_HEIGHT = 22; // compact density item height
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 520;

const containerHeight = computed(() => {
  const rows = props.paths.length;
  const natural = rows * ROW_HEIGHT;
  const clamped = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, natural));
  return `${clamped}px`;
});

function gitStatusEntries(): GitStatusEntry[] {
  return Object.entries(props.gitStatus).map(([path, status]) => ({
    path,
    status: status as GitStatusEntry['status']
  }));
}

const treeCssVars = computed<Record<string, string>>(() => {
  const preset = THEME_PRESETS[props.themePreset] ?? THEME_PRESETS['catppuccin-mocha'];
  const isLight = props.themePreset.includes('light') || props.themePreset.includes('latte') || props.themePreset === 'paper' || props.themePreset === 'solarized-light' || props.themePreset === 'github-light';
  const bg = `hsl(${preset.background})`;
  const fg = `hsl(${preset.foreground})`;
  const muted = `hsl(${preset.mutedForeground})`;
  const border = `hsl(${preset.border})`;
  const styles = themeToTreeStyles({
    type: isLight ? 'light' : 'dark',
    bg,
    fg,
    colors: {
      'editor.foreground': fg,
      'editor.background': bg,
      'sideBar.background': bg,
      'sideBar.foreground': fg,
      'sideBar.border': border,
      'gitDecoration.modifiedResourceForeground': `hsl(35 88% 62%)`,
      'gitDecoration.addedResourceForeground': `hsl(142 70% 50%)`,
      'gitDecoration.deletedResourceForeground': `hsl(0 76% 63%)`,
      'gitDecoration.untrackedResourceForeground': `hsl(215 25% 75%)`,
      'gitDecoration.ignoredResourceForeground': `hsl(${preset.muted})`,
      'gitDecoration.renamedResourceForeground': `hsl(200 80% 60%)`,
      'sideBarSectionHeader.background': `hsl(${preset.card})`,
      'sideBarSectionHeader.foreground': muted,
      'list.hoverBackground': `hsl(${preset.muted} / 0.34)`,
      'list.activeSelectionBackground': `hsl(${preset.primary} / 0.12)`,
      'list.activeSelectionForeground': fg,
      'list.focusHighlightForeground': `hsl(${preset.primary})`,
      'focusBorder': `hsl(${preset.ring})`,
      'input.border': border,
      'foreground': fg,
      'descriptionForeground': muted,
      'terminal.ansiBrightGreen': `hsl(142 70% 50%)`,
      'terminal.ansiBrightRed': `hsl(0 76% 63%)`,
      'terminal.ansiBrightYellow': `hsl(35 88% 62%)`,
      'terminal.ansiBrightBlue': `hsl(200 80% 60%)`,
      'terminal.ansiWhite': fg
    }
  });
  return {
    '--trees-bg-override': bg,
    '--trees-fg-override': fg,
    '--trees-border-color-override': border,
    '--trees-selected-bg-override': `hsl(${preset.primary} / 0.12)`,
    '--trees-hover-bg-override': `hsl(${preset.muted} / 0.34)`,
    ...styles
  };
});

function createInstance(): FileTree {
  return new FileTree({
    paths: props.paths,
    gitStatus: gitStatusEntries(),
    density: 'compact',
    icons: { set: 'complete', colored: true },
    search: false,
    flattenEmptyDirectories: true,
    initialExpansion: 'closed'
  });
}

async function mountOrRender() {
  if (!containerRef.value || !props.paths.length) return;

  if (!instance) {
    instance = createInstance();
    instance.render({ containerWrapper: containerRef.value });
    return;
  }

  instance.resetPaths(props.paths);
  instance.setGitStatus(gitStatusEntries());
}

watch(
  () => [props.paths, props.gitStatus, props.themePreset] as const,
  async () => {
    await nextTick();
    if (!props.paths.length && instance) {
      instance.cleanUp();
      instance = null;
      return;
    }
    await mountOrRender();
  },
  { deep: true }
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
