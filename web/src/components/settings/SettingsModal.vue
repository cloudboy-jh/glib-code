<template>
  <UiDialog size="xl" dialog-class="h-[82vh] max-w-[1180px] overflow-hidden" :show-close-button="false" @close="$emit('close')">
    <div class="flex h-14 shrink-0 items-center border-b border-border/80 px-5">
      <div>
        <h3 class="text-base font-semibold tracking-[0.01em]">Settings</h3>
        <p class="text-[11px] text-muted-foreground">Runtime, GitTrix, appearance, and shortcuts.</p>
      </div>
      <UiButton variant="outline" size="sm" class="ml-auto" @click="$emit('close')">Close</UiButton>
    </div>

    <div class="grid min-h-0 flex-1 grid-cols-[190px_1fr]">
      <nav class="border-r border-border/80 bg-background/20 p-3">
        <button
          v-for="t in tabs"
          :key="t"
          :class="[
            'mb-1 flex h-11 w-full items-center justify-between rounded-lg border px-3 text-left text-sm font-medium transition-colors',
            tab === t ? 'border-border bg-muted/80 text-foreground' : 'border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/55 hover:text-foreground'
          ]"
          @click="tab = t"
        >
          <span>{{ t }}</span>
          <span v-if="t === 'Models'" class="rounded-full border border-border/60 px-1.5 py-0.5 text-[10px]">{{ authenticatedProviderCount }}</span>
        </button>
      </nav>

      <section class="min-h-0 overflow-auto p-6">
        <template v-if="tab === 'Models'">
          <div class="space-y-4">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Models</p>
                <h4 class="mt-1 text-xl font-semibold tracking-tight">Model access</h4>
                <p class="mt-1 text-sm text-muted-foreground">Choose the active model and manage provider keys.</p>
              </div>
            </div>

            <div class="rounded-xl border border-border/70 bg-background/35 p-4">
              <div class="flex items-center justify-between gap-4">
                <div class="flex min-w-0 items-center gap-3">
                  <ModelIcon :provider="settings.defaultProvider" :size="36" theme="dark" />
                  <div class="min-w-0">
                    <p class="text-xs text-muted-foreground">Active model</p>
                    <p class="mt-1 truncate text-lg font-semibold text-foreground">{{ settings.defaultProvider }}/{{ settings.defaultModel }}</p>
                    <p class="mt-1 text-xs text-muted-foreground">{{ settings.defaultProvider }} {{ activeProviderConnected ? 'connected' : 'needs key' }}</p>
                  </div>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <UiButton v-if="!activeProviderConnected && authDraftProviderId !== settings.defaultProvider" variant="outline" size="sm" @click="startAuthDraft(settings.defaultProvider)">Add {{ settings.defaultProvider }} key</UiButton>
                  <UiButton variant="outline" size="sm" @click="$emit('open-model-picker')">Change model</UiButton>
                </div>
              </div>
              <div v-if="!activeProviderConnected && authDraftProviderId === settings.defaultProvider" class="mt-4 flex items-center gap-2 border-t border-border/60 pt-4">
                <input v-model="authDraftApiKey" type="password" class="h-9 min-w-0 flex-1 rounded-md border border-border/70 bg-background px-3 text-sm" :placeholder="`Paste ${settings.defaultProvider} API key`" />
                <UiButton size="sm" variant="outline" :disabled="!authDraftApiKey.trim()" @click="saveProviderKey(settings.defaultProvider)">Save</UiButton>
                <button class="text-xs text-muted-foreground" @click="cancelAuthDraft">Cancel</button>
              </div>
            </div>

            <div v-if="authenticatedProviderCount === 0" class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              New here? Get started with
              <a class="underline underline-offset-2" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">OpenRouter</a>
              — one key, broad model access.
            </div>

            <div class="rounded-xl border border-border/70 bg-background/35">
              <div class="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <div>
                  <p class="text-sm font-medium">Providers</p>
                  <p class="text-xs text-muted-foreground">Authenticated providers can run agent sessions.</p>
                </div>
                <span class="text-xs text-muted-foreground">{{ authenticatedProviderCount }} connected</span>
              </div>

              <div class="max-h-[46vh] divide-y divide-border/60 overflow-auto">
                <div v-for="provider in sortedProviders" :key="provider.id" class="grid min-h-[64px] grid-cols-[minmax(0,1fr)_92px] items-center gap-4 px-4 py-2.5">
                  <div class="flex min-w-0 items-center gap-3">
                    <ModelIcon :provider="provider.id" :size="28" theme="dark" />
                    <div class="min-w-0">
                      <div class="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          :disabled="!provider.hasAuth"
                          class="min-w-0 truncate text-left text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:text-muted-foreground/60"
                          @click="$emit('update:provider', provider.id)"
                        >
                          {{ provider.id }}
                        </button>
                        <span v-if="settings.defaultProvider === provider.id" class="rounded-full border border-primary/35 px-1.5 py-0.5 text-[10px] text-primary">Default</span>
                      </div>
                      <p class="mt-1 text-xs text-muted-foreground">{{ provider.modelIds.length }} models · <span :class="provider.hasAuth ? 'text-emerald-300/75' : 'text-muted-foreground/75'">{{ provider.hasAuth ? 'connected' : 'needs key' }}</span></p>
                    </div>
                  </div>

                  <div>
                    <div v-if="!provider.hasAuth && authDraftProviderId !== provider.id" class="flex justify-end">
                      <UiButton size="sm" variant="ghost" @click="startAuthDraft(provider.id)">Add</UiButton>
                    </div>
                    <div v-else-if="provider.hasAuth" class="flex justify-end">
                      <UiButton size="sm" variant="ghost" @click="$emit('provider:remove-auth', provider.id)">Remove</UiButton>
                    </div>
                    <div v-else class="col-span-3 flex items-center gap-2">
                      <input v-model="authDraftApiKey" type="password" class="h-8 w-44 rounded-md border border-border/70 bg-background px-2 text-xs" placeholder="Paste API key" />
                      <UiButton size="sm" variant="outline" :disabled="!authDraftApiKey.trim()" @click="saveProviderKey(provider.id)">Save</UiButton>
                      <button class="text-xs text-muted-foreground" @click="cancelAuthDraft">Cancel</button>
                    </div>
                  </div>
                </div>

                <div v-if="providers.length === 0" class="p-4">
                  <div class="rounded-lg border border-border/60 bg-background/55 p-4">
                    <p class="text-sm text-amber-300">No providers discovered from the local runtime yet.</p>
                    <p class="mt-1 text-xs text-muted-foreground">Add an OpenRouter key to bootstrap model access.</p>
                    <div class="mt-3 flex items-center gap-2">
                      <input v-model="bootstrapApiKey" type="password" class="h-9 flex-1 rounded-md border border-border/70 bg-background px-3 text-sm" placeholder="Paste OpenRouter API key" />
                      <UiButton size="sm" variant="outline" :disabled="!bootstrapApiKey.trim()" @click="saveBootstrapKey">Save</UiButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="tab === 'GitTrix'">
          <div class="mx-auto max-w-[820px] space-y-5 pb-6">
            <div>
              <div>
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">GitTrix</p>
              <h4 class="mt-1 text-xl font-semibold tracking-tight">Isolation and promote flow</h4>
                <p class="mt-1 max-w-2xl text-sm text-muted-foreground">Configure durable storage, ephemeral storage, and promotion.</p>
              </div>
            </div>

            <div class="rounded-xl border border-border/70 bg-background/35 p-4">
              <SettingsOptionGroup title="Durable provider" :options="durableOptions" @select="(id) => $emit('update:gittrix-provider', 'durableProvider', id)" />
              <SettingsOptionGroup class="mt-5" title="Ephemeral provider" :options="ephemeralOptions" @select="(id) => $emit('update:gittrix-provider', 'ephemeralProvider', id)" />
              <SettingsOptionGroup class="mt-5" title="Promote strategy" :options="promoteOptions" @select="(id) => $emit('update:gittrix-provider', 'promoteStrategy', id)" />
            </div>

            <div class="space-y-4">
                <div v-if="settings.durableProvider === 'github'" class="rounded-xl border border-border/70 bg-background/35 p-4">
                  <div class="flex items-center gap-3">
                    <ProviderMark id="github" kind="git" />
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-foreground">GitHub account</p>
                      <p class="mt-1 text-xs text-muted-foreground">{{ githubConnected ? 'Connected' : 'Not connected' }}</p>
                    </div>
                    <UiButton class="ml-auto" variant="outline" size="sm" :disabled="githubConnected" @click="$emit('connect-github')">{{ githubConnected ? 'Connected' : 'Connect' }}</UiButton>
                  </div>
                  <p class="mt-3 text-xs text-muted-foreground">Uses <span class="font-mono text-foreground">gh auth</span>, <span class="font-mono text-foreground">GITHUB_TOKEN</span>, or <span class="font-mono text-foreground">GH_TOKEN</span>.</p>
                </div>

                <div v-if="settings.ephemeralProvider === 'cloudflare-artifacts'" class="rounded-xl border border-border/70 bg-background/35 p-4">
                  <div class="flex items-center gap-3">
                    <ProviderMark id="cloudflare-artifacts" kind="git" />
                    <div>
                      <p class="text-sm font-medium text-foreground">Cloudflare Artifacts</p>
                      <p class="mt-1 text-xs text-muted-foreground">Required for Cloudflare ephemeral storage.</p>
                    </div>
                  </div>
                  <div class="mt-4 space-y-2 text-xs text-muted-foreground">
                    <div class="env-row"><span>CLOUDFLARE_ACCOUNT_ID</span><span>required</span></div>
                    <div class="env-row"><span>CLOUDFLARE_API_TOKEN</span><span>required</span></div>
                    <div class="env-row"><span>CLOUDFLARE_ARTIFACTS_NAMESPACE</span><span>optional</span></div>
                  </div>
                </div>

                <div class="rounded-xl border border-border/70 bg-background/35 p-4">
                  <p class="mb-3 text-sm font-medium">Default landing</p>
                  <div class="grid grid-cols-2 gap-2">
                    <button type="button" :class="landingClass(defaultOpenMode === 'diff')" @click="$emit('update:open-mode', 'diff')">Diffs</button>
                    <button type="button" :class="landingClass(defaultOpenMode === 'session')" @click="$emit('update:open-mode', 'session')">Session</button>
                  </div>
                </div>
            </div>
          </div>
        </template>

        <template v-else-if="tab === 'Appearance'">
          <div class="space-y-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Appearance</p>
              <h4 class="mt-1 text-xl font-semibold tracking-tight">Theme</h4>
            </div>
            <ThemePicker :model-value="settings.themePreset" @update:model-value="$emit('update:theme', $event)" />
          </div>
        </template>

        <template v-else>
          <div class="space-y-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Keyboard shortcuts</p>
              <h4 class="mt-1 text-xl font-semibold tracking-tight">Keybindings</h4>
            </div>
            <KeybindingsEditor :model-value="keybindings" @change="$emit('update:keybinding', $event.command, $event.key)" />
          </div>
        </template>
      </section>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, watch } from 'vue';
import UiButton from '../ui/button.vue';
import UiDialog from '../ui/dialog.vue';
import ModelIcon from '../shared/ModelIcon.vue';
import ProviderMark from '../shared/ProviderMark.vue';
import KeybindingsEditor from './KeybindingsEditor.vue';
import ThemePicker from './ThemePicker.vue';

type Provider = { id: string; hasAuth: boolean; modelIds: string[] };
type SettingsTab = 'Models' | 'GitTrix' | 'Appearance' | 'Keybindings';

const props = defineProps<{
  settings: { themePreset: string; defaultProvider: string; defaultModel: string; durableProvider: string; ephemeralProvider: string; promoteStrategy: string };
  keybindings: Array<{ command: string; key: string }>;
  providers: Provider[];
  githubConnected: boolean;
  defaultOpenMode: 'diff' | 'session';
  initialTab?: 'Models' | 'Git' | 'Appearance' | 'Keybindings';
}>();

const tabs = ['Models', 'GitTrix', 'Appearance', 'Keybindings'] as const;
const tab = ref<SettingsTab>(mapInitialTab(props.initialTab));

watch(
  () => props.initialTab,
  (next) => {
    tab.value = mapInitialTab(next);
  }
);

const authenticatedProviderCount = computed(() => props.providers.filter((provider) => provider.hasAuth).length);
const activeProviderConnected = computed(() => props.providers.some((provider) => provider.id === props.settings.defaultProvider && provider.hasAuth));
const sortedProviders = computed(() => [...props.providers].sort((a, b) => Number(b.hasAuth) - Number(a.hasAuth) || a.id.localeCompare(b.id)));

const durableOptions = computed<GitTrixOption[]>(() => [
  { id: 'local', label: 'Local repo', available: true, selected: props.settings.durableProvider === 'local' },
  { id: 'github', label: 'GitHub', available: true, selected: props.settings.durableProvider === 'github' },
  { id: 'gitlab', label: 'GitLab', available: false, selected: false },
  { id: 'git-remote', label: 'Git remote', available: false, selected: false },
  { id: 'code-storage', label: 'Code Storage', available: false, selected: false }
]);

const ephemeralOptions = computed<GitTrixOption[]>(() => [
  { id: 'local', label: 'Local workspace', available: true, selected: props.settings.ephemeralProvider === 'local' },
  { id: 'cloudflare-artifacts', label: 'Cloudflare Artifacts', available: true, selected: props.settings.ephemeralProvider === 'cloudflare-artifacts' },
  { id: 'gitfork', label: 'GitFork', available: false, selected: false },
  { id: 'code-storage', label: 'Code Storage', available: false, selected: false }
]);

const promoteOptions = computed<GitTrixOption[]>(() => [
  { id: 'commit', label: 'Commit', available: true, selected: props.settings.promoteStrategy === 'commit' },
  { id: 'branch', label: 'Branch', available: false, selected: false },
  { id: 'pr', label: 'Pull request', available: false, selected: false },
  { id: 'patch', label: 'Patch', available: false, selected: false }
]);

const authDraftProviderId = ref('');
const authDraftApiKey = ref('');
const bootstrapApiKey = ref('');

const emit = defineEmits<{
  close: [];
  'update:theme': [value: string];
  'update:provider': [value: string];
  'update:model': [value: string];
  'update:keybinding': [command: string, key: string];
  'update:open-mode': [value: 'diff' | 'session'];
  'update:gittrix-provider': [key: 'durableProvider' | 'ephemeralProvider' | 'promoteStrategy', value: string];
  'connect-github': [];
  'open-gittrix': [];
  'open-model-picker': [];
  'provider:add-auth': [providerId: string, apiKey: string];
  'provider:remove-auth': [providerId: string];
}>();

type GitTrixOption = { id: string; label: string; available: boolean; selected: boolean };

const SettingsOptionGroup = defineComponent({
  props: { title: { type: String, required: true }, options: { type: Array as () => GitTrixOption[], required: true } },
  emits: ['select'],
  setup(componentProps, { emit: componentEmit }) {
    return () => {
      const optionButtons = componentProps.options.map((option) => h('button', {
        key: option.id,
        disabled: !option.available,
        onClick: () => componentEmit('select', option.id),
        class: [
          'flex h-13 min-h-[52px] w-full items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45',
          option.selected ? 'border-primary/35 bg-primary/10 text-foreground' : option.available ? 'border-border/60 bg-background/55 text-foreground hover:bg-muted/55' : 'border-border/40 bg-background/25 text-muted-foreground'
        ]
      }, [
        h('span', { class: 'flex min-w-0 items-center gap-2' }, [
          h(ProviderMark, { id: option.id, kind: 'git', size: 'sm', muted: !option.available }),
          h('span', { class: 'truncate' }, option.label)
        ]),
        h('span', { class: ['shrink-0 text-[11px]', option.selected ? 'text-primary' : 'text-muted-foreground'] }, option.available ? (option.selected ? 'Selected' : 'Available') : 'Coming soon')
      ]));

      return h('div', { class: 'space-y-2' }, [
        h('p', { class: 'text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground' }, componentProps.title),
        h('div', { class: 'space-y-2' }, optionButtons)
      ]);
    };
  }
});

function mapInitialTab(value?: 'Models' | 'Git' | 'Appearance' | 'Keybindings'): SettingsTab {
  return value === 'Git' ? 'GitTrix' : value ?? 'Models';
}

function landingClass(active: boolean) {
  return [
    'h-10 rounded-md border text-sm transition-colors',
    active ? 'border-border bg-muted/80 text-foreground' : 'border-border/60 bg-background/55 text-muted-foreground hover:border-border hover:bg-muted/55 hover:text-foreground'
  ];
}

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

function saveBootstrapKey() {
  const key = bootstrapApiKey.value.trim();
  if (!key) return;
  emit('provider:add-auth', 'openrouter', key);
  bootstrapApiKey.value = '';
}
</script>

<style scoped>
.env-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 10px;
  border: 1px solid hsl(var(--border) / 0.55);
  background: hsl(var(--background) / 0.45);
  padding: 8px 10px;
}

.env-row span:first-child {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  color: hsl(var(--foreground));
}

</style>
