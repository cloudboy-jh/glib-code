<template>
  <UiDialog size="xl" dialog-class="h-[min(760px,calc(100vh-40px))] max-w-[61.25rem] overflow-hidden" :show-close-button="false" @close="$emit('close')">
    <div class="flex h-14 shrink-0 items-center border-b border-border/80 bg-card/70 px-5">
      <div>
        <h3 class="text-base font-semibold tracking-tight">Settings</h3>
        <p class="text-[0.6875rem] text-muted-foreground">{{ activeTabDescription }}</p>
      </div>
      <UiButton variant="outline" size="sm" class="ml-auto" @click="$emit('close')">Close</UiButton>
    </div>

    <div class="grid min-h-0 flex-1 grid-cols-[188px_1fr]">
      <nav class="border-r border-border/80 bg-background/20 p-2.5" aria-label="Settings sections">
        <button
          v-for="t in tabs"
          :key="t"
          type="button"
          :aria-current="tab === t ? 'page' : undefined"
          :class="[
            'mb-1 flex h-10 w-full items-center justify-between rounded-lg border px-3 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            tab === t ? 'border-border bg-muted/75 text-foreground shadow-sm' : 'border-transparent text-muted-foreground hover:bg-muted/45 hover:text-foreground'
          ]"
          @click="tab = t"
        >
          <span>{{ t }}</span>
          <span v-if="t === 'Models'" class="rounded-full border border-border/60 px-1.5 py-0.5 text-[0.625rem] text-muted-foreground">{{ authenticatedProviderCount }}</span>
        </button>
      </nav>

      <section class="min-h-0 overflow-auto bg-background/10 px-6 py-6 sm:px-7" aria-live="polite">
        <div :class="['min-h-full w-full', tab === 'Editor' || tab === 'Appearance' ? 'flex flex-col' : 'space-y-5']">
          <template v-if="tab === 'Models'">
            <SectionShell title="Active model" aria-label="Active model">
              <div class="settings-row">
                <div class="flex min-w-0 items-center gap-3">
                  <ModelIcon :provider="settings.defaultProvider" :size="30" />
                  <div class="min-w-0">
                    <p class="text-sm font-medium">Active model</p>
                    <p class="truncate text-sm text-muted-foreground">{{ settings.defaultProvider }}/{{ settings.defaultModel }}</p>
                  </div>
                </div>
                <UiButton variant="outline" size="sm" @click="$emit('open-model-picker')">Change</UiButton>
              </div>
            </SectionShell>

            <SectionShell
              v-if="currentProjectName && projectProvider"
              title="Project override"
              :meta="projectOverrideActive ? 'Active' : 'Using default'"
              aria-label="Project model override"
            >
              <div class="settings-row">
                <div class="min-w-0">
                  <p class="text-sm font-medium">{{ currentProjectName }}</p>
                  <p class="mt-0.5 truncate text-sm text-muted-foreground">
                    Effective: {{ projectProvider.effective.provider }}/{{ projectProvider.effective.model }}
                  </p>
                  <p class="mt-0.5 text-[0.6875rem] text-muted-foreground">
                    <span v-if="projectOverrideActive" class="text-primary">Pinned for this project</span>
                    <span v-else>Inherits app default ({{ projectProvider.defaults.provider }}/{{ projectProvider.defaults.model }})</span>
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <UiButton
                    v-if="projectOverrideActive"
                    variant="outline"
                    size="sm"
                    @click="$emit('project-override:clear')"
                  >Clear</UiButton>
                  <UiButton
                    variant="outline"
                    size="sm"
                    :disabled="projectProvider.effective.provider === settings.defaultProvider && projectProvider.effective.model === settings.defaultModel && projectOverrideActive"
                    @click="$emit('project-override:pin')"
                  >Pin current default</UiButton>
                </div>
              </div>
            </SectionShell>

            <SectionShell title="Connected providers" :meta="`${connectedProviders.length} connected`" aria-label="Connected providers">
              <ProviderRow v-for="provider in connectedProviders" :key="provider.id" :provider="provider" :active="provider.id === settings.defaultProvider" @select="$emit('update:provider', provider.id)" @remove="$emit('provider:remove-auth', provider.id)" />
              <p v-if="connectedProviders.length === 0" class="px-4 py-4 text-sm text-muted-foreground">No connected providers yet.</p>
            </SectionShell>

            <SectionShell title="Available providers" meta="Add API keys" aria-label="Available providers">
              <div v-for="provider in availableProviders" :key="provider.id" class="border-t border-border/60 first:border-t-0">
                <ProviderRow :provider="provider" :active="false" @add="startAuthDraft(provider.id)" />
                <div v-if="authDraftProviderId === provider.id" class="flex items-center gap-2 px-4 pb-3">
                  <input v-model="authDraftApiKey" type="password" class="h-8 min-w-0 flex-1 rounded-md border border-border/70 bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" :placeholder="`Paste ${provider.id} API key`" />
                  <UiButton size="sm" variant="outline" :disabled="!authDraftApiKey.trim()" @click="saveProviderKey(provider.id)">Save</UiButton>
                  <button class="rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" @click="cancelAuthDraft">Cancel</button>
                </div>
              </div>
            </SectionShell>
          </template>

          <template v-else-if="tab === 'GitTrix'">
            <SectionShell title="Durable storage" aria-label="Durable storage">
              <SettingOptionRow
                label="Local repo"
                detail="Commit into the current checkout"
                :selected="settings.durableProvider === 'local'"
                @click="$emit('update:gittrix-provider', 'durableProvider', 'local')"
              />
              <SettingOptionRow
                label="GitHub"
                :detail="githubConnected ? `Signed in as ${githubAccount || 'GitHub user'}` : 'Sign in to enable GitHub promote flow'"
                :selected="settings.durableProvider === 'github'"
                @click="$emit('update:gittrix-provider', 'durableProvider', 'github')"
              />
              <SettingActionRow
                label="GitHub account"
                :detail="githubConnected ? `Signed in as ${githubAccount || 'GitHub user'}` : 'Not connected'"
                :action-label="githubConnected ? 'Disconnect' : (githubSigningIn ? 'Signing in…' : 'Connect')"
                :action-disabled="Boolean(githubSigningIn)"
                @action="githubConnected ? $emit('disconnect-github') : $emit('connect-github')"
              >
                <template #leading>
                  <img v-if="githubConnected && githubAvatarUrl" :src="githubAvatarUrl" alt="" class="h-8 w-8 rounded-full border border-border/70" />
                  <div v-else class="grid h-8 w-8 place-items-center rounded-full border border-border/70 text-xs text-muted-foreground">GH</div>
                </template>
              </SettingActionRow>
            </SectionShell>

            <SectionShell title="Workspace storage" aria-label="Workspace storage">
              <SettingOptionRow label="Local workspace" detail="Use local GitTrix workspaces" :selected="settings.ephemeralProvider === 'local'" @click="$emit('update:gittrix-provider', 'ephemeralProvider', 'local')" />
              <SettingOptionRow label="Cloudflare Artifacts" detail="Remote ephemeral workspaces" :selected="settings.ephemeralProvider === 'cloudflare-artifacts'" @click="$emit('update:gittrix-provider', 'ephemeralProvider', 'cloudflare-artifacts')" />
            </SectionShell>

            <SectionShell title="Promote behavior" aria-label="Promote behavior">
              <SettingOptionRow label="Commit" detail="Commit selected session changes" selected @click="$emit('update:gittrix-provider', 'promoteStrategy', 'commit')" />
            </SectionShell>
          </template>

          <template v-else-if="tab === 'Editor'">
            <SectionShell class="settings-section--fill" title="Default editor" meta="Project and file opens" aria-label="Editor integration">
              <div class="settings-stretch-list">
                <SettingOptionRow
                  v-for="editor in editorOptions"
                  :key="editor.id"
                  :label="editor.name"
                  :detail="editor.command"
                  :selected="settings.preferredEditor === editor.id"
                  @click="$emit('update:preferred-editor', editor.id)"
                >
                  <template #leading>
                    <EditorIcon :editor="editor.id" :size="24" />
                  </template>
                </SettingOptionRow>
                <SettingOptionRow label="None" detail="Disabled" :selected="!settings.preferredEditor" @click="$emit('update:preferred-editor', null)">
                  <template #leading>
                    <span class="grid h-6 w-6 place-items-center rounded-full border border-border/70 text-xs text-muted-foreground">—</span>
                  </template>
                </SettingOptionRow>
              </div>
            </SectionShell>
          </template>

          <template v-else-if="tab === 'Appearance'">
            <section class="settings-section settings-section--fill p-4" aria-label="Theme">
              <ThemePicker :model-value="settings.themePreset" @update:model-value="$emit('update:theme', $event)" />
            </section>
          </template>
        </div>
      </section>
    </div>
  </UiDialog>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, watch } from 'vue';
import type { ThemePreset } from '@glib-code/shared/theme/presets';
import { Check } from 'lucide-vue-next';
import UiButton from '../ui/button.vue';
import UiDialog from '../ui/dialog.vue';
import ModelIcon from '../shared/ModelIcon.vue';
import EditorIcon from '../shared/EditorIcon.vue';
import ThemePicker from './ThemePicker.vue';

type Provider = { id: string; hasAuth: boolean; modelIds: string[] };
type SettingsTab = 'Models' | 'GitTrix' | 'Editor' | 'Appearance';

const props = defineProps<{
  settings: { themePreset: string; defaultProvider: string; defaultModel: string; durableProvider: string; ephemeralProvider: string; promoteStrategy: string; preferredEditor: string | null };
  providers: Provider[];
  githubConnected: boolean;
  githubAccount?: string;
  githubAvatarUrl?: string;
  githubSigningIn?: boolean;
  githubUserCode?: string;
  githubVerificationUri?: string;
  githubError?: string;
  defaultOpenMode: 'diff' | 'session';
  initialTab?: 'Models' | 'Git' | 'Integrations' | 'Editor' | 'Appearance';
  currentProjectName?: string;
  projectProvider?: {
    override: { provider?: string; model?: string };
    defaults: { provider: string; model: string };
    effective: { provider: string; model: string };
  } | null;
}>();

const emit = defineEmits<{
  close: [];
  'update:theme': [value: ThemePreset];
  'update:provider': [value: string];
  'update:model': [value: string];
  'update:open-mode': [value: 'diff' | 'session'];
  'update:gittrix-provider': [key: 'durableProvider' | 'ephemeralProvider' | 'promoteStrategy', value: string];
  'update:preferred-editor': [value: string | null];
  'connect-github': [];
  'disconnect-github': [];
  'open-gittrix': [];
  'open-model-picker': [];
  'provider:add-auth': [providerId: string, apiKey: string];
  'provider:remove-auth': [providerId: string];
  'project-override:pin': [];
  'project-override:clear': [];
}>();

const projectOverrideActive = computed(() =>
  Boolean(props.projectProvider?.override.provider || props.projectProvider?.override.model)
);

const tabs = ['Models', 'GitTrix', 'Editor', 'Appearance'] as const;
const tab = ref<SettingsTab>(mapInitialTab(props.initialTab));
const authDraftProviderId = ref('');
const authDraftApiKey = ref('');

watch(() => props.initialTab, (next) => { tab.value = mapInitialTab(next); });

const tabMeta: Record<SettingsTab, { description: string }> = {
  Models: { description: 'Choose the active model and manage provider keys.' },
  GitTrix: { description: 'Configure storage and promotion behavior.' },
  Editor: { description: 'Choose your default editor for project and file opens.' },
  Appearance: { description: 'Pick the app color theme.' }
};

function mapInitialTab(value?: 'Models' | 'Git' | 'Integrations' | 'Editor' | 'Appearance'): SettingsTab {
  if (value === 'Git') return 'GitTrix';
  if (value === 'Integrations') return 'Editor';
  return value ?? 'Models';
}
const activeTabDescription = computed(() => tabMeta[tab.value].description);
const authenticatedProviderCount = computed(() => props.providers.filter((provider) => provider.hasAuth).length);
const connectedProviders = computed(() => props.providers.filter((provider) => provider.hasAuth).sort((a, b) => Number(b.id === props.settings.defaultProvider) - Number(a.id === props.settings.defaultProvider) || a.id.localeCompare(b.id)));
const availableProviders = computed(() => props.providers.filter((provider) => !provider.hasAuth).slice(0, 8));

const editorOptions = [
  { id: 'vscode', name: 'VS Code', command: 'code' },
  { id: 'cursor', name: 'Cursor', command: 'cursor' },
  { id: 'zed', name: 'Zed', command: 'zed' },
  { id: 'obsidian', name: 'Obsidian', command: 'obsidian://' }
] as const;

const SectionHeader = defineComponent({
  props: { title: { type: String, required: true }, meta: { type: String, default: '' } },
  setup(sectionProps) {
    return () => h('div', { class: 'flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3' }, [
      h('p', { class: 'text-sm font-semibold' }, sectionProps.title),
      sectionProps.meta ? h('span', { class: 'text-xs text-muted-foreground' }, sectionProps.meta) : null
    ]);
  }
});

const SectionShell = defineComponent({
  props: {
    title: { type: String, required: true },
    meta: { type: String, default: '' }
  },
  setup(sectionProps, { slots }) {
    return () => h('section', { class: 'settings-section' }, [
      h(SectionHeader, { title: sectionProps.title, meta: sectionProps.meta }),
      slots.default?.()
    ]);
  }
});

const SettingOptionRow = defineComponent({
  props: {
    label: { type: String, required: true },
    detail: { type: String, default: '' },
    selected: { type: Boolean, default: false }
  },
  emits: ['click'],
  setup(rowProps, { slots, emit: rowEmit }) {
    return () => h('button', {
      type: 'button',
      class: ['settings-row settings-option-row w-full border-t border-border/60 text-left first:border-t-0 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring', rowProps.selected ? 'bg-muted/45' : 'hover:bg-muted/35'],
      onClick: () => rowEmit('click')
    }, [
      h('div', { class: 'flex min-w-0 items-center gap-3' }, [
        slots.leading?.(),
        h('div', { class: 'min-w-0' }, [
          h('p', { class: 'text-sm font-medium' }, rowProps.label),
          rowProps.detail ? h('p', { class: 'text-xs text-muted-foreground' }, rowProps.detail) : null
        ])
      ]),
      rowProps.selected
        ? h('span', { class: 'inline-flex h-5 w-5 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-primary' }, [
            h(Check, { class: 'h-3.5 w-3.5' })
          ])
        : null
    ]);
  }
});

const SettingActionRow = defineComponent({
  props: {
    label: { type: String, required: true },
    detail: { type: String, default: '' },
    actionLabel: { type: String, required: true },
    actionDisabled: { type: Boolean, default: false }
  },
  emits: ['action'],
  setup(rowProps, { slots, emit: rowEmit }) {
    return () => h('div', { class: 'settings-row w-full border-t border-border/60 first:border-t-0' }, [
      h('div', { class: 'flex min-w-0 items-center gap-3' }, [
        slots.leading?.(),
        h('div', { class: 'min-w-0' }, [
          h('p', { class: 'text-sm font-medium' }, rowProps.label),
          rowProps.detail ? h('p', { class: 'text-xs text-muted-foreground' }, rowProps.detail) : null
        ])
      ]),
      h(UiButton, { size: 'sm', variant: 'outline', disabled: rowProps.actionDisabled, onClick: () => rowEmit('action') }, () => rowProps.actionLabel)
    ]);
  }
});

const ProviderRow = defineComponent({
  props: { provider: { type: Object as () => Provider, required: true }, active: { type: Boolean, default: false } },
  emits: ['select', 'remove', 'add'],
  setup(rowProps, { emit: rowEmit }) {
    return () => h('div', { class: 'settings-row border-t border-border/60 first:border-t-0' }, [
      h('button', { type: 'button', class: 'flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 text-left transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring', disabled: !rowProps.provider.hasAuth, onClick: () => rowProps.provider.hasAuth && rowEmit('select') }, [
        h(ModelIcon, { provider: rowProps.provider.id, size: 28 }),
        h('div', { class: 'min-w-0' }, [
          h('div', { class: 'flex items-center gap-2' }, [
            h('span', { class: ['truncate text-sm font-medium', rowProps.provider.hasAuth ? 'text-foreground' : 'text-muted-foreground'] }, rowProps.provider.id),
            rowProps.active ? h('span', { class: 'rounded-full border border-primary/35 px-1.5 py-0.5 text-[0.625rem] text-primary' }, 'Default') : null
          ]),
          h('p', { class: 'text-xs text-muted-foreground' }, `${rowProps.provider.modelIds.length} models · ${rowProps.provider.hasAuth ? 'connected' : 'needs key'}`)
        ])
      ]),
      rowProps.provider.hasAuth
        ? h(UiButton, { size: 'sm', variant: 'ghost', onClick: () => rowEmit('remove') }, () => 'Remove')
        : h(UiButton, { size: 'sm', variant: 'ghost', onClick: () => rowEmit('add') }, () => 'Add key')
    ]);
  }
});

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

<style scoped>
.settings-section {
  overflow: hidden;
  display: flex;
  min-height: 0;
  flex-direction: column;
  border-radius: 0.875rem;
  border: 1px solid hsl(var(--border) / 0.72);
  background: hsl(var(--background) / 0.32);
}

.settings-section--fill {
  flex: 1 1 auto;
}

.settings-stretch-list {
  display: block;
}

.settings-row {
  display: flex;
  min-height: 3.625rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.875rem;
  padding: 0.625rem 1rem;
}

@media (max-width: 920px) {
  .settings-row {
    min-height: 3.375rem;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
  }
}
</style>
