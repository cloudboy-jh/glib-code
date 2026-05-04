<template>
  <span
    :class="[
      'inline-grid shrink-0 place-items-center rounded-md border font-semibold leading-none shadow-inner',
      sizeClass,
      muted ? 'opacity-55 grayscale' : ''
    ]"
    :style="markStyle"
    :title="label ?? id"
    aria-hidden="true"
  >
    {{ initials }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  id: string;
  label?: string;
  kind?: 'model' | 'git';
  size?: 'sm' | 'md' | 'lg';
  muted?: boolean;
}>(), {
  kind: 'model',
  size: 'md',
  muted: false
});

const knownInitials: Record<string, string> = {
  anthropic: 'AN',
  cloudflare: 'CF',
  'cloudflare-artifacts': 'CF',
  'code-storage': 'CS',
  commit: 'CM',
  deepseek: 'DS',
  github: 'GH',
  'github-copilot': 'GC',
  gitfork: 'GF',
  gitlab: 'GL',
  'git-remote': 'GR',
  google: 'GO',
  groq: 'GQ',
  local: 'LC',
  openai: 'AI',
  openrouter: 'OR',
  patch: 'PT',
  pr: 'PR',
  branch: 'BR'
};

const knownHues: Record<string, number> = {
  anthropic: 28,
  cloudflare: 31,
  'cloudflare-artifacts': 31,
  'code-storage': 194,
  deepseek: 226,
  github: 260,
  'github-copilot': 152,
  gitlab: 18,
  google: 211,
  groq: 8,
  local: 160,
  openai: 172,
  openrouter: 278
};

const normalizedId = computed(() => props.id.trim().toLowerCase());

const initials = computed(() => {
  const known = knownInitials[normalizedId.value];
  if (known) return known;
  const words = normalizedId.value.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return normalizedId.value.slice(0, 2).toUpperCase() || '??';
});

const hue = computed(() => knownHues[normalizedId.value] ?? hashHue(normalizedId.value));

const markStyle = computed(() => ({
  borderColor: `hsl(${hue.value} 70% 52% / 0.34)`,
  background: `linear-gradient(135deg, hsl(${hue.value} 72% 42% / 0.24), hsl(${hue.value} 72% 30% / 0.10))`,
  color: `hsl(${hue.value} 78% 76%)`
}));

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'h-6 w-6 text-[9px]';
  if (props.size === 'lg') return 'h-10 w-10 text-[12px]';
  return 'h-8 w-8 text-[10px]';
});

function hashHue(value: string) {
  let hash = props.kind === 'git' ? 47 : 17;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360;
  }
  return hash;
}
</script>
