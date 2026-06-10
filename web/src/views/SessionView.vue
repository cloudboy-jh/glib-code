<template>
  <template v-if="activeSession">
    <div class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <SessionContextCapsule
        v-if="activeContextSummary"
        :summary="activeContextSummary"
        @view="$emit('openContextViewer')"
        @remove="$emit('removeActiveContext')"
        @back-to-diffs="$emit('backToDiffs')"
      />
      <div v-if="activeSessionNotice" class="mx-auto mt-2 w-full max-w-5xl px-3 sm:px-5">
        <div class="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <span class="font-medium">{{ activeSessionNotice }}</span>
          <span class="ml-auto" />
          <button class="rounded border border-amber-300/30 px-2 py-1 hover:bg-amber-400/10" @click="$emit('reloadActiveSessions')">Reload sessions</button>
          <button class="rounded border border-amber-300/30 px-2 py-1 hover:bg-amber-400/10" @click="$emit('createReplacementSession')">New replacement</button>
        </div>
      </div>

      <Timeline :entries="activeTimeline" :theme-preset="themePreset" :theme-type="themeType" @open-file-diff="$emit('openFileDiff', $event)" />

      <Composer
        :context="contextLabel"
        :prompt="prompt"
        :meta="selectedModelLabel"
        :context-chips="activeContextChips"
        :text-attachments="textAttachments"
        :attachments="attachments"
        :disabled="composerDisabled"
        :is-running="isAgentRunning"
        :is-stopping="isAgentStopping"
        @update:prompt="$emit('updatePrompt', $event)"
        @send="$emit('sendPrompt')"
        @stop="$emit('stopAgent')"
        @execute-command="(v, a) => $emit('runComposerCommand', v, a)"
        @remove-context-chip="$emit('removeContextChip', $event)"
        @attach="$emit('openAttachmentPicker')"
        @show-tree="$emit('showTree')"
        @remove-attachment="$emit('removeAttachment', $event)"
        @retry-attachment="$emit('retryAttachment', $event)"
        @add-text-attachment="$emit('addTextAttachment', $event)"
        @remove-text-attachment="$emit('removeTextAttachment', $event)"
        @view-text-attachment="$emit('viewTextAttachment', $event)"
      />
    </div>
  </template>

  <template v-else>
    <div class="grid h-full place-items-center p-6">
      <div class="w-full max-w-3xl rounded-xl border border-border/80 bg-card/55 p-6">
        <h2 class="mb-2 text-lg font-semibold">Session workspace</h2>
        <p class="mb-4 text-sm text-muted-foreground">Choose continue or start new.</p>
        <div class="mb-4 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            class="group flex items-start gap-3 rounded-lg border border-border/70 bg-background/40 p-4 text-left transition-colors hover:bg-accent/45"
            @click="$emit('toggleContinue')"
          >
            <div class="mt-0.5 rounded-md border border-border/70 bg-background/60 p-1.5 text-muted-foreground group-hover:text-foreground">
              <History class="h-4 w-4" />
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold">Continue</div>
              <div class="mt-0.5 text-xs text-muted-foreground">Pick an existing session</div>
            </div>
          </button>
          <button
            type="button"
            class="group flex items-start gap-3 rounded-lg border border-border/70 bg-background/40 p-4 text-left transition-colors hover:bg-accent/45"
            @click="$emit('createSession')"
          >
            <div class="mt-0.5 rounded-md border border-border/70 bg-background/60 p-1.5 text-muted-foreground group-hover:text-foreground">
              <PlusSquare class="h-4 w-4" />
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold">New session</div>
              <div class="mt-0.5 text-xs text-muted-foreground">Start a fresh isolated workspace</div>
            </div>
          </button>
        </div>
        <div v-if="sessionContinueOpen" class="mb-4 rounded-lg border border-border/70 bg-background/40 p-3">
          <div class="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">Recent sessions</div>
          <div v-if="recentProjectSessions.length" class="space-y-2 text-left">
            <button
              v-for="session in recentProjectSessions"
              :key="`landing-${session.id}`"
              type="button"
              class="flex w-full items-center gap-2 rounded-md border border-border/70 bg-background/50 px-3 py-2 text-left text-sm hover:bg-accent/60"
              @click="$emit('selectSession', session.id)"
            >
              <span class="min-w-0 flex-1 truncate">{{ session.title }}</span>
              <span class="shrink-0 text-xs text-muted-foreground/75">{{ session.time }}</span>
            </button>
          </div>
          <div v-else class="text-left text-xs text-muted-foreground">No existing sessions for this project.</div>
        </div>
        <div v-if="agentSetupMessage" class="mb-4 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3 text-left text-xs text-amber-200">
          <p>{{ agentSetupMessage }}</p>
          <div v-if="agentSetupKind === 'gittrix'" class="mt-2 flex flex-wrap gap-3">
            <button class="underline underline-offset-2" @click="$emit('openGitSettings')">Open GitTrix settings</button>
            <button class="underline underline-offset-2" @click="$emit('useLocalGittrix')">Use local GitTrix</button>
          </div>
          <div v-else class="mt-2 flex flex-wrap gap-3">
            <button class="underline underline-offset-2" @click="$emit('openModelSettings')">Add {{ defaultProvider }} key</button>
            <button v-if="compatibleUsableModel" class="underline underline-offset-2" @click="$emit('useCompatibleModel', compatibleUsableModel)">
              Use {{ compatibleUsableModel.providerId }}/{{ compatibleUsableModel.modelId }}
            </button>
            <button class="underline underline-offset-2" @click="$emit('openModelPicker')">Change model</button>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import type { ThemePreset } from '@glib-code/shared/theme/presets';
import { History, PlusSquare } from 'lucide-vue-next';
import Composer from '../components/session/Composer.vue';
import SessionContextCapsule from '../components/session/SessionContextCapsule.vue';
import Timeline from '../components/session/Timeline.vue';

type TimelineEntry = {
  id: string;
  kind: string;
  text: string;
  time: string;
  at?: string;
  level?: 'info' | 'error';
  attachments?: Array<{ id: string; name: string }>;
  toolCalls?: Array<{
    id: string;
    title: string;
    status: 'running' | 'done' | 'failed';
    renderKind: 'diff' | 'code' | 'json' | 'terminal' | 'text' | 'tree' | 'error';
    command?: string;
    cwd?: string;
    preview?: string;
    rawInput?: string;
    rawOutput?: string;
    diff?: string;
    fileTarget?: string;
    isError?: boolean;
    treePaths?: string[];
    treeGitStatus?: Record<string, string>;
  }>;
};

const props = defineProps<{
  activeSession: { id: string } | undefined;
  activeContextSummary: string;
  activeSessionNotice?: string;
  activeTimeline: TimelineEntry[];
  themePreset: ThemePreset;
  themeType: 'dark' | 'light';
  contextLabel: string;
  prompt: string;
  selectedModelLabel: string;
  activeContextChips: Array<{ id: string; label: string }>;
  attachments: Array<{ localId: string; name: string; status: 'queued' | 'uploading' | 'uploaded' | 'failed' | 'removing' }>;
  textAttachments: Array<{ id: string; label: string; content: string }>;
  composerDisabled: boolean;
  isAgentRunning: boolean;
  isAgentStopping: boolean;
  sessionContinueOpen: boolean;
  recentProjectSessions: Array<{ id: string; title: string; time: string }>;
  agentSetupMessage: string;
  agentSetupKind: 'agent' | 'gittrix';
  defaultProvider: string;
  compatibleUsableModel: { providerId: string; modelId: string } | null;
}>();

defineEmits<{
  openContextViewer: [];
  removeActiveContext: [];
  backToDiffs: [];
  reloadActiveSessions: [];
  createReplacementSession: [];
  updatePrompt: [value: string];
  sendPrompt: [];
  stopAgent: [];
  runComposerCommand: [value: string, args?: string];
  removeContextChip: [id: string];
  openAttachmentPicker: [];
  showTree: [];
  removeAttachment: [id: string];
  retryAttachment: [id: string];
  addTextAttachment: [content: string];
  removeTextAttachment: [id: string];
  viewTextAttachment: [id: string];
  toggleContinue: [];
  createSession: [];
  selectSession: [id: string];
  openGitSettings: [];
  useLocalGittrix: [];
  openModelSettings: [];
  useCompatibleModel: [value: { providerId: string; modelId: string }];
  openModelPicker: [];
  openFileDiff: [fileTarget: string | undefined];
}>();


</script>


