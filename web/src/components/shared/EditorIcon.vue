<template>
  <span class="editor-icon" :style="wrapperStyle" :title="displayName" aria-hidden="true">
    <img
      v-if="!hasError"
      class="editor-icon__image"
      :style="imageStyle"
      :src="iconSrc"
      :alt="displayName"
      :width="size"
      :height="size"
      @error="hasError = true"
    />
    <span v-else class="editor-icon__fallback" :style="fallbackStyle">
      {{ fallbackLetter }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    editor: string;
    size?: number;
  }>(),
  { size: 18 }
);

const hasError = ref(false);
const normalizedEditor = computed(() => props.editor.trim().toLowerCase());

const iconSources: Record<string, { source: 'simple' | 'lobe' | 'url'; slug: string; color?: string; url?: string }> = {
  vscode: { source: 'url', slug: 'vscode', url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vscode/vscode-original.svg' },
  cursor: { source: 'lobe', slug: 'cursor' },
  zed: { source: 'simple', slug: 'zedindustries' },
  obsidian: { source: 'simple', slug: 'obsidian', color: '7C3AED' }
};

const displayNames: Record<string, string> = {
  vscode: 'VS Code',
  cursor: 'Cursor',
  zed: 'Zed',
  obsidian: 'Obsidian'
};

const iconSource = computed(() => iconSources[normalizedEditor.value] ?? { source: 'simple' as const, slug: normalizedEditor.value });
const iconSrc = computed(() => {
  const { source, slug, color, url } = iconSource.value;
  if (source === 'url' && url) return url;
  if (source === 'lobe') return `https://unpkg.com/@lobehub/icons-static-svg@latest/icons/${encodeURIComponent(slug)}.svg`;
  return color
    ? `https://cdn.simpleicons.org/${encodeURIComponent(slug)}/${encodeURIComponent(color)}`
    : `https://cdn.simpleicons.org/${encodeURIComponent(slug)}`;
});
const displayName = computed(() => displayNames[normalizedEditor.value] ?? props.editor);
const fallbackLetter = computed(() => displayName.value.charAt(0).toUpperCase() || '?');

const wrapperStyle = computed(() => {
  const base = { width: `${props.size}px`, height: `${props.size}px` } as Record<string, string>;
  if (normalizedEditor.value === 'cursor') {
    base.backgroundColor = '#ffffff';
    base.border = '1px solid rgba(15, 23, 42, 0.12)';
    base.borderRadius = '6px';
  }
  return base;
});
const imageStyle = computed(() => {
  const scale = normalizedEditor.value === 'cursor' ? 0.72 : 0.9;
  return { height: `${Math.round(props.size * scale)}px`, width: `${Math.round(props.size * scale)}px` };
});
const fallbackStyle = computed(() => {
  const hue = hashEditor(normalizedEditor.value);
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    fontSize: `${Math.max(10, Math.round(props.size * 0.52))}px`,
    backgroundColor: `hsl(${hue} 36% 18% / 0.72)`,
    borderColor: `hsl(${hue} 45% 36% / 0.7)`,
    color: `hsl(${hue} 58% 76%)`
  };
});

watch(() => normalizedEditor.value, () => { hasError.value = false; });

function hashEditor(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) % 360;
  return hash;
}
</script>

<style scoped>
.editor-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  vertical-align: middle;
}

.editor-icon__image {
  display: block;
  object-fit: contain;
}

.editor-icon__fallback {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid;
  border-radius: 999px;
  font-weight: 700;
  line-height: 1;
  user-select: none;
}
</style>
