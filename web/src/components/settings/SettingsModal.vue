<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/60" @click.self="$emit('close')">
    <div class="w-full max-w-[760px] rounded-xl border border-border/90 bg-card/95 shadow-2xl shadow-black/45">
      <div class="flex h-12 items-center border-b border-border/80 px-4">
        <h3 class="text-sm font-semibold">Settings</h3>
        <button class="ml-auto h-8 rounded-md border border-border/80 bg-background/55 px-3 text-xs text-muted-foreground hover:text-foreground" @click="$emit('close')">
          Close
        </button>
      </div>

      <div class="grid grid-cols-[170px_1fr]">
        <nav class="border-r border-border/80 p-2">
          <button
            v-for="t in tabs"
            :key="t"
            :class="[
              'mb-1 h-9 w-full rounded-md border px-3 text-left text-xs font-medium',
              tab === t ? 'border-border bg-muted/80 text-foreground' : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/55'
            ]"
            @click="tab = t"
          >
            {{ t }}
          </button>
        </nav>

        <section class="space-y-6 p-4">
          <template v-if="tab === 'General'">
            <div class="space-y-4">
              <p class="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Model defaults</p>
              <div>
                <label class="mb-1 block text-xs text-muted-foreground">Default provider</label>
                <select
                  class="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
                  :value="settings.defaultProvider"
                  @change="$emit('update:provider', ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="provider in providers" :key="provider.id" :value="provider.id" :disabled="!provider.hasAuth">
                    {{ provider.id }}{{ provider.hasAuth ? '' : ' (not authenticated)' }}
                  </option>
                </select>
              </div>

              <div>
                <label class="mb-1 block text-xs text-muted-foreground">Default model</label>
                <select
                  class="h-9 w-full rounded-md border border-border/70 bg-background px-2 text-sm"
                  :value="settings.defaultModel"
                  @change="$emit('update:model', ($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="modelId in activeModelIds" :key="modelId" :value="modelId">{{ modelId }}</option>
                </select>
              </div>

              <p v-if="!activeProvider?.hasAuth" class="text-xs text-amber-400">Provider not authenticated in opencode.</p>
            </div>
          </template>

          <template v-else-if="tab === 'Appearance'">
            <div>
              <p class="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Theme</p>
              <ThemePicker :model-value="settings.themePreset" @update:model-value="$emit('update:theme', $event)" />
            </div>
          </template>

          <template v-else>
            <div>
              <p class="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Keyboard shortcuts</p>
              <KeybindingsEditor :model-value="keybindings" @change="$emit('update:keybinding', $event.command, $event.key)" />
            </div>
          </template>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import ThemePicker from './ThemePicker.vue';
import KeybindingsEditor from './KeybindingsEditor.vue';

const props = defineProps<{
  settings: { themePreset: string; defaultProvider: string; defaultModel: string };
  keybindings: Array<{ command: string; key: string }>;
  providers: Array<{ id: string; hasAuth: boolean; modelIds: string[] }>;
}>();
defineEmits<{
  close: [];
  'update:theme': [value: string];
  'update:provider': [value: string];
  'update:model': [value: string];
  'update:keybinding': [command: string, key: string];
}>();

const tabs = ['General', 'Appearance', 'Keybindings'] as const;
const tab = ref<(typeof tabs)[number]>('General');

const activeProvider = computed(() => props.providers.find((provider) => provider.id === props.settings.defaultProvider));
const activeModelIds = computed(() => activeProvider.value?.modelIds ?? []);
</script>
