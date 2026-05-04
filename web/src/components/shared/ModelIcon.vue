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
    theme?: 'light' | 'dark';
  }>(),
  {
    size: 20,
    theme: 'light'
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
  filter: props.theme === 'dark' ? 'invert(1)' : 'none',
  height: `${Math.round(props.size * 0.82)}px`,
  width: `${Math.round(props.size * 0.82)}px`
}));

const fallbackStyle = computed(() => {
  const hue = hashProvider(normalizedProvider.value);
  const isDark = props.theme === 'dark';

  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    fontSize: `${Math.max(10, Math.round(props.size * 0.52))}px`,
    backgroundColor: isDark ? `hsl(${hue} 36% 18% / 0.72)` : `hsl(${hue} 60% 94%)`,
    borderColor: isDark ? `hsl(${hue} 45% 36% / 0.7)` : `hsl(${hue} 48% 80%)`,
    color: isDark ? `hsl(${hue} 58% 76%)` : `hsl(${hue} 58% 30%)`
  };
});

watch(
  () => normalizedProvider.value,
  () => {
    hasError.value = false;
  }
);

function hashProvider(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360;
  }

  return hash;
}
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
  border: 1px solid;
  border-radius: 999px;
  font-weight: 700;
  line-height: 1;
  user-select: none;
}
</style>
