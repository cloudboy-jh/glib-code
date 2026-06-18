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
    themeType?: 'dark' | 'light';
  }>(),
  {
    gitStatus: () => ({}),
    themePreset: 'catppuccin-mocha',
    themeType: undefined
  }
);

const containerRef = ref<HTMLElement | null>(null);
let instance: FileTree | null = null;
let lastPaths: string[] = [];
let lastGitStatusJson = '';

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

  // Derive light/dark from the background lightness if no explicit themeType prop given.
  // Same formula as diffThemeType in App.vue — background token is "H S% L%".
  const isLight = props.themeType
    ? props.themeType === 'light'
    : Number(preset.background.split(' ')[2]?.replace('%', '') ?? '0') > 50;

  const bg = `hsl(${preset.background})`;
  const fg = `hsl(${preset.foreground})`;
  const muted = `hsl(${preset.mutedForeground})`;
  const border = `hsl(${preset.border})`;

  // Git decoration colors — Flexoki 600s on light themes (darker, legible on warm paper),
  // bright 400-range on dark themes (saturated, readable against dark surfaces).
  const gitModified  = isLight ? `hsl(45 99% 34%)`  : `hsl(35 88% 62%)`;   // yellow-600 / yellow-400
  const gitAdded     = isLight ? `hsl(73 84% 27%)`  : `hsl(142 70% 50%)`;  // green-600  / green-400
  const gitDeleted   = isLight ? `hsl(3 62% 42%)`   : `hsl(0 76% 63%)`;    // red-600    / red-400
  const gitUntracked = isLight ? `hsl(212 68% 39%)` : `hsl(215 25% 75%)`; // blue-600   / blue-muted
  const gitRenamed   = isLight ? `hsl(175 57% 33%)` : `hsl(200 80% 60%)`; // cyan-600   / cyan-400

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
      'gitDecoration.modifiedResourceForeground': gitModified,
      'gitDecoration.addedResourceForeground': gitAdded,
      'gitDecoration.deletedResourceForeground': gitDeleted,
      'gitDecoration.untrackedResourceForeground': gitUntracked,
      'gitDecoration.ignoredResourceForeground': `hsl(${preset.muted})`,
      'gitDecoration.renamedResourceForeground': gitRenamed,
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
      'terminal.ansiBrightGreen': gitAdded,
      'terminal.ansiBrightRed': gitDeleted,
      'terminal.ansiBrightYellow': gitModified,
      'terminal.ansiBrightBlue': gitUntracked,
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

  const newGitStatusJson = JSON.stringify(props.gitStatus);

  if (!instance) {
    lastPaths = [...props.paths];
    lastGitStatusJson = newGitStatusJson;
    instance = createInstance();
    instance.render({ containerWrapper: containerRef.value });
    return;
  }

  const pathsChanged = props.paths.length !== lastPaths.length || props.paths.some((p, i) => p !== lastPaths[i]);
  const statusChanged = newGitStatusJson !== lastGitStatusJson;

  if (!pathsChanged && !statusChanged) return;

  if (pathsChanged) {
    lastPaths = [...props.paths];
    instance.resetPaths(props.paths);
  }
  if (statusChanged) {
    lastGitStatusJson = newGitStatusJson;
    instance.setGitStatus(gitStatusEntries());
  }
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
