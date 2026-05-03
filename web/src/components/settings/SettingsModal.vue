<template>
  <UiDialog size="xl" :show-close-button="false" @close="$emit('close')">
    <div class="flex h-14 items-center border-b border-border/80 px-5">
      <h3 class="text-base font-semibold tracking-[0.01em]">Settings</h3>
      <UiButton variant="outline" size="sm" class="ml-auto" @click="$emit('close')">Close</UiButton>
    </div>

    <div class="grid grid-cols-[180px_1fr]">
      <nav class="border-r border-border/80 p-3">
        <button
          v-for="t in tabs"
          :key="t"
          :class="[
            'mb-1 h-10 w-full rounded-md border px-3 text-left text-sm font-medium transition-colors',
            tab === t ? 'border-border bg-muted/80 text-foreground' : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/55'
          ]"
          @click="tab = t"
        >
          {{ t }}
        </button>
      </nav>

      <section class="space-y-6 p-5">
        <template v-if="tab === 'Models'">
          <div class="space-y-5">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Model setup</p>
              <p class="mt-1 text-xs text-muted-foreground">Pick a provider first, then choose a model. This mirrors opencode provider/model capability state.</p>
            </div>

            <div v-if="authenticatedProviderCount === 0" class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              New here? Get started with
              <a class="underline underline-offset-2" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">OpenRouter</a>
              — one key, all models.
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">Providers</label>
              <div class="space-y-1 rounded-lg border border-border/70 bg-background/40 p-2">
                <div v-for="provider in providers" :key="provider.id" class="rounded-md border border-transparent p-1 hover:border-border/60">
                  <button
                    type="button"
                    :disabled="!provider.hasAuth"
                    :class="[
                      'flex h-10 w-full items-center justify-between rounded-md border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45',
                      settings.defaultProvider === provider.id
                        ? 'border-border bg-muted/80 text-foreground'
                        : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/55 hover:text-foreground'
                    ]"
                    @click="$emit('update:provider', provider.id)"
                  >
                    <span class="truncate">{{ provider.id }}</span>
                    <span class="text-[11px] text-muted-foreground">{{ provider.modelIds.length }} models</span>
                  </button>

                  <div v-if="!provider.hasAuth" class="mt-2">
                    <button
                      v-if="authDraftProviderId !== provider.id"
                      class="text-xs text-primary underline underline-offset-2"
                      @click="startAuthDraft(provider.id)"
                    >
                      Add API key
                    </button>
                    <div v-else class="flex items-center gap-2">
                      <input
                        v-model="authDraftApiKey"
                        type="password"
                        class="h-8 flex-1 rounded-md border border-border/70 bg-background px-2 text-xs"
                        placeholder="Paste API key"
                      />
                      <UiButton size="sm" variant="outline" @click="saveProviderKey(provider.id)">Save</UiButton>
                      <button class="text-xs text-muted-foreground" @click="cancelAuthDraft">Cancel</button>
                    </div>
                  </div>

                  <div v-else class="mt-1">
                    <button class="text-xs text-muted-foreground underline underline-offset-2" @click="$emit('provider:remove-auth', provider.id)">Remove</button>
                  </div>
                </div>
                <p v-if="providers.length === 0" class="px-2 py-3 text-xs text-amber-400">No providers discovered. Run <span class="font-mono">opencode auth list</span>.</p>
              </div>
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">Models for {{ activeProvider?.id ?? 'selected provider' }}</label>
              <div class="max-h-[220px] space-y-1 overflow-auto rounded-lg border border-border/70 bg-background/40 p-2">
                <button
                  v-for="modelId in activeModelIds"
                  :key="modelId"
                  type="button"
                  :class="[
                    'flex h-10 w-full items-center rounded-md border px-3 text-left text-sm transition-colors',
                    settings.defaultModel === modelId
                      ? 'border-border bg-muted/80 text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/55 hover:text-foreground'
                  ]"
                  @click="$emit('update:model', modelId)"
                >
                  <span class="truncate">{{ modelId }}</span>
                </button>
                <p v-if="!activeProvider?.hasAuth" class="px-2 py-3 text-xs text-amber-400">Provider is not authenticated in opencode.</p>
                <p v-else-if="activeModelIds.length === 0" class="px-2 py-3 text-xs text-amber-400">No models returned for this provider.</p>
              </div>
            </div>

            <div class="rounded-lg border border-border/70 bg-background/50 p-3 text-xs text-muted-foreground">
              <p>
                Providers: <span class="text-foreground">{{ providers.length }}</span> · Authenticated:
                <span class="text-foreground">{{ authenticatedProviderCount }}</span> · Models:
                <span class="text-foreground">{{ activeModelIds.length }}</span>
              </p>
            </div>
          </div>
        </template>

        <template v-else-if="tab === 'Git'">
          <div class="space-y-5">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">GitTrix setup</p>
              <p class="mt-1 text-xs text-muted-foreground">Set default landing behavior, then jump into GitTrix (diff workbench) for commit flow.</p>
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-muted-foreground">Default project landing mode</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  :class="[
                    'h-10 rounded-md border text-sm transition-colors',
                    defaultOpenMode === 'diff'
                      ? 'border-border bg-muted/80 text-foreground'
                      : 'border-border/60 bg-background/55 text-muted-foreground hover:border-border hover:bg-muted/55 hover:text-foreground'
                  ]"
                  @click="$emit('update:open-mode', 'diff')"
                >
                  Diffs
                </button>
                <button
                  type="button"
                  :class="[
                    'h-10 rounded-md border text-sm transition-colors',
                    defaultOpenMode === 'session'
                      ? 'border-border bg-muted/80 text-foreground'
                      : 'border-border/60 bg-background/55 text-muted-foreground hover:border-border hover:bg-muted/55 hover:text-foreground'
                  ]"
                  @click="$emit('update:open-mode', 'session')"
                >
                  Session
                </button>
              </div>
              <p class="mt-1.5 text-xs text-muted-foreground">Used as the default when selecting mode after opening or cloning a project.</p>
            </div>

            <div class="rounded-lg border border-border/70 bg-background/50 p-3">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-medium text-foreground">GitTrix controls</p>
                  <p class="text-xs text-muted-foreground">Open GitTrix now. If a project is open it jumps to diffs, otherwise it opens project picker.</p>
                </div>
                <UiButton variant="outline" size="sm" @click="$emit('open-gittrix')">Open GitTrix</UiButton>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="tab === 'Appearance'">
          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Theme</p>
            <ThemePicker :model-value="settings.themePreset" @update:model-value="$emit('update:theme', $event)" />
          </div>
        </template>

        <template v-else>
          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Keyboard shortcuts</p>
            <KeybindingsEditor :model-value="keybindings" @change="$emit('update:keybinding', $event.command, $event.key)" />
          </div>
        </template>
      </section>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import UiButton from '../ui/button.vue';
import UiDialog from '../ui/dialog.vue';
import KeybindingsEditor from './KeybindingsEditor.vue';
import ThemePicker from './ThemePicker.vue';

const props = defineProps<{
  settings: { themePreset: string; defaultProvider: string; defaultModel: string };
  keybindings: Array<{ command: string; key: string }>;
  providers: Array<{ id: string; hasAuth: boolean; modelIds: string[] }>;
  defaultOpenMode: 'diff' | 'session';
  initialTab?: 'Models' | 'Git' | 'Appearance' | 'Keybindings';
}>();

const tabs = ['Models', 'Git', 'Appearance', 'Keybindings'] as const;
const tab = ref<(typeof tabs)[number]>(props.initialTab ?? 'Models');

watch(
  () => props.initialTab,
  (next) => {
    if (next) tab.value = next;
  }
);

const activeProvider = computed(() => props.providers.find((provider) => provider.id === props.settings.defaultProvider));
const activeModelIds = computed(() => activeProvider.value?.modelIds ?? []);
const authenticatedProviderCount = computed(() => props.providers.filter((provider) => provider.hasAuth).length);

const authDraftProviderId = ref('');
const authDraftApiKey = ref('');

const emit = defineEmits<{
  close: [];
  'update:theme': [value: string];
  'update:provider': [value: string];
  'update:model': [value: string];
  'update:keybinding': [command: string, key: string];
  'update:open-mode': [value: 'diff' | 'session'];
  'open-gittrix': [];
  'provider:add-auth': [providerId: string, apiKey: string];
  'provider:remove-auth': [providerId: string];
}>();

function startAuthDraft(providerId: string) {
  authDraftProviderId.value = providerId;
  authDraftApiKey.value = '';
}

function cancelAuthDraft() {
  authDraftProviderId.value = '';
  authDraftApiKey.value = '';
}

function saveProviderKey(providerId: string) {
  const key = authDraftApiKey.value.trim();
  if (!key) return;
  emit('provider:add-auth', providerId, key);
  cancelAuthDraft();
}
</script>
