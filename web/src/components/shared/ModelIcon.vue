<template>
  <span class="model-icon" :style="wrapperStyle" :title="provider" aria-hidden="true">
    <img
      v-if="!hasError"
      class="model-icon__image"
      :style="imageStyle"
      :src="iconSrc"
      :alt="provider"
      :width="size"
      :height="size"
      @error="hasError = true"
    />
    <span v-else class="model-icon__fallback" :style="fallbackStyle">
      {{ fallbackLetter }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    provider: string;
    size?: number;
  }>(),
  {
    size: 20
  }
);

const hasError = ref(false);

const providerIconAliases: Record<string, string> = {
  'amazon-bedrock': 'bedrock',
  'anthropic': 'anthropic',
  'azure-openai': 'azure',
  'azure-openai-responses': 'azure',
  'cerebras': 'cerebras',
  'cloudflare': 'cloudflare',
  'cloudflare-ai-gateway': 'cloudflare',
  'cloudflare-workers-ai': 'cloudflare',
  'deepseek': 'deepseek',
  'github-copilot': 'githubcopilot',
  'google': 'google',
  'groq': 'groq',
  'moonshotai': 'moonshot',
  'moonshotai-cn': 'moonshot',
  'openai': 'openai',
  'openrouter': 'openrouter',
  'xai': 'xai'
};

const normalizedProvider = computed(() => props.provider.trim().toLowerCase());
const iconProvider = computed(() => providerIconAliases[normalizedProvider.value] ?? normalizedProvider.value);

const iconSrc = computed(() => {
  const provider = encodeURIComponent(iconProvider.value);
  return `https://unpkg.com/@lobehub/icons-static-svg@latest/icons/${provider}.svg`;
});

const fallbackLetter = computed(() => normalizedProvider.value.charAt(0).toUpperCase() || '?');

const wrapperStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`
}));

const imageStyle = computed(() => ({
  // Inversion follows the active theme via --icon-invert (set in applyTheme):
  // 1 on dark presets (lobehub SVGs are dark-on-transparent → invert to light),
  // 0 on light presets like minimal-paper. Defaults to 1 if the var is unset.
  filter: 'invert(var(--icon-invert, 1))',
  height: `${Math.round(props.size * 0.82)}px`,
  width: `${Math.round(props.size * 0.82)}px`
}));

const fallbackStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.max(10, Math.round(props.size * 0.52))}px`
}));

watch(
  () => normalizedProvider.value,
  () => {
    hasError.value = false;
  }
);
</script>

<style scoped>
.model-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  vertical-align: middle;
}

.model-icon__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.model-icon__fallback {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-weight: 700;
  line-height: 1;
  user-select: none;
}
</style>
