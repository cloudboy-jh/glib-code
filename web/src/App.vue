<template>
  <div class="h-[100dvh] w-[100dvw] overflow-hidden bg-background text-foreground">
    <div :class="['grid h-full', currentProject ? 'grid-cols-[auto_1fr]' : 'grid-cols-1']">
      <div
        v-if="currentProject"
        class="relative h-full border-r border-border/60 bg-card"
        :style="{ width: `${sidebarWidth}px` }"
      >
        <SessionSidebar
          :sessions="sidebarSessions"
          :active-id="state.activeSessionId"
          :current-project-path="currentProject?.path ?? ''"
          :current-project-name="currentProject?.name ?? ''"
          :collapsed="sidebarUiCollapsed"
          :new-disabled="!currentProject"
          :logo-wordmark-src="logoWordmarkSrc"
          :logo-icon-src="logoIconSrc"
          @select="selectSessionFromSidebar"
          @new="createSession"
          @go-home="goHome"
          @open-settings="openSettings('Models')"
          @toggle-collapse="toggleSidebarCollapse"
          @delete="confirmDeleteSession"
          @export="openExportDialog"
          @rename="openRenameDialog"
        />

        <button
          v-if="!sidebarUiCollapsed"
          type="button"
          class="absolute inset-y-0 -right-2 z-10 hidden w-4 cursor-col-resize bg-transparent transition-colors after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent hover:after:bg-border md:block"
          aria-label="Resize sidebar"
          @mousedown="startSidebarResize"
        />
      </div>

      <section :class="['grid h-full min-h-0 min-w-0', currentProject && state.mode === 'session' ? 'grid-rows-[54px_1fr]' : 'grid-rows-[1fr]']">
          <SessionHeader
            v-if="currentProject && state.mode === 'session'"
          :title="activeSession?.title ?? 'No active session'"
          :project="currentProject.name"
          :branch="currentProject.branch"
          :model="selectedModelLabel"
            :status="activeSession?.status ?? 'disconnected'"
            :git-action-label="promoteActionLabel"
            :preferred-editor="settings.preferredEditor"
            :session-id="activeSession?.id"
            @diff-current="openCurrentSessionDiff"
            @diff-commits="openCommitsListDiff"
          @open-editor-settings="openSettings('Integrations')"
          @open-model="state.modelPickerOpen = true"
          @git-action="runPromote"
        />

        <main class="min-h-0 min-w-0 overflow-hidden">
          <PickerView
            v-if="!currentProject"
            :recents="recents"
            :sessions-by-path="pickerSessionsByPath"
            :commits-by-path="pickerCommitsByPath"
            :logo-src="logoWordmarkSrc"
            @open-project="state.openProjectDialogOpen = true"
            @open-clone="state.cloneDialogOpen = true"
            @open-palette="openCommandPalette"
            @open-settings="openSettings($event)"
            @open-recent="openRecentProject"
            @open-recent-diff="openRecentDiff"
            @continue-recent-session="continueRecentSessionFromPicker"
            @start-new-recent-session="startNewRecentSessionFromPicker"
            @forget-recent="forgetRecentProject"
            @fetch-commits="fetchPickerCommits"
          />

          <SessionView
            v-else-if="state.mode === 'session'"
            :active-session="activeSession"
            :active-context-summary="activeContextSummary"
            :active-session-notice="activeSessionNotice"
            :active-timeline="activeTimeline"
            :theme-preset="settings.themePreset"
            :theme-type="diffThemeType"
            :context-label="contextLabel"
            :prompt="forms.prompt"
             :selected-model-label="composerMetaLabel"
            :active-context-chips="activeContextChips"
            :attachments="composerAttachments"
            :text-attachments="textAttachments"
            :composer-disabled="composerDisabled"
            :is-agent-running="activeSession?.status === 'running'"
            :session-continue-open="state.sessionContinueOpen"
            :recent-project-sessions="recentProjectSessions"
            :agent-setup-message="state.agentSetupMessage"
            :agent-setup-kind="state.agentSetupKind"
            :default-provider="settings.defaultProvider"
            :compatible-usable-model="compatibleUsableModel"
            @open-context-viewer="state.contextViewerOpen = true"
            @remove-active-context="removeActiveContext"
            @back-to-diffs="state.mode = 'diff'"
            @reload-active-sessions="reloadActiveSessions"
            @create-replacement-session="createReplacementSession"
            @update-prompt="setComposerPrompt"
            @send-prompt="sendPrompt"
            @stop-agent="abortTurn"
            @run-composer-command="runComposerCommand"
            @remove-context-chip="removeContextChip"
            @open-attachment-picker="openAttachmentPicker"
            @show-tree="pushTreeArtifact"
            @remove-attachment="removeAttachment"
            @retry-attachment="retryAttachment"
            @add-text-attachment="addTextAttachment"
            @remove-text-attachment="removeTextAttachment"
            @view-text-attachment="viewTextAttachment"
            @toggle-continue="state.sessionContinueOpen = !state.sessionContinueOpen"
            @create-session="createSession"
            @select-session="selectSessionFromSidebar"
            @open-git-settings="openSettings('Git')"
            @use-local-gittrix="useLocalGitTrix"
            @open-model-settings="openSettings('Models')"
            @use-compatible-model="selectModel($event.providerId, $event.modelId)"
            @open-model-picker="state.modelPickerOpen = true"
            @open-file-diff="openFileDiff"
          />

          <DiffView
            v-else
            :current-project="currentProject"
            :diff-style="state.diffStyle"
            :open-request="state.diffOpenRequest"
            :theme-type="diffThemeType"
            :theme-preset="settings.themePreset"
            :preferred-editor="settings.preferredEditor"
            :session-id="activeSession?.id"
            @update:diff-style="state.diffStyle = $event"
            @open-projects="goHome"
            @start-session-from-diff="startSessionFromDiff"
            @open-settings="openSettings('Integrations')"
          />
        </main>
      </section>
    </div>

    <CommandPalette
      v-if="state.paletteOpen"
      :query="forms.palette"
      :commands="filteredPaletteCommands"
      :highlighted-index="state.paletteIndex"
      @close="state.paletteOpen = false"
      @run="runPalette"
      @update:query="updatePaletteQuery"
    />

    <SettingsModal
      v-if="state.settingsOpen"
      :settings="settings"
      :keybindings="keybindings"
      :providers="providerCapabilities.providers"
      :github-connected="authState.githubConnected"
      :github-account="authState.githubAccount"
      :github-avatar-url="authState.githubAvatarUrl"
      :github-signing-in="authState.githubSigningIn"
      :github-user-code="authState.githubUserCode"
      :github-verification-uri="authState.githubVerificationUri"
      :github-error="authState.githubError"
      :default-open-mode="settings.defaultOpenMode"
      :initial-tab="state.settingsTab"
      @close="state.settingsOpen = false"
      @update:theme="updateTheme"
      @update:provider="updateDefaultProvider"
      @update:model="selectModel(settings.defaultProvider, $event)"
      @update:keybinding="updateKeybinding"
      @update:open-mode="settings.defaultOpenMode = $event"
      @update:gittrix-provider="updateGitTrixProvider"
      @update:preferred-editor="updatePreferredEditor"
      @connect-github="connectGitHub"
      @disconnect-github="disconnectGitHub"
      @open-gittrix="openGitTrixFromSettings"
      @open-model-picker="state.modelPickerOpen = true"
      @provider:add-auth="saveProviderAuth"
      @provider:remove-auth="removeProviderAuth"
    />

    <ModelPicker
      v-if="state.modelPickerOpen"
      :providers="providerCapabilities.providers"
      :default-provider="settings.defaultProvider"
      :default-model="settings.defaultModel"
      @close="state.modelPickerOpen = false"
      @select="selectModel"
      @needs-auth="openProviderAuth"
    />

    <div v-if="exportDialog.sessionId" class="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6" @click.self="closeExportDialog">
      <div class="w-full max-w-sm rounded-xl border border-border/80 bg-card/95 p-4 shadow-2xl shadow-black/40">
        <div class="mb-3">
          <div class="text-sm font-semibold">Export session</div>
          <div class="mt-1 text-xs text-muted-foreground">{{ exportDialog.title }}</div>
        </div>
        <div v-if="exportDialog.error" class="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{{ exportDialog.error }}</div>
        <div class="grid gap-2">
          <button v-for="format in exportFormats" :key="format.value" type="button" class="rounded-lg border border-border/80 bg-background/70 px-3 py-2 text-left text-sm hover:bg-accent/70" @click="exportSession(format.value)">
            <div class="font-medium">{{ format.label }}</div>
            <div class="text-xs text-muted-foreground">{{ format.description }}</div>
          </button>
        </div>
        <div class="mt-4 flex justify-end">
          <button type="button" class="rounded-md border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground" @click="closeExportDialog">Cancel</button>
        </div>
      </div>
    </div>

    <div v-if="deleteDialog.open" class="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6" @click.self="closeDeleteSessionDialog">
      <div class="w-full max-w-md rounded-xl border border-border/80 bg-card/95 p-4 shadow-2xl shadow-black/40">
        <div class="mb-3">
          <div class="text-sm font-semibold">Delete session</div>
          <div class="mt-1 text-xs text-muted-foreground">This removes <span class="font-medium text-foreground">{{ deleteDialog.title || 'session' }}</span> and cleans up its workspace.</div>
        </div>
        <div v-if="deleteDialog.error" class="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{{ deleteDialog.error }}</div>
        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-md border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground disabled:opacity-50" :disabled="deleteDialog.busy" @click="closeDeleteSessionDialog">Cancel</button>
          <button type="button" class="rounded-md border border-red-500/60 bg-red-600/80 px-3 py-1.5 text-xs font-semibold text-red-50 hover:bg-red-600 disabled:opacity-50" :disabled="deleteDialog.busy" @click="confirmDeleteSessionNow">
            {{ deleteDialog.busy ? 'Deleting…' : 'Delete session' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="renameDialog.open" class="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6" @click.self="closeRenameDialog">
      <div class="w-full max-w-sm rounded-xl border border-border/80 bg-card/95 p-4 shadow-2xl shadow-black/40">
        <div class="mb-3 text-sm font-semibold">Rename session</div>
        <input
          v-model="renameDialog.value"
          type="text"
          placeholder="Session title"
          class="mb-3 w-full rounded-lg border border-input/80 bg-background/70 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
          :disabled="renameDialog.busy"
          @keydown.enter="confirmRename"
          @keydown.escape="closeRenameDialog"
        />
        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-md border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground" @click="closeRenameDialog">Cancel</button>
          <button type="button" class="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50" :disabled="renameDialog.busy || !renameDialog.value.trim()" @click="confirmRename">
            {{ renameDialog.busy ? 'Renaming…' : 'Rename' }}
          </button>
        </div>
      </div>
    </div>

    <TerminalDrawer
      v-if="state.terminalOpen"
      :input="forms.terminal"
      :output="terminal.output"
      :status="terminal.status"
      :error="terminal.error"
      @close="state.terminalOpen = false"
      @run="runTerminal"
      @update:input="forms.terminal = $event"
    />

    <input ref="attachmentInputRef" type="file" multiple class="hidden" @change="onAttachmentInputChange" />

    <OpenProjectDialog
      v-if="state.openProjectDialogOpen"
      :path="picker.openPath"
      @close="state.openProjectDialogOpen = false"
      @update:path="picker.openPath = $event"
      @open="openExistingProject"
    />

    <ThemeDialog
      v-if="state.themeDialogOpen"
      :model-value="settings.themePreset"
      @close="state.themeDialogOpen = false"
      @update:model-value="updateTheme"
    />

    <CloneRepoDialog
      v-if="state.cloneDialogOpen"
      :url="picker.cloneUrl"
      :destination="picker.cloneDestination"
      :mode="picker.cloneMode"
      :error="picker.cloneError"
      @close="state.cloneDialogOpen = false; picker.cloneError = ''"
      @update:url="picker.cloneUrl = $event"
      @update:destination="picker.cloneDestination = $event"
      @update:mode="picker.cloneMode = $event"
      @clone="cloneRepository"
    />

    <TextAttachmentModal
      :open="textAttachmentModal.open"
      :content="textAttachments.find(t => t.id === textAttachmentModal.id)?.content ?? ''"
      @close="textAttachmentModal.open = false"
      @remove="() => { if (textAttachmentModal.id) removeTextAttachment(textAttachmentModal.id); textAttachmentModal.open = false; }"
    />

    <div
      v-if="state.contextViewerOpen && activeContextBundle"
      class="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6"
      @click.self="state.contextViewerOpen = false"
    >
      <div class="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-2xl shadow-black/40">
        <div class="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div class="text-sm font-medium">Context payload · {{ activeContextSummary }}</div>
          <button class="rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground" @click="state.contextViewerOpen = false">Close</button>
        </div>
        <pre class="max-h-[75vh] overflow-auto p-4 text-xs leading-6 text-foreground/95">{{ activeContextBundle.payload }}</pre>
      </div>
    </div>

    <div v-if="state.promoteDialogOpen" class="fixed inset-0 z-50 flex items-stretch justify-center bg-black/55 p-4 sm:p-6" @click.self="state.promoteDialogOpen = false">
      <div class="flex h-full max-h-[calc(100vh-2rem)] w-full max-w-[min(1500px,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-2xl shadow-black/40 sm:max-h-[calc(100vh-3rem)]">
        <div class="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
          <div>
            <div class="text-sm font-medium">Session diff and commit</div>
            <div class="mt-0.5 text-[11px] text-muted-foreground">{{ promoteSelectionLabel }} · {{ promoteFlowLabel }}</div>
          </div>
          <div class="flex items-center gap-2">
            <div v-if="promote.files.length > 1" ref="promoteFileMenuRef" class="relative">
              <button type="button" class="inline-flex h-8 w-[260px] items-center gap-2 rounded border border-border/70 bg-background/70 px-2 text-[11px] hover:bg-muted/50" @click="promote.fileMenuOpen = !promote.fileMenuOpen">
                <span class="min-w-0 flex-1 truncate text-left">{{ promoteSelectionButtonLabel }}</span>
                <ChevronDown class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
              <div v-if="promote.fileMenuOpen" class="fixed inset-0 z-[60] grid place-items-center bg-black/25 p-4" @click.self="promote.fileMenuOpen = false">
                <div class="flex max-h-[min(72vh,560px)] w-[640px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-2xl shadow-black/40">
                  <div class="flex items-center justify-between border-b border-border/70 px-3 py-2">
                    <div class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Select files</div>
                    <button class="rounded border border-border/70 px-2 py-1 text-[11px] hover:bg-muted/60" @click="selectAllPromoteFiles">All</button>
                  </div>
                  <div class="min-h-0 overflow-auto p-1">
                    <button v-for="file in promote.files" :key="file" type="button" class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-muted/70" :title="file" @click="togglePromoteFile(file)">
                      <span class="inline-grid h-4 w-4 place-items-center rounded border border-border/80 text-[10px] text-primary">{{ promote.selectedFiles.includes(file) ? '✓' : '' }}</span>
                      <span class="min-w-0 flex-1 truncate">{{ file }}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button class="rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground" @click="state.promoteDialogOpen = false">Close</button>
          </div>
        </div>
        <div class="min-h-0 flex-1 overflow-hidden p-3">
            <div v-if="promote.loading" class="grid h-full place-items-center text-sm text-muted-foreground">Loading diff…</div>
            <div v-else-if="promote.error" class="grid h-full place-items-center rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-100">
              <div class="max-w-xl">
                <div>{{ promote.error }}</div>
                <div v-if="promote.dirtyFiles.length" class="mt-3 max-h-40 overflow-auto rounded border border-red-200/20 bg-black/15 p-2 text-left font-mono text-[11px] text-red-50/85">
                  <div v-for="file in promote.dirtyFiles" :key="file" class="truncate">{{ file }}</div>
                </div>
                <button v-if="promote.dirtyFiles.length" class="mt-4 rounded-md border border-red-200/30 bg-red-100/10 px-3 py-1.5 text-xs font-semibold text-red-50 hover:bg-red-100/15 disabled:cursor-not-allowed disabled:opacity-50" :disabled="promote.stashing" @click="stashAndRetryPromote">
                  {{ promote.stashing ? 'Stashing…' : 'Stash and continue' }}
                </button>
              </div>
            </div>
            <div v-else-if="promote.result" class="grid h-full place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-6 text-center text-sm text-emerald-100">
              <div>
                <div class="font-medium">{{ promoteResultTitle }}</div>
                <div class="mt-1 text-xs text-emerald-100/75">{{ promote.result.branch }} @ {{ promote.result.sha.slice(0, 7) }}</div>
                <div v-if="promote.pushResult" class="mt-1 text-xs text-emerald-100/75">Pushed {{ promote.pushResult.upstream }} @ {{ promote.pushResult.sha.slice(0, 7) }}</div>
              </div>
            </div>
            <div v-else-if="!promote.diff.trim()" class="grid h-full place-items-center rounded-lg border border-border/70 text-sm text-muted-foreground">No session changes.</div>
            <SharedDiffView v-else :patch="promote.diff" :diff-style="state.diffStyle" :theme-type="diffThemeType" :theme-preset="settings.themePreset" />
        </div>
        <div class="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-card/98 px-4 py-3">
          <div class="text-xs text-muted-foreground">
            {{ promoteStatusLabel }}
          </div>
          <div class="flex items-center gap-2">
          <button class="rounded-md border border-border/70 px-3 py-1.5 text-xs" @click="state.promoteDialogOpen = false">Cancel</button>
            <button class="rounded-md border border-border/80 bg-primary/90 px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45" :disabled="promoteCommitDisabled" @click="confirmPromote">{{ promoteCommitLabel }}</button>
          </div>
        </div>
      </div>
    </div>

    <SessionDiffOverlay
      :open="state.sessionDiffOverlayOpen"
      :diff="sessionDiff.diff"
      :files="sessionDiff.files"
      :focus-file="sessionDiff.focusFile"
      :loading="sessionDiff.loading"
      :error="sessionDiff.error"
      :diff-style="state.diffStyle"
      :theme-type="diffThemeType"
      :theme-preset="settings.themePreset"
      @close="state.sessionDiffOverlayOpen = false"
      @update:diff-style="state.diffStyle = $event"
    />

    <div v-if="state.conflictDialogOpen" class="fixed inset-0 z-50 grid place-items-center bg-black/55 p-6" @click.self="state.conflictDialogOpen = false">
      <div class="w-full max-w-xl rounded-xl border border-border/80 bg-card/95 p-4 shadow-2xl shadow-black/40">
        <div class="mb-2 text-sm font-semibold">Baseline conflict</div>
        <p class="mb-3 text-xs text-muted-foreground">Durable branch moved and overlaps with selected files.</p>
        <div class="mb-2 text-xs">Durable SHA: <span class="font-mono">{{ conflict.durableSha || 'unknown' }}</span></div>
        <div class="mb-3 text-xs">Baseline SHA: <span class="font-mono">{{ conflict.baselineSha || 'unknown' }}</span></div>
        <div class="max-h-44 overflow-auto rounded border border-border/70 p-2 text-xs">
          <div v-for="file in conflict.conflictingFiles" :key="file" class="py-0.5 font-mono">{{ file }}</div>
          <div v-if="conflict.conflictingFiles.length === 0" class="text-muted-foreground">No file list returned.</div>
        </div>
        <div class="mt-4 flex justify-end">
          <button class="rounded-md border border-border/70 px-3 py-1.5 text-xs" @click="state.conflictDialogOpen = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import type { AgentEvent } from '@glib-code/shared/events/agent';
import CommandPalette from './components/app/CommandPalette.vue';
import TerminalDrawer from './components/app/TerminalDrawer.vue';
import CloneRepoDialog from './components/picker/CloneRepoDialog.vue';
import OpenProjectDialog from './components/picker/OpenProjectDialog.vue';
import ThemeDialog from './components/picker/ThemeDialog.vue';
import SettingsModal from './components/settings/SettingsModal.vue';
import ModelPicker from './components/settings/ModelPicker.vue';
import SessionHeader from './components/session/SessionHeader.vue';
import SessionSidebar from './components/session/SessionSidebar.vue';
import SessionDiffOverlay from './components/session/SessionDiffOverlay.vue';
import DiffView from './views/DiffView.vue';
import PickerView from './views/PickerView.vue';
import SessionView from './views/SessionView.vue';
import TextAttachmentModal from './components/session/TextAttachmentModal.vue';
import { ApiRequestError, useApiClient } from './composables/useApiClient';
import { useGlobalShortcuts } from './composables/useGlobalShortcuts';
import { canonicalizeProjectPath, usePickerSessions } from './composables/usePickerSessions';
import { useSessionOrchestrator } from './composables/useSessionOrchestrator';
import { useSessionStreaming } from './composables/useSessionStreaming';
import { applyTheme } from './lib/theme';
import { THEME_PRESETS, THEME_PRESET_IDS } from '@glib-code/shared/theme/presets';
import type { ThemePreset } from '@glib-code/shared/theme/presets';
import { ChevronDown } from 'lucide-vue-next';
import logoIcon from '../../assets/glibcode-iconlogo.png';
import logoWordmark from '../../assets/glibcode-wordmark.png';

const logoIconSrc = logoIcon;
const logoWordmarkSrc = logoWordmark;
const SharedDiffView = defineAsyncComponent(() => import('./components/shared/DiffView.vue'));
const SIDEBAR_WIDTH_KEY = 'glib-sidebar-width';
const SIDEBAR_EXPANDED_WIDTH = 288;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 380;
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:4273/api';
const { apiGet, apiPost, apiPatch, apiDelete, apiBlob } = useApiClient();
const demoMode = new URLSearchParams(window.location.search).get('demo');
const isThemeCycleDemo = demoMode === 'theme-cycle';

 type Session = {
   id: string;
   title: string;
   time: string;
   updatedAt?: string;
   status: 'connected' | 'connecting' | 'disconnected' | 'stale' | 'running';
   repo: string;
   project: string;
   projectPath: string;
   gittrixSessionId?: string;
   ephemeralPath?: string;
   baselineSha?: string;
   totalCost?: number;
   totalTokens?: { input: number; output: number; reasoning: number; cacheRead: number; cacheWrite: number };
 };

 type SessionMetaApi = {
   id: string;
   projectId: string;
   projectPath: string;
   title: string;
   model: string;
   provider: string;
   gittrixSessionId?: string;
   ephemeralPath?: string;
   baselineSha?: string;
   status: 'idle' | 'running' | 'aborted' | 'error' | 'done';
   totalCost?: number;
   totalTokens?: { input: number; output: number; reasoning: number; cacheRead: number; cacheWrite: number };
   createdAt: string;
   updatedAt: string;
 };

type ContextBundle = {
  id: string;
  sessionId: string;
  projectPath: string;
  sourceType: 'commit' | 'uncommitted' | 'selection';
  sourceRef?: string;
  selectedFile?: string;
  selectedFiles?: string[];
  selectedHunks?: Array<{ id: string; file: string; header: string; startLine: number }>;
  payloadByFile?: Record<string, string>;
  fileCount: number;
  charCount: number;
  payload: string;
};

type TimelineEntry = {
  id: string;
  kind: string;
  text: string;
  time: string;
  at?: string;
  level?: 'info' | 'error';
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

type RecentStatus = 'ok' | 'missing_path' | 'missing_git';
type RecentEntry = { id: string; name: string; path: string; lastOpenedAt: string; status: RecentStatus };
type ProviderCapability = { id: string; hasAuth: boolean; modelIds: string[] };

const DEMO_RECENTS: RecentEntry[] = [
  {
    id: 'demo-recent-1',
    name: 'glib-code',
    path: 'C:/Users/johns/OneDrive/Desktop/glib-code',
    lastOpenedAt: '2026-05-28T19:04:00.000Z',
    status: 'ok'
  },
  {
    id: 'demo-recent-2',
    name: 'dashkit-admin',
    path: 'C:/Users/johns/Dev/dashkit-admin',
    lastOpenedAt: '2026-05-28T18:22:00.000Z',
    status: 'ok'
  },
  {
    id: 'demo-recent-3',
    name: 'worker-sandbox',
    path: 'C:/Users/johns/Dev/worker-sandbox',
    lastOpenedAt: '2026-05-28T17:40:00.000Z',
    status: 'ok'
  }
];

const currentProject = ref<{ id: string; name: string; branch: string; path: string } | null>(null);

const recents = reactive<RecentEntry[]>([]);

const picker = reactive({
  openPath: '',
  cloneUrl: '',
  cloneDestination: 'C:/repos',
  cloneMode: 'diff' as 'diff' | 'session',
  cloneError: ''
});

const sessions = reactive<Session[]>([]);
const pickerSessionCatalog = reactive<Session[]>([]);
const timelineBySessionId = reactive<Record<string, TimelineEntry[]>>({});
const sessionContextById = reactive<Record<string, string>>({});
const contextBundleBySessionId = reactive<Record<string, ContextBundle | undefined>>({});
const activeSessionIdByProject = reactive<Record<string, string>>({});
const draftBySessionId = reactive<Record<string, string>>({});

const settings = reactive({
  themePreset: 'catppuccin-mocha' as ThemePreset,
  defaultProvider: 'codex',
  defaultModel: 'gpt-5.3-codex',
  durableProvider: 'local' as 'local' | 'github',
  ephemeralProvider: 'local' as 'local' | 'cloudflare-artifacts',
  promoteStrategy: 'commit' as 'commit' | 'branch' | 'pr' | 'patch',
  defaultOpenMode: 'diff' as 'diff' | 'session',
  preferredEditor: null as string | null
});

const authState = reactive({
  githubConnected: false,
  githubAccount: '',
  githubAvatarUrl: '',
  githubSigningIn: false,
  githubUserCode: '',
  githubVerificationUri: '',
  githubError: ''
});

const gitState = reactive({
  canPush: false,
  upstream: '',
  remote: '',
  branch: ''
});

const providerCapabilities = reactive<{ ok: boolean; error?: string; providers: ProviderCapability[] }>({
  ok: false,
  error: undefined,
  providers: []
});

const keybindings = reactive([
  { command: 'palette.toggle', key: 'Ctrl+K' },
  { command: 'terminal.toggle', key: 'Ctrl+J' },
  { command: 'mode.diff', key: 'D' },
  { command: 'mode.session', key: 'S' }
]);

const state = reactive({
  mode: 'diff' as 'session' | 'diff',
  activeSessionId: '',
  sidebarCollapsed: false,
  sidebarWidth: SIDEBAR_EXPANDED_WIDTH,
  paletteOpen: false,
  paletteIndex: 0,
  settingsOpen: false,
  modelPickerOpen: false,
  settingsTab: 'Models' as 'Models' | 'Git' | 'Integrations' | 'Appearance' | 'Keybindings',
  terminalOpen: false,
  openProjectDialogOpen: false,
  themeDialogOpen: false,
  cloneDialogOpen: false,
  diffStyle: 'split' as 'split' | 'unified',
  contextViewerOpen: false,
  diffOpenRequest: null as null | { token: number; mode: 'session' | 'history' | 'commit' | 'uncommitted'; files?: string[]; commitRef?: string },
  promoteDialogOpen: false,
  conflictDialogOpen: false,
  sessionContinueOpen: false,
  sessionDiffOverlayOpen: false,
  agentSetupMessage: '',
  agentSetupKind: 'agent' as 'agent' | 'gittrix'
});

const exportDialog = reactive({
  sessionId: '',
  title: '',
  error: ''
});

const deleteDialog = reactive({
  open: false,
  sessionId: '',
  title: '',
  error: '',
  busy: false
});

const renameDialog = reactive({
  open: false,
  sessionId: '',
  value: '',
  busy: false
});

const exportFormats = [
  { value: 'markdown', label: 'Markdown', description: 'Readable transcript for notes or sharing.' },
  { value: 'json', label: 'JSON', description: 'Full glib-code session document.' },
  { value: 'jsonl', label: 'JSONL', description: 'Raw glib-code event stream.' },
  { value: 'pi-jsonl', label: 'pi JSONL', description: 'pi-compatible conversation JSONL.' }
] as const;

const promote = reactive({
  diff: '',
  loading: false,
  submitting: false,
  stashing: false,
  pushing: false,
  error: '',
  dirtyFiles: [] as string[],
  result: null as null | { sha: string; branch: string; prUrl?: string },
  pushResult: null as null | { remote: string; branch: string; upstream: string; sha: string },
  files: [] as string[],
  selectedFiles: [] as string[],
  fileMenuOpen: false
});

const conflict = reactive({
  conflictingFiles: [] as string[],
  durableSha: '',
  baselineSha: ''
});

const sessionDiff = reactive({
  diff: '',
  files: [] as string[],
  focusFile: '',
  loading: false,
  error: ''
});

const forms = reactive({
  prompt: '',
  palette: '',
  terminal: ''
});

type ComposerAttachment = {
  localId: string;
  id?: string;
  name: string;
  size: number;
  mime: string;
  status: 'queued' | 'uploading' | 'uploaded' | 'failed' | 'removing';
  error?: string;
  file?: File;
};

const composerAttachments = reactive<ComposerAttachment[]>([]);
const attachmentInputRef = ref<HTMLInputElement | null>(null);

// Text attachments — pasted long text blobs
interface TextAttachment { id: string; label: string; content: string }
const textAttachments = reactive<TextAttachment[]>([]);
const textAttachmentModal = reactive<{ open: boolean; id: string | null }>({ open: false, id: null });

function addTextAttachment(content: string) {
  const id = crypto.randomUUID();
  const preview = content.replace(/\s+/g, ' ').trim().slice(0, 50);
  const label = preview + (content.length > 50 ? '…' : '');
  textAttachments.push({ id, label, content });
}

function removeTextAttachment(id: string) {
  const idx = textAttachments.findIndex((t) => t.id === id);
  if (idx !== -1) textAttachments.splice(idx, 1);
}

function viewTextAttachment(id: string) {
  textAttachmentModal.id = id;
  textAttachmentModal.open = true;
}

const terminal = reactive({
  status: 'closed' as 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error' | 'unavailable',
  output: 'No commands run yet.',
  error: '',
  sessionId: '',
  reconnectAttempts: 0
});

let terminalSocket: WebSocket | null = null;
let terminalReconnectTimer: ReturnType<typeof setTimeout> | null = null;

let themeCycleTimer: ReturnType<typeof setInterval> | null = null;
let themeCycleOriginalTheme: ThemePreset | null = null;

const paletteCommands = [
  { id: 'mode.diff', label: 'Switch to Diff mode' },
  { id: 'mode.session', label: 'Switch to Session mode' },
  { id: 'picker.open', label: 'Open project picker' },
  { id: 'settings.open', label: 'Open settings' },
  { id: 'terminal.toggle', label: 'Toggle terminal drawer' },
  { id: 'session.new', label: 'Create new session' }
];

const activeSession = computed(() => sessions.find((s) => s.id === state.activeSessionId));
const sidebarSessions = computed(() => {
  return sessions
    .map((session) => ({
      ...session,
      title: normalizeSessionTitle(session),
      status: staleSessionIds.has(session.id) ? 'stale' as const : session.status
    }))
    .sort((a, b) => toEpochMs(b.updatedAt) - toEpochMs(a.updatedAt));
});
// Picker commit cache: keyed by canonicalized path
const pickerCommitsByPath = reactive<Record<string, Array<{ ref: string; shortRef: string; title: string }>>>({});

const { pickerSessionsByPath, hydratePickerSessions } = usePickerSessions({
  apiGet,
  mapApiSession: (meta) => {
    const mapped = mapApiSession(meta as SessionMetaApi);
    return {
      ...mapped,
      title: normalizeSessionTitle(mapped),
      status: staleSessionIds.has(mapped.id) ? 'stale' : mapped.status
    };
  },
  pickerSessionCatalog
});
const recentProjectSessions = computed(() => {
  if (!currentProject.value) return sidebarSessions.value.slice(0, 3);
  const activeProjectPath = canonicalizeProjectPath(currentProject.value.path);
  return sidebarSessions.value.filter((session) => canonicalizeProjectPath(session.projectPath) === activeProjectPath).slice(0, 5);
});
const sidebarUiCollapsed = computed(() => state.sidebarCollapsed);
const activeContextBundle = computed(() => (state.activeSessionId ? contextBundleBySessionId[state.activeSessionId] : undefined));
const activeContextSummary = computed(() => {
  const ctx = activeContextBundle.value;
  if (!ctx) return '';
  const source = ctx.sourceType === 'commit' && ctx.sourceRef ? `commit ${ctx.sourceRef.slice(0, 7)}` : ctx.sourceType === 'uncommitted' ? 'working tree' : 'selection';
  const fileMeta = `${ctx.fileCount} file${ctx.fileCount === 1 ? '' : 's'}`;
  const sizeMeta = `${Math.max(1, Math.round(ctx.charCount / 1000))}k chars`;
  return `${source} · ${fileMeta} · ${sizeMeta}`;
});

const activeContextChips = computed(() => {
  const ctx = activeContextBundle.value;
  if (!ctx) return [];
  const chips: Array<{ id: string; label: string }> = [];
  const source = ctx.sourceType === 'commit' && ctx.sourceRef ? `commit ${ctx.sourceRef.slice(0, 7)}` : ctx.sourceType === 'uncommitted' ? 'working tree' : 'selection';
  chips.push({ id: 'source', label: source });
  for (const file of ctx.selectedFiles?.length ? ctx.selectedFiles : ctx.selectedFile ? [ctx.selectedFile] : []) {
    chips.push({ id: `file:${file}`, label: file });
  }
  for (const hunk of ctx.selectedHunks ?? []) {
    chips.push({ id: `hunk:${hunk.id}`, label: `${hunk.file} · ${hunk.header}` });
  }
  if (chips.length === 1) chips.push({ id: 'files', label: `${ctx.fileCount} file${ctx.fileCount === 1 ? '' : 's'}` });
  return chips.slice(0, 12);
});

const activeTimeline = computed(() => {
  if (!state.activeSessionId) return [];
  return timelineBySessionId[state.activeSessionId] ?? [];
});

const activeProvider = computed(() => providerCapabilities.providers.find((provider) => provider.id === settings.defaultProvider));
const activeSessionBaselineSha = computed(() => activeSession.value?.baselineSha ?? '');
const activeWorkspaceState = computed(() => {
  const session = activeSession.value;
  if (!session?.gittrixSessionId) return state.mode === 'diff' ? 'reviewing durable repo' : 'no GitTrix workspace yet';
  return session.ephemeralPath ? `session workspace ${session.gittrixSessionId.slice(0, 8)}` : `GitTrix session ${session.gittrixSessionId.slice(0, 8)}`;
});
const activeProviderConnected = computed(() => activeProvider.value?.hasAuth === true);
const compatibleUsableModel = computed(() => {
  if (activeProviderConnected.value) return null;
  for (const provider of providerCapabilities.providers) {
    if (!provider.hasAuth) continue;
    const modelId = provider.modelIds.find((id) => id === settings.defaultModel || id === `${settings.defaultProvider}/${settings.defaultModel}`);
    if (modelId) return { providerId: provider.id, modelId };
  }
  return null;
});

const contextLabel = computed(() => {
  if (state.mode !== 'session') return '';
  if (!currentProject.value) return '';
  const sessionContext = state.activeSessionId ? sessionContextById[state.activeSessionId] : '';
  if (sessionContext) return sessionContext;
  return currentProject.value.name;
});

const diffThemeType = computed<'dark' | 'light'>(() => {
  const background = THEME_PRESETS[settings.themePreset].background;
  const lightness = Number(background.split(' ')[2]?.replace('%', '') ?? '0');
  return lightness <= 50 ? 'dark' : 'light';
});

const filteredPaletteCommands = computed(() => {
  const q = forms.palette.trim().toLowerCase();
  const options = paletteCommands.filter((c) => currentProject.value || c.id === 'picker.open');
  if (!q) return options;
  return options.filter((c) => c.label.toLowerCase().includes(q) || c.id.includes(q));
});

const sidebarWidth = computed(() => (sidebarUiCollapsed.value ? SIDEBAR_COLLAPSED_WIDTH : state.sidebarWidth));
const streamsBySessionId = new Map<string, EventSource>();
const seenEventKeysBySessionId = new Map<string, Set<string>>();
const staleSessionIds = reactive(new Set<string>());
const sessionNoticeById = reactive<Record<string, string | undefined>>({});
const streamErrorCountBySessionId = new Map<string, number>();
const sendingSessionIds = reactive(new Set<string>());
const hydratedVersionBySessionId = new Map<string, string>();
const hydratingSessionDocById = new Map<string, Promise<void>>();

let stopSidebarResize: (() => void) | null = null;
let creatingSession: Promise<Session | null> | null = null;
let hydratingSessionsPromise: Promise<void> | null = null;

const { connectSessionStream, syncActiveSessionStream, disconnectSessionStream, markSessionStale, confirmAndMarkSessionStale } = useSessionStreaming({
  apiBase: API_BASE,
  sessions,
  state,
  streamsBySessionId,
  streamErrorCountBySessionId,
  staleSessionIds,
  sessionNoticeById,
  setSessionStatus,
  reduceAgentEventToTimeline,
  hydrateSessionDoc
});

const activeSessionNotice = computed(() => (state.activeSessionId ? sessionNoticeById[state.activeSessionId] : undefined));
const composerDisabled = computed(() => Boolean(
  state.activeSessionId
  && (staleSessionIds.has(state.activeSessionId)
    || sendingSessionIds.has(state.activeSessionId)
    || composerAttachments.some((item) => item.status === 'uploading'))
));
const promoteHasExplicitFiles = computed(() => promote.files.length > 0);
const promoteSelectionLabel = computed(() => {
  if (promote.loading) return 'Loading session diff…';
  if (!promote.diff.trim()) return 'No session changes';
  if (!promoteHasExplicitFiles.value) return 'All changed files';
  return `${promote.selectedFiles.length} of ${promote.files.length} file${promote.files.length === 1 ? '' : 's'} selected`;
});
const promoteSelectionButtonLabel = computed(() => {
  if (!promoteHasExplicitFiles.value) return 'All changed files';
  if (promote.selectedFiles.length === promote.files.length) return `All files (${promote.files.length})`;
  return `${promote.selectedFiles.length} selected`;
});
const promoteCommitLabel = computed(() => {
  if (promote.pushing) return 'Pushing…';
  if (promote.submitting) return 'Committing…';
  if (promote.result) return promote.pushResult ? 'Committed and pushed' : 'Committed';
  if (!promoteHasExplicitFiles.value || promote.selectedFiles.length === promote.files.length) return 'Commit all';
  return 'Commit selected';
});
const promoteShouldPush = computed(() => settings.durableProvider === 'github' || (settings.durableProvider === 'local' && gitState.canPush));
const promoteActionLabel = computed(() => promoteShouldPush.value ? 'Commit + Push' : 'Commit');
const promoteFlowLabel = computed(() => {
  if (settings.durableProvider === 'github') return 'GitHub durable repo -> pushed branch';
  if (gitState.canPush) return `Local repo -> ${gitState.upstream}`;
  return 'Local repo -> local commit';
});
const promoteResultTitle = computed(() => promote.pushResult || settings.durableProvider === 'github' ? 'Committed and pushed' : 'Committed locally');
const promoteCommitDisabled = computed(() => {
  if (promote.loading || promote.submitting || promote.pushing || promote.result) return true;
  if (promote.error || !promote.diff.trim()) return true;
  return promote.files.length > 0 && promote.selectedFiles.length === 0;
});
const promoteStatusLabel = computed(() => {
  if (promote.loading) return 'Loading session diff…';
  if (promote.submitting) return 'Committing selected changes…';
  if (promote.pushing) return `Pushing to ${gitState.upstream || 'upstream'}…`;
  if (promote.error) return promote.error;
  if (promote.result) return promote.pushResult
    ? `${promoteResultTitle.value}: ${promote.pushResult.upstream} @ ${promote.pushResult.sha.slice(0, 7)}`
    : `${promoteResultTitle.value}: ${promote.result.branch} @ ${promote.result.sha.slice(0, 7)}`;
  return promoteSelectionLabel.value;
});


function eventKey(event: AgentEvent) {
  if (event.type === 'session_start') return `session_start:${event.sessionId}:${event.createdAt}`;
  if (event.type === 'user_turn') return `user_turn:${event.turnId}:${event.at}`;
  if (event.type === 'turn_start') return `turn_start:${event.turnId}:${event.at}`;
  if (event.type === 'turn_end') return `turn_end:${event.turnId}:${event.reason}:${event.at}`;
  if (event.type === 'aborted') return `aborted:${event.turnId}:${event.at}`;
  if (event.type === 'step_start') return `step_start:${event.turnId}:${event.stepId}:${event.at}`;
  if (event.type === 'step_end') return `step_end:${event.turnId}:${event.stepId}:${event.at}`;
  if (event.type === 'text_part') return `text_part:${event.turnId}:${event.stepId}:${event.partId}`;
  if (event.type === 'tool_call') return `tool_call:${event.turnId}:${event.stepId}:${event.callId}:${event.output ? 'end' : 'start'}`;
  return `error:${event.turnId}:${event.name}:${event.at}`;
}

function timeLabel(value?: string) {
  if (!value) return 'now';
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'now';
  }
}

function appendTimelineEvent(sessionId: string, entry: TimelineEntry) {
  const list = timelineBySessionId[sessionId] ?? (timelineBySessionId[sessionId] = []);
  list.push(entry);
}

function findTimelineEntry(sessionId: string, id: string) {
  return (timelineBySessionId[sessionId] ?? []).find((entry) => entry.id === id);
}

function ensureAssistantTurn(sessionId: string, turnId: string, at?: string) {
  const id = `${turnId}-assistant`;
  const existing = findTimelineEntry(sessionId, id);
  if (existing) return existing;
  const entry: TimelineEntry = { id, kind: 'Assistant', text: 'Working…', time: timeLabel(at), at, level: 'info' };
  appendTimelineEvent(sessionId, entry);
  return entry;
}

function touchedFilesFromEntry(entry: TimelineEntry) {
  const files = new Set<string>();
  for (const tool of entry.toolCalls ?? []) {
    if (tool.diff?.trim()) {
      for (const path of filesFromPatch(tool.diff)) files.add(path);
    }
  }
  return [...files];
}

function latestTurnTouchedFiles() {
  const timeline = activeTimeline.value;
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const entry = timeline[index];
    if (entry.kind !== 'Assistant') continue;
    const files = touchedFilesFromEntry(entry);
    if (files.length) return files;
  }
  return [] as string[];
}

function filesFromPatch(patch: string) {
  const files = new Set<string>();
  const matches = patch.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm);
  for (const m of matches) files.add((m[2] || m[1] || '').trim());
  const unified = patch.matchAll(/^\+\+\+\s+(?:b\/)?([^\t\n\r]+)$/gm);
  for (const m of unified) {
    const file = (m[1] || '').trim();
    if (file && file !== '/dev/null') files.add(file);
  }
  return [...files].filter(Boolean);
}

function selectAllPromoteFiles() {
  promote.selectedFiles = [...promote.files];
}

function togglePromoteFile(file: string) {
  promote.selectedFiles = promote.selectedFiles.includes(file)
    ? promote.selectedFiles.filter((entry) => entry !== file)
    : [...promote.selectedFiles, file];
}

function setSessionStatus(sessionId: string, status: Session['status']) {
  const session = sessions.find((entry) => entry.id === sessionId);
  if (session) session.status = status;
}

function setComposerPrompt(value: string) {
  forms.prompt = value;
  if (state.activeSessionId) draftBySessionId[state.activeSessionId] = value;
}

function switchActiveSession(sessionId: string) {
  if (state.activeSessionId) draftBySessionId[state.activeSessionId] = forms.prompt;
  state.activeSessionId = sessionId;
  if (sessionId && currentProject.value) activeSessionIdByProject[currentProject.value.id] = sessionId;
  forms.prompt = draftBySessionId[sessionId] ?? '';
  syncActiveSessionStream();
  if (sessionId) void hydrateSessionDoc(sessionId).catch(() => undefined);
}

function clearActiveSession() {
  if (state.activeSessionId) draftBySessionId[state.activeSessionId] = forms.prompt;
  state.activeSessionId = '';
  forms.prompt = '';
  syncActiveSessionStream();
}

function redactTimelineText(value: string) {
  return value
    .replace(/([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|AUTH)[A-Z0-9_]*\s*[=:]\s*)(["']?)[^"'\s]+\2/gi, '$1$2[redacted]$2')
    .replace(/\b(?:sk|pk|rk|ghp|gho|github_pat|glpat|xox[baprs])-[A-Za-z0-9_\-]{12,}\b/g, '[redacted]')
    .replace(/\b[A-Za-z0-9_\-]{32,}\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,}\b/g, '[redacted]');
}

function parseToolResult(output: string) {
  const raw = output.trim();
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as { content?: Array<{ type?: string; text?: string }>; stdout?: string; stderr?: string; text?: string; error?: string; details?: unknown };
    if (Array.isArray(parsed.content)) {
      const text = parsed.content.map((part) => typeof part.text === 'string' ? part.text : '').filter(Boolean).join('\n');
      return redactTimelineText(text);
    }
    const fallback = parsed.stdout || parsed.stderr || parsed.text || parsed.error;
    return redactTimelineText(fallback ? String(fallback) : JSON.stringify(parsed, null, 2));
  } catch {
    return redactTimelineText(raw);
  }
}

function isUnifiedDiff(value: string) {
  return /^diff --git /m.test(value) || /^@@ -\d+/m.test(value) || /^--- .+\n\+\+\+ /m.test(value);
}

function summarizeLines(value: string, limit = 6) {
  const lines = value.split('\n').map((line) => line.trimEnd()).filter(Boolean);
  const shown = lines.slice(0, limit).join('\n');
  return lines.length > limit ? `${shown}\n… ${lines.length - limit} more line${lines.length - limit === 1 ? '' : 's'}` : shown;
}

function stripMarkdownArtifacts(value: string) {
  return value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .trim();
}

// Convert the server's line-number diff format to unified patch format for pierre.
// Input lines look like:
//   "  1 context line"   → context
//   "+ 3 added line"     → addition
//   "- 3 removed line"   → deletion
function detailsDiffToUnifiedPatch(diff: string, filePath: string): string {
  const lines = diff.split('\n');
  const hunks: string[] = [];
  let oldLine = 1;
  let newLine = 1;
  let hunkOldStart = -1;
  let hunkNewStart = -1;
  const hunkLines: string[] = [];

  function flushHunk() {
    if (!hunkLines.length) return;
    const addCount = hunkLines.filter((l) => l.startsWith('+')).length;
    const delCount = hunkLines.filter((l) => l.startsWith('-')).length;
    const ctxCount = hunkLines.filter((l) => l.startsWith(' ')).length;
    hunks.push(`@@ -${hunkOldStart},${ctxCount + delCount} +${hunkNewStart},${ctxCount + addCount} @@`);
    hunks.push(...hunkLines);
    hunkLines.length = 0;
    hunkOldStart = -1;
    hunkNewStart = -1;
  }

  for (const raw of lines) {
    // skip trailing ellipsis lines
    if (/^\s*\.\.\./.test(raw)) continue;

    const addMatch = raw.match(/^\+\s*(\d+) (.*)$/);
    const delMatch = raw.match(/^-\s*(\d+) (.*)$/);
    const ctxMatch = raw.match(/^\s{2}(\d+) (.*)$/);

    if (addMatch) {
      const lineNum = Number(addMatch[1]);
      if (hunkOldStart < 0) { hunkOldStart = oldLine; hunkNewStart = lineNum; }
      hunkLines.push(`+${addMatch[2]}`);
      newLine = lineNum + 1;
    } else if (delMatch) {
      const lineNum = Number(delMatch[1]);
      if (hunkOldStart < 0) { hunkOldStart = lineNum; hunkNewStart = newLine; }
      hunkLines.push(`-${delMatch[2]}`);
      oldLine = lineNum + 1;
    } else if (ctxMatch) {
      const lineNum = Number(ctxMatch[1]);
      // gap in context = flush previous hunk and start fresh
      if (hunkLines.length && lineNum > oldLine + 1 && lineNum > newLine + 1) {
        flushHunk();
      }
      if (hunkOldStart < 0) { hunkOldStart = lineNum; hunkNewStart = lineNum; }
      hunkLines.push(` ${ctxMatch[2]}`);
      oldLine = lineNum + 1;
      newLine = lineNum + 1;
    }
  }
  flushHunk();

  if (!hunks.length) return '';
  const fname = filePath.replace(/\\/g, '/');
  return `diff --git a/${fname} b/${fname}\n--- a/${fname}\n+++ b/${fname}\n${hunks.join('\n')}`;
}

function parseDetailsDiff(rawOutput: string, filePath: string): string {
  try {
    const parsed = JSON.parse(rawOutput) as { details?: { diff?: unknown } };
    const diff = parsed?.details?.diff;
    if (typeof diff !== 'string' || !diff.trim()) return '';
    return detailsDiffToUnifiedPatch(diff, filePath);
  } catch {
    return '';
  }
}

function classifyToolCall(event: Extract<AgentEvent, { type: 'tool_call' }>) {
  const input = event.input as { command?: unknown; cwd?: unknown; filePath?: unknown; path?: unknown };
  const command = typeof input.command === 'string' ? input.command : undefined;
  const cwd = typeof input.cwd === 'string' ? input.cwd : undefined;
  const rawInput = Object.keys(event.input ?? {}).length ? redactTimelineText(JSON.stringify(event.input, null, 2)) : '';
  // Keep rawJsonOutput unredacted so JSON.parse works; redact only for display
  const rawJsonOutput = event.output?.trim() ?? '';
  const rawOutput = rawJsonOutput ? redactTimelineText(rawJsonOutput) : '';
  const output = parseToolResult(rawJsonOutput);
  const failed = Boolean((event.metadata as { isError?: unknown })?.isError);
  const typedResult = event.resultType;
  const artifact = event.artifact as { patch?: unknown; text?: unknown; json?: unknown; tree?: unknown } | undefined;
  const typedPatch = typeof artifact?.patch === 'string' ? artifact.patch : '';
  const typedText = typeof artifact?.text === 'string' ? artifact.text : '';
  const typedJson = artifact && 'json' in artifact ? artifact.json : undefined;
  const typedTree = artifact?.tree as { paths?: unknown; gitStatus?: unknown } | undefined;
  const fileTarget = typeof input.filePath === 'string' ? input.filePath : typeof input.path === 'string' ? input.path : '';
  const titleTarget = command ? command.split(/\s+/).slice(0, 4).join(' ') : fileTarget;
  const title = `${event.tool}${titleTarget ? ` · ${titleTarget}` : ''}`;
  const summary = event.summary ? stripMarkdownArtifacts(event.summary) : '';

  if (!rawJsonOutput) return { title, fileTarget, status: 'running' as const, renderKind: 'terminal' as const, command, cwd, rawInput, rawOutput, preview: '' };
  if (typedResult === 'tree' && typedTree && Array.isArray(typedTree.paths)) {
    const treePaths = typedTree.paths as string[];
    const treeGitStatus = (typedTree.gitStatus && typeof typedTree.gitStatus === 'object') ? typedTree.gitStatus as Record<string, string> : undefined;
    return { title, fileTarget, status: failed ? 'failed' as const : 'done' as const, renderKind: failed ? 'error' as const : 'tree' as const, command, cwd, rawInput, rawOutput, preview: summary || `${treePaths.length} paths`, treePaths, treeGitStatus };
  }
  if (typedResult === 'diff' && typedPatch) return { title, fileTarget, status: failed ? 'failed' as const : 'done' as const, renderKind: failed ? 'error' as const : 'diff' as const, command, cwd, rawInput, rawOutput, diff: typedPatch, preview: summary || summarizeLines(typedPatch, 4) };
  if (typedResult === 'json' && typedJson !== undefined) {
    const asText = redactTimelineText(JSON.stringify(typedJson, null, 2));
    return { title, fileTarget, status: failed ? 'failed' as const : 'done' as const, renderKind: failed ? 'error' as const : 'json' as const, command, cwd, rawInput, rawOutput, preview: summary || summarizeLines(asText) };
  }
  if (typedResult === 'code' && typedText) return { title, fileTarget, status: failed ? 'failed' as const : 'done' as const, renderKind: failed ? 'error' as const : 'code' as const, command, cwd, rawInput, rawOutput, preview: summary || summarizeLines(stripMarkdownArtifacts(typedText)) };
  if ((typedResult === 'terminal' || typedResult === 'text') && typedText) return { title, fileTarget, status: failed ? 'failed' as const : 'done' as const, renderKind: failed ? 'error' as const : 'terminal' as const, command, cwd, rawInput, rawOutput, preview: summary || summarizeLines(stripMarkdownArtifacts(typedText)) };
  if (typedResult === 'error') return { title, fileTarget, status: 'failed' as const, renderKind: 'error' as const, command, cwd, rawInput, rawOutput, preview: summary || summarizeLines(stripMarkdownArtifacts(typedText || output)) };

  // details.diff: edit/write tools emit {content:[...], details:{diff:"..."}}
  if (fileTarget) {
    const detailsPatch = parseDetailsDiff(rawJsonOutput, fileTarget);
    if (detailsPatch) return { title, fileTarget, status: failed ? 'failed' as const : 'done' as const, renderKind: failed ? 'error' as const : 'diff' as const, command, cwd, rawInput, rawOutput, diff: detailsPatch, preview: summary };
  }

  // bash/shell tools that return unified diff inside content[].text
  if (isUnifiedDiff(output)) return { title, fileTarget, status: failed ? 'failed' as const : 'done' as const, renderKind: failed ? 'error' as const : 'diff' as const, command, cwd, rawInput, rawOutput, diff: output, preview: summarizeLines(output, 4) };
  if (failed) return { title, fileTarget, status: 'failed' as const, renderKind: 'error' as const, command, cwd, rawInput, rawOutput, preview: summarizeLines(stripMarkdownArtifacts(output)) };
  const trimmed = output.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) return { title, fileTarget, status: 'done' as const, renderKind: 'json' as const, command, cwd, rawInput, rawOutput, preview: summarizeLines(trimmed) };
  const codeLike = /```|\b(import|export|function|const|let|class|type|interface)\b|^\s*[{};]/m.test(trimmed) && trimmed.split('\n').length > 3;
  return { title, fileTarget, status: 'done' as const, renderKind: codeLike ? 'code' as const : 'terminal' as const, command, cwd, rawInput, rawOutput, preview: summarizeLines(stripMarkdownArtifacts(trimmed)) };
}

function reduceAgentEventToTimeline(sessionId: string, event: AgentEvent) {
  const seen = seenEventKeysBySessionId.get(sessionId) ?? new Set<string>();
  const key = eventKey(event);
  if (seen.has(key)) return;
  seen.add(key);
  seenEventKeysBySessionId.set(sessionId, seen);

  if (event.type === 'user_turn') {
    const id = `${event.turnId}-user`;
    if (!findTimelineEntry(sessionId, id)) {
      appendTimelineEvent(sessionId, { id, kind: 'User', text: event.prompt, time: timeLabel(event.at), at: event.at, level: 'info' });
    }
    return;
  }
  if (event.type === 'turn_start') {
    ensureAssistantTurn(sessionId, event.turnId, event.at);
    setSessionStatus(sessionId, 'running');
    return;
  }
  if (event.type === 'text_part') {
    const entry = ensureAssistantTurn(sessionId, event.turnId, event.at);
    if (!entry.at) entry.at = event.at;
    entry.text = entry.text === 'Working…' ? event.text : `${entry.text}${event.text}`;
    return;
  }
  if (event.type === 'tool_call') {
    const entry = ensureAssistantTurn(sessionId, event.turnId, event.at);
    if (!entry.at) entry.at = event.at;
    if (entry.text === 'Working…') entry.text = '';
    const calls = entry.toolCalls ?? (entry.toolCalls = []);
    const existing = calls.find((call) => call.id === event.callId);
    const view = classifyToolCall(event);
    if (existing) {
      Object.assign(existing, view, { isError: view.status === 'failed' });
    } else {
      calls.push({
        id: event.callId,
        ...view,
        isError: view.status === 'failed'
      });
    }
    return;
  }
  if (event.type === 'error') {
    const entry = ensureAssistantTurn(sessionId, event.turnId, event.at);
    if (!entry.at) entry.at = event.at;
    entry.kind = 'Error';
    entry.text = event.message ?? event.name;
    entry.level = 'error';
    return;
  }
  if (event.type === 'turn_end') {
    const entry = findTimelineEntry(sessionId, `${event.turnId}-assistant`);
    if (entry?.text === 'Working…') {
      entry.text = event.reason === 'stop' ? 'Tool run completed, but the agent did not return a final answer.' : `Turn ended (${event.reason})`;
      entry.level = event.reason === 'error' ? 'error' : 'info';
    }
    if (event.reason === 'aborted' && !findTimelineEntry(sessionId, `${event.turnId}-aborted`)) {
      appendTimelineEvent(sessionId, { id: `${event.turnId}-aborted`, kind: 'System', text: 'Turn aborted.', time: timeLabel(event.at), at: event.at, level: 'info' });
    }
    setSessionStatus(sessionId, event.reason === 'error' || event.reason === 'aborted' ? 'disconnected' : 'connected');
    if (event.cost != null && event.tokens) {
      const session = sessions.find((s) => s.id === sessionId);
      if (session) {
        session.totalCost = (session.totalCost ?? 0) + event.cost;
        const prev = session.totalTokens ?? { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 };
        session.totalTokens = {
          input: prev.input + event.tokens.input,
          output: prev.output + event.tokens.output,
          reasoning: prev.reasoning + event.tokens.reasoning,
          cacheRead: prev.cacheRead + event.tokens.cacheRead,
          cacheWrite: prev.cacheWrite + event.tokens.cacheWrite,
        };
      }
    }
    void refreshSessionMeta(sessionId);
  }
}

function mapApiSession(meta: SessionMetaApi): Session {
  const normalizedPath = canonicalizeProjectPath(meta.projectPath);
  const repoName = normalizedPath.split('/').filter(Boolean).pop() ?? 'project';
  return {
    id: meta.id,
    title: meta.title,
    time: timeLabel(meta.updatedAt),
    updatedAt: meta.updatedAt,
    status: meta.status === 'running' ? 'running' : meta.status === 'error' || meta.status === 'aborted' ? 'disconnected' : 'connected',
    repo: repoName,
    project: repoName,
    projectPath: normalizedPath,
    gittrixSessionId: meta.gittrixSessionId,
    ephemeralPath: meta.ephemeralPath,
    baselineSha: meta.baselineSha,
    totalCost: meta.totalCost,
    totalTokens: meta.totalTokens
  };
}

async function refreshSessionMeta(sessionId: string) {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;
  const query = session.projectPath ? `?projectPath=${encodeURIComponent(session.projectPath)}` : '';
  try {
    const doc = await apiGet<{ meta: SessionMetaApi; events: AgentEvent[] }>(`/sessions/${encodeURIComponent(sessionId)}${query}`);
    session.title = doc.meta.title;
    session.totalCost = doc.meta.totalCost;
    session.totalTokens = doc.meta.totalTokens;
    session.updatedAt = doc.meta.updatedAt;
  } catch {
    // best effort
  }
}

async function hydrateSessionDoc(sessionId: string) {
  const existingInflight = hydratingSessionDocById.get(sessionId);
  if (existingInflight) return existingInflight;

  const run = (async () => {
    const session = sessions.find((entry) => entry.id === sessionId);
    if (!session) return;
    const knownVersion = hydratedVersionBySessionId.get(sessionId);
    if (knownVersion && knownVersion === session.updatedAt) return;
    const query = session.projectPath ? `?projectPath=${encodeURIComponent(session.projectPath)}` : '';
    const doc = await apiGet<{ meta: SessionMetaApi; events: AgentEvent[] }>(`/sessions/${encodeURIComponent(sessionId)}${query}`);
    timelineBySessionId[sessionId] = [];
    seenEventKeysBySessionId.set(sessionId, new Set<string>());
    for (const evt of doc.events) reduceAgentEventToTimeline(sessionId, evt);
    hydratedVersionBySessionId.set(sessionId, doc.meta.updatedAt);
    const sessionEntry = sessions.find((s) => s.id === sessionId);
    if (sessionEntry) {
      sessionEntry.title = doc.meta.title;
      sessionEntry.totalCost = doc.meta.totalCost;
      sessionEntry.totalTokens = doc.meta.totalTokens;
      sessionEntry.updatedAt = doc.meta.updatedAt;
    }
  })().finally(() => {
    hydratingSessionDocById.delete(sessionId);
  });

  hydratingSessionDocById.set(sessionId, run);
  return run;
}

async function reloadActiveSessions() {
  const activeId = state.activeSessionId;
  await hydrateSessions().catch(() => undefined);
  if (activeId && sessions.some((session) => session.id === activeId)) {
    staleSessionIds.delete(activeId);
    sessionNoticeById[activeId] = undefined;
    hydratedVersionBySessionId.delete(activeId);
    await hydrateSessionDoc(activeId).catch(() => undefined);
    connectSessionStream(activeId);
  } else if (activeId) {
    staleSessionIds.add(activeId);
    sessionNoticeById[activeId] = 'Session unavailable after reload. Start a replacement session.';
  }
}

async function createReplacementSession() {
  const previousPrompt = forms.prompt;
  const created = await createSession({ title: 'Replacement Session' });
  if (created) forms.prompt = previousPrompt;
}

async function hydrateSessions() {
  if (!currentProject.value) return;
  if (hydratingSessionsPromise) return hydratingSessionsPromise;
  hydratingSessionsPromise = (async () => {
    const rows = await apiGet<SessionMetaApi[]>('/sessions');
    sessions.splice(0, sessions.length, ...rows.map(mapApiSession));
    const activeIds = new Set(rows.map((row) => row.id));
    for (const id of [...streamsBySessionId.keys()]) {
      if (!activeIds.has(id)) disconnectSessionStream(id);
    }
    for (const id of [...hydratedVersionBySessionId.keys()]) {
      if (!activeIds.has(id)) hydratedVersionBySessionId.delete(id);
    }
    if (state.activeSessionId && !activeIds.has(state.activeSessionId)) {
      clearActiveSession();
    }
    if (state.activeSessionId && activeIds.has(state.activeSessionId)) {
      await hydrateSessionDoc(state.activeSessionId);
    }
    syncActiveSessionStream();
  })().finally(() => {
    hydratingSessionsPromise = null;
  });
  return hydratingSessionsPromise;
}

function openSettings(tab: 'Models' | 'Git' | 'Integrations' | 'Appearance' | 'Keybindings' = 'Models') {
  state.settingsTab = tab;
  state.settingsOpen = true;
}

function openGitTrixFromSettings() {
  state.settingsOpen = false;
  if (currentProject.value) {
    state.mode = 'diff';
    return;
  }
  state.openProjectDialogOpen = true;
}


function filenameFromDisposition(value: string | null) {
  if (!value) return '';
  const utf8 = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) return decodeURIComponent(utf8[1]);
  const quoted = value.match(/filename="([^"]+)"/i);
  if (quoted?.[1]) return quoted[1];
  const bare = value.match(/filename=([^;]+)/i);
  return bare?.[1]?.trim() ?? '';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'session-export';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function replaceRecents(next: RecentEntry[]) {
  recents.splice(0, recents.length, ...next);
}

function ensureDemoRecents() {
  if (!isThemeCycleDemo || recents.length > 0) return;
  replaceRecents(DEMO_RECENTS.map((entry) => ({ ...entry })));
}

async function hydrateRecents() {
  const rows = await apiGet<Array<{ id: string; name: string; path: string; lastOpenedAt: string }>>('/projects/recents');
  const statuses = await apiGet<Array<{ id: string; status: RecentStatus }>>('/projects/recents/status');
  const statusById = new Map(statuses.map((row) => [row.id, row.status]));
  replaceRecents(
    rows.map((row) => ({
      ...row,
      status: statusById.get(row.id) ?? 'ok'
    }))
  );
}

async function hydrateProviders() {
  const providers = await apiGet<{ ok: boolean; error?: string; defaultProvider: string; defaultModel: string; providers: ProviderCapability[] }>('/providers');
  providerCapabilities.ok = providers.ok;
  providerCapabilities.error = providers.error;
  providerCapabilities.providers = providers.providers;
  settings.defaultProvider = providers.defaultProvider;
  settings.defaultModel = providers.defaultModel;
}

async function hydrateSettings() {
  const saved = await apiGet<{
    themePreset: ThemePreset;
    durableProvider: 'local' | 'github';
    ephemeralProvider: 'local' | 'cloudflare-artifacts';
    promoteStrategy: 'commit' | 'branch' | 'pr' | 'patch';
    preferredEditor: string | null;
  }>('/settings');
  settings.themePreset = saved.themePreset;
  applyTheme(saved.themePreset);
  settings.durableProvider = saved.durableProvider;
  settings.ephemeralProvider = saved.ephemeralProvider;
  settings.promoteStrategy = saved.promoteStrategy;
  settings.preferredEditor = saved.preferredEditor ?? null;
}

async function hydrateAuth() {
  const session = await apiGet<{ github?: { connected?: boolean; account?: { login?: string; name?: string; email?: string; avatarUrl?: string } | null } }>('/auth/session');
  authState.githubConnected = session.github?.connected === true;
  authState.githubAccount = session.github?.account?.login ?? '';
  authState.githubAvatarUrl = session.github?.account?.avatarUrl ?? '';
}

async function hydrateGitStatus() {
  if (!currentProject.value) return;
  const status = await apiGet<{ current?: string; upstream?: string; remote?: string; canPush?: boolean }>('/git/status');
  gitState.canPush = status.canPush === true;
  gitState.upstream = status.upstream ?? '';
  gitState.remote = status.remote ?? '';
  gitState.branch = status.current ?? '';
}

async function updateTheme(theme: ThemePreset, options: { persist?: boolean } = {}) {
  if (settings.themePreset === theme) return;
  settings.themePreset = theme;
  applyTheme(theme);
  if (options.persist === false) return;
  await apiPatch('/settings', { themePreset: theme });
}

function startThemeCycleDemo() {
  if (!isThemeCycleDemo || themeCycleTimer) return;
  themeCycleOriginalTheme = settings.themePreset;
  if (currentProject.value) goHome();
  state.mode = 'diff';
  state.themeDialogOpen = false;
  state.paletteOpen = false;
  state.settingsOpen = false;
  state.modelPickerOpen = false;
  state.openProjectDialogOpen = false;
  state.cloneDialogOpen = false;

  let themeIndex = THEME_PRESET_IDS.indexOf(settings.themePreset);
  if (themeIndex < 0) themeIndex = 0;

  themeCycleTimer = setInterval(() => {
    themeIndex = (themeIndex + 1) % THEME_PRESET_IDS.length;
    void updateTheme(THEME_PRESET_IDS[themeIndex], { persist: false });
  }, 900);
}

function stopThemeCycleDemo() {
  if (themeCycleTimer) {
    clearInterval(themeCycleTimer);
    themeCycleTimer = null;
  }
  if (!themeCycleOriginalTheme) return;
  settings.themePreset = themeCycleOriginalTheme;
  applyTheme(themeCycleOriginalTheme);
  themeCycleOriginalTheme = null;
}

async function updateGitTrixProvider(key: 'durableProvider' | 'ephemeralProvider' | 'promoteStrategy', value: string) {
  if (key === 'durableProvider' && !['local', 'github'].includes(value)) return;
  if (key === 'ephemeralProvider' && !['local', 'cloudflare-artifacts'].includes(value)) return;
  if (key === 'promoteStrategy' && value !== 'commit') return;
  if (key === 'durableProvider' && value === 'github' && !authState.githubConnected) {
    await connectGitHub();
    if (!authState.githubConnected) return;
  }
  if (settings[key] === value) return;
  const saved = await apiPatch<typeof settings>('/settings', { [key]: value });
  settings.durableProvider = saved.durableProvider;
  settings.ephemeralProvider = saved.ephemeralProvider;
  settings.promoteStrategy = saved.promoteStrategy;
}

async function updatePreferredEditor(value: string | null) {
  if (settings.preferredEditor === value) return;
  const saved = await apiPatch<typeof settings>('/settings', { preferredEditor: value });
  settings.preferredEditor = saved.preferredEditor ?? null;
}

async function connectGitHub() {
  authState.githubError = '';
  authState.githubSigningIn = true;
  try {
    const started = await apiPost<{ device_code: string; user_code: string; verification_uri: string; interval?: number }>('/auth/github/device/start', {});
    authState.githubUserCode = started.user_code;
    authState.githubVerificationUri = started.verification_uri;
    window.open(started.verification_uri, '_blank', 'noopener,noreferrer');
    const intervalMs = Math.max(1000, (started.interval ?? 5) * 1000);
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      const polled = await apiPost<{ pending?: boolean; connected?: boolean; account?: { login?: string; avatarUrl?: string } | null }>('/auth/github/device/poll', { deviceCode: started.device_code });
      if (polled.pending) continue;
      authState.githubConnected = polled.connected === true;
      authState.githubAccount = polled.account?.login ?? '';
      authState.githubAvatarUrl = polled.account?.avatarUrl ?? '';
      authState.githubUserCode = '';
      authState.githubVerificationUri = '';
      break;
    }
  } catch (error) {
    authState.githubError = error instanceof Error ? error.message : 'GitHub sign-in failed';
  } finally {
    authState.githubSigningIn = false;
  }
}

async function disconnectGitHub() {
  await apiDelete('/auth/github');
  authState.githubConnected = false;
  authState.githubAccount = '';
  authState.githubAvatarUrl = '';
  authState.githubUserCode = '';
  authState.githubVerificationUri = '';
  authState.githubError = '';
  if (settings.durableProvider === 'github') {
    const saved = await apiPatch<typeof settings>('/settings', { durableProvider: 'local' });
    settings.durableProvider = saved.durableProvider;
  }
}

async function useLocalGitTrix() {
  const saved = await apiPatch<typeof settings>('/settings', { durableProvider: 'local', ephemeralProvider: 'local' });
  settings.durableProvider = saved.durableProvider;
  settings.ephemeralProvider = saved.ephemeralProvider;
  settings.promoteStrategy = saved.promoteStrategy;
  state.agentSetupMessage = '';
  state.agentSetupKind = 'agent';
}

async function saveProviderAuth(providerId: string, apiKey: string) {
  const key = apiKey.trim();
  if (!providerId || !key) return;
  const shouldActivate = providerId === settings.defaultProvider;
  const desiredModel = settings.defaultModel;
  await apiPost('/providers/' + encodeURIComponent(providerId) + '/auth', { apiKey: key });
  await hydrateProviders();
  const provider = providerCapabilities.providers.find((item) => item.id === providerId);
  if (shouldActivate && provider?.hasAuth && provider.modelIds.includes(desiredModel)) {
    await selectModel(providerId, desiredModel);
  }
}

async function removeProviderAuth(providerId: string) {
  if (!providerId) return;
  await apiDelete('/providers/' + encodeURIComponent(providerId) + '/auth');
  await hydrateProviders();
}

function clampSidebarWidth(width: number) {
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(width, SIDEBAR_MAX_WIDTH));
}

function toggleSidebarCollapse() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  if (!sidebarUiCollapsed.value) {
    state.sidebarWidth = clampSidebarWidth(state.sidebarWidth);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(state.sidebarWidth));
  }
}

function goHome() {
  for (const id of [...streamsBySessionId.keys()]) disconnectSessionStream(id);
  currentProject.value = null;
  state.mode = 'diff';
  clearActiveSession();
  void hydratePickerSessions().catch(() => undefined);
}

function startSidebarResize(event: MouseEvent) {
  if (sidebarUiCollapsed.value) return;
  event.preventDefault();

  const startX = event.clientX;
  const startWidth = state.sidebarWidth;

  const onMouseMove = (moveEvent: MouseEvent) => {
    state.sidebarWidth = clampSidebarWidth(startWidth + (moveEvent.clientX - startX));
  };

  const onMouseUp = () => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(state.sidebarWidth));
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    stopSidebarResize = null;
  };

  stopSidebarResize = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    stopSidebarResize = null;
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function openProject(projectName: string, path: string, mode: 'diff' | 'session', branch = 'main', projectId?: string) {
  const normalizedPath = path.replace(/\\/g, '/');
  const id = projectId || normalizedPath;
  currentProject.value = { id, name: projectName, branch, path: normalizedPath };

  const existingRecent = recents.find((r) => r.path === path);
  if (!existingRecent) {
    recents.unshift({ id: `r${recents.length + 1}`, name: projectName, path, lastOpenedAt: 'now', status: 'ok' });
  } else {
    existingRecent.status = 'ok';
    existingRecent.lastOpenedAt = 'now';
  }

  state.mode = mode;
  state.agentSetupMessage = '';
  state.agentSetupKind = 'agent';
  clearActiveSession();
}

async function queueProjectOpen(projectName: string, path: string, mode: 'diff' | 'session', options?: { skipAutoCreate?: boolean; branch?: string; projectId?: string }) {
  state.openProjectDialogOpen = false;
  state.cloneDialogOpen = false;

  openProject(projectName, path, mode, options?.branch ?? 'main', options?.projectId);
  await hydrateSessions().catch(() => undefined);
  if (!options?.skipAutoCreate && mode === 'session' && !state.activeSessionId) {
    if (sessions.length === 0) {
      await createSession();
    }
  }

  const existingRecent = recents.find((r) => r.path === path);
  if (!existingRecent) {
    recents.unshift({ id: `pending-${Date.now()}`, name: projectName, path, lastOpenedAt: 'now', status: 'ok' });
  }
}

async function openExistingProject(payload: { mode: 'diff' | 'session' }) {
  const path = picker.openPath.trim();
  if (!path) return;
  const opened = await sessionOrchestrator.resolveProjectOpen(path);
  if (!opened.ok) return;
  await queueProjectOpen(opened.name, opened.path, payload.mode, { branch: opened.branch, projectId: opened.id });
  void hydrateRecents();
}

async function cloneRepository(mode: 'diff' | 'session') {
  picker.cloneError = '';
  const url = picker.cloneUrl.trim();
  const destination = picker.cloneDestination.trim();
  if (!url || !destination) return;
  try {
    const cloned = await apiPost<{ id: string; name: string; path: string; branch: string }>('/projects/clone', { url, destination });
    await queueProjectOpen(cloned.name, cloned.path, mode, { branch: cloned.branch, projectId: cloned.id });
    void hydrateRecents();
  } catch (error) {
    picker.cloneError = error instanceof Error ? error.message : 'Clone failed';
  }
}

function openCommandPalette() {
  state.paletteOpen = true;
  forms.palette = '';
  state.paletteIndex = 0;
}

async function openFileDiff(fileTarget: string | undefined) {
  await openCurrentSessionDiff(fileTarget || undefined);
}

async function openCurrentSessionDiff(fileTarget?: string) {
  if (!state.activeSessionId) return;
  const session = activeSession.value;
  if (!session?.projectPath) return;

  state.sessionDiffOverlayOpen = true;
  sessionDiff.diff = '';
  sessionDiff.files = [];
  sessionDiff.focusFile = fileTarget ?? '';
  sessionDiff.loading = true;
  sessionDiff.error = '';

  try {
    const payload = await apiGet<{ diff: string; files?: string[] }>(`/sessions/${encodeURIComponent(state.activeSessionId)}/diff?projectPath=${encodeURIComponent(session.projectPath)}`);
    sessionDiff.diff = payload.diff ?? '';
    sessionDiff.files = payload.files?.length ? payload.files : filesFromPatch(sessionDiff.diff);
  } catch (error) {
    sessionDiff.error = error instanceof Error ? error.message : 'Failed to load session diff';
  } finally {
    sessionDiff.loading = false;
  }
}

function openCommitsListDiff() {
  if (!currentProject.value) return;
  state.diffOpenRequest = { token: Date.now(), mode: 'history' };
  state.mode = 'diff';
}

async function createSession(options?: { title?: string; context?: string; initialEntries?: TimelineEntry[] }) {
  state.sessionContinueOpen = false;
  if (creatingSession) return creatingSession;
  creatingSession = createSessionInner(options).finally(() => {
    creatingSession = null;
  });
  return creatingSession;
}

async function createSessionInner(options?: { title?: string; context?: string; initialEntries?: TimelineEntry[] }) {
  if (!currentProject.value) return null;
  state.agentSetupMessage = '';
  let created: SessionMetaApi;
  try {
    created = await apiPost<SessionMetaApi>('/agent/sessions', { title: options?.title ?? 'New Session' });
  } catch (error) {
    state.mode = 'session';
    const message = error instanceof Error ? error.message : 'Unable to start session';
    const isGitTrixError = message.toLowerCase().includes('gittrix') || message.includes('GITTRIX_SESSION_START_FAILED');
    state.agentSetupKind = isGitTrixError ? 'gittrix' : 'agent';
    state.agentSetupMessage = !isGitTrixError && (message.includes('provider') || message.includes('model'))
      ? `${message}. Active model: ${settings.defaultProvider}/${settings.defaultModel}. Project picker and diff review still work without an agent key.`
      : message;
    return null;
  }
  const mapped = mapApiSession(created);
    sessions.unshift(mapped);
    staleSessionIds.delete(mapped.id);
    sessionNoticeById[mapped.id] = undefined;
  timelineBySessionId[mapped.id] = [];
  sessionContextById[mapped.id] = options?.context ?? '';
  switchActiveSession(mapped.id);
  activeSessionIdByProject[currentProject.value.id] = mapped.id;
  await hydrateSessionDoc(mapped.id);
  if (options?.initialEntries?.length) {
    for (const entry of options.initialEntries) appendTimelineEvent(mapped.id, entry);
  }
  connectSessionStream(mapped.id);
  state.mode = 'session';
  return mapped;
}

async function startSessionFromDiff(payload: { source: 'commit' | 'uncommitted'; ref?: string; file?: string; files?: string[]; hunks?: Array<{ id: string; file: string; header: string; startLine: number }> }) {
  if (!currentProject.value) return;
  const source = payload.source === 'commit' ? 'commits' : 'uncommitted';
  const scopedFiles = payload.files?.length ? payload.files : payload.file ? [payload.file] : [];
  const hunkFiles = [...new Set((payload.hunks ?? []).map((hunk) => hunk.file))];
  const filesToPack = scopedFiles.length ? scopedFiles : hunkFiles.length ? hunkFiles : [];
  async function packFile(file?: string) {
    const packBody: Record<string, unknown> = { source, projectPath: currentProject.value!.path };
    if (payload.source === 'commit' && payload.ref) packBody.ref = payload.ref;
    if (file) packBody.file = file;
    const packed = await apiPost<{ diff: string }>('/diff/pack', packBody);
    return packed.diff ?? '';
  }
  const payloadByFile: Record<string, string> = {};
  let diff = '';
  if (filesToPack.length) {
    const chunks = await Promise.all(filesToPack.map(async (file) => {
      const chunk = await packFile(file);
      payloadByFile[file] = chunk;
      return chunk;
    }));
    diff = chunks.join('\n').trim() || 'No diff context available.';
  } else {
    diff = (await packFile()).trim() || 'No diff context available.';
  }
  const context = payload.source === 'commit' && payload.ref
    ? `commit ${payload.ref.slice(0, 7)}`
    : 'working tree changes';
  const selectedHunkCopy = payload.hunks?.length ? ` · ${payload.hunks.length} hunks` : '';
  const created = await createSession({
    title: `Session from ${context}`,
    context,
    initialEntries: [{
      id: 'e1',
      kind: 'System',
      text: `Context attached: ${context} · ${filesToPack.length || 'selected'} file scope${selectedHunkCopy}`,
      time: 'now',
      level: 'info'
    }]
  });

  if (!created) return;

  if (state.activeSessionId && currentProject.value) {
    contextBundleBySessionId[state.activeSessionId] = {
      id: `ctx-${Date.now()}`,
      sessionId: state.activeSessionId,
      projectPath: currentProject.value.path,
      sourceType: payload.source,
      sourceRef: payload.ref,
      selectedFile: payload.file,
      selectedFiles: filesToPack,
      selectedHunks: payload.hunks ?? [],
      payloadByFile,
      fileCount: filesToPack.length || Math.max(1, (diff.match(/^diff --git /gm) ?? []).length),
      charCount: diff.length,
      payload: diff
    };
  }
}

function removeContextChip(id: string) {
  const ctx = activeContextBundle.value;
  if (!ctx || !state.activeSessionId) return;
  if (id === 'source' || id === 'files') {
    removeActiveContext();
    return;
  }
  if (id.startsWith('file:')) {
    const file = id.slice(5);
    ctx.selectedFiles = (ctx.selectedFiles ?? []).filter((entry) => entry !== file);
    ctx.selectedHunks = (ctx.selectedHunks ?? []).filter((hunk) => hunk.file !== file);
  }
  if (id.startsWith('hunk:')) {
    const hunkId = id.slice(5);
    ctx.selectedHunks = (ctx.selectedHunks ?? []).filter((hunk) => hunk.id !== hunkId);
  }
  const remainingFiles = new Set([...(ctx.selectedFiles ?? []), ...(ctx.selectedHunks ?? []).map((hunk) => hunk.file)]);
  if (!remainingFiles.size) {
    removeActiveContext();
    return;
  }
  if (ctx.payloadByFile && Object.keys(ctx.payloadByFile).length) {
    ctx.payload = [...remainingFiles].map((file) => ctx.payloadByFile?.[file] ?? '').filter(Boolean).join('\n').trim() || ctx.payload;
    ctx.fileCount = remainingFiles.size;
    ctx.charCount = ctx.payload.length;
  }
}

function selectSessionFromSidebar(sessionId: string) {
  state.sessionContinueOpen = false;
  const session = sessions.find((entry) => entry.id === sessionId);
  if (!session) return;

  if (!currentProject.value || currentProject.value.path !== session.projectPath) {
    const sessionPath = session.projectPath || `C:/repos/${session.project || session.repo || 'project'}`;
    activeSessionIdByProject[sessionPath.replace(/\\/g, '/')] = sessionId;
    const recentName = recents.find((recent) => recent.path === sessionPath)?.name;
    const projectName = recentName || session.repo || session.project || 'project';
    openProject(projectName, sessionPath, 'session');
    switchActiveSession(sessionId);
    return;
  }

  switchActiveSession(sessionId);
  if (currentProject.value) activeSessionIdByProject[currentProject.value.id] = sessionId;
  state.mode = 'session';
}

function removeSessionLocal(sessionId: string) {
  disconnectSessionStream(sessionId);
  const index = sessions.findIndex((entry) => entry.id === sessionId);
  if (index >= 0) sessions.splice(index, 1);
  delete timelineBySessionId[sessionId];
  delete sessionContextById[sessionId];
  delete contextBundleBySessionId[sessionId];
  delete draftBySessionId[sessionId];
  delete sessionNoticeById[sessionId];
  staleSessionIds.delete(sessionId);
  sendingSessionIds.delete(sessionId);

  for (const [projectId, activeId] of Object.entries(activeSessionIdByProject)) {
    if (activeId === sessionId) delete activeSessionIdByProject[projectId];
  }

  if (state.activeSessionId === sessionId) {
    const replacement = currentProject.value ? sessions.find((entry) => entry.projectPath === currentProject.value?.path) : sessions[0];
    if (replacement) switchActiveSession(replacement.id);
    else clearActiveSession();
  }
}

function openRenameDialog(sessionId: string) {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return;
  renameDialog.open = true;
  renameDialog.sessionId = sessionId;
  renameDialog.value = session.title === 'New Session' ? '' : session.title;
  renameDialog.busy = false;
}

function closeRenameDialog() {
  renameDialog.open = false;
  renameDialog.sessionId = '';
  renameDialog.value = '';
  renameDialog.busy = false;
}

async function confirmRename() {
  const title = renameDialog.value.trim();
  if (!title || renameDialog.busy) return;
  const session = sessions.find((s) => s.id === renameDialog.sessionId);
  if (!session) return;
  renameDialog.busy = true;
  try {
    await apiPatch(`/sessions/${encodeURIComponent(renameDialog.sessionId)}`, { title });
    session.title = title;
    closeRenameDialog();
  } catch {
    renameDialog.busy = false;
  }
}

async function confirmDeleteSession(sessionId: string) {
  const session = sessions.find((entry) => entry.id === sessionId);
  if (!session?.projectPath) return;
  deleteDialog.open = true;
  deleteDialog.sessionId = sessionId;
  deleteDialog.title = session.title;
  deleteDialog.error = '';
  deleteDialog.busy = false;
}

function closeDeleteSessionDialog() {
  if (deleteDialog.busy) return;
  deleteDialog.open = false;
  deleteDialog.sessionId = '';
  deleteDialog.title = '';
  deleteDialog.error = '';
}

async function confirmDeleteSessionNow() {
  const sessionId = deleteDialog.sessionId;
  const session = sessions.find((entry) => entry.id === sessionId);
  if (!session?.projectPath) return;
  deleteDialog.error = '';
  deleteDialog.busy = true;
  try {
    await apiDelete(`/sessions/${encodeURIComponent(sessionId)}?projectPath=${encodeURIComponent(session.projectPath)}`);
    removeSessionLocal(sessionId);
    closeDeleteSessionDialog();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete session';
    sessionNoticeById[sessionId] = message;
    deleteDialog.error = message;
  } finally {
    deleteDialog.busy = false;
  }
}

const sessionOrchestrator = useSessionOrchestrator({
  apiPost,
  apiDelete,
  hydrateRecents,
  hydrateSessions,
  queueProjectOpen,
  createSession,
  selectSessionFromSidebar,
  sessions,
  recents
});

const openRecentProject = sessionOrchestrator.openRecentProject;
const continueRecentSessionFromPicker = sessionOrchestrator.continueRecentSessionFromPicker;
const startNewRecentSessionFromPicker = sessionOrchestrator.startNewRecentSessionFromPicker;
const removeRecentProject = sessionOrchestrator.removeRecentProject;
const forgetRecentProject = sessionOrchestrator.forgetRecentProject;

async function fetchPickerCommits(path: string) {
  const key = path.replace(/\\/g, '/').trim().replace(/\/+$/, '').toLowerCase();
  if (pickerCommitsByPath[key] !== undefined) return;
  try {
    const rows = await apiGet<Array<{ id: string; ref?: string; title?: string }>>(`/diff/items?source=commits&limit=20&projectPath=${encodeURIComponent(path)}`);
    pickerCommitsByPath[key] = rows.map((row) => ({
      ref: row.ref ?? row.id,
      shortRef: (row.ref ?? row.id).slice(0, 7),
      title: row.title ?? row.id
    }));
  } catch {
    pickerCommitsByPath[key] = [];
  }
}

async function openRecentDiff(payload: { name: string; path: string; source: 'uncommitted' | 'commit'; commitRef?: string }) {
  const opened = await sessionOrchestrator.resolveProjectOpen(payload.path);
  if (!opened.ok) { void hydrateRecents(); return; }
  const recent = recents.find((r) => r.path === payload.path);
  if (recent) recent.status = 'ok';
  await queueProjectOpen(payload.name || recent?.name || opened.name, opened.path, 'diff');
  void hydrateRecents();
  if (payload.source === 'uncommitted') {
    state.diffOpenRequest = { token: Date.now(), mode: 'uncommitted' };
  } else if (payload.source === 'commit' && payload.commitRef) {
    state.diffOpenRequest = { token: Date.now(), mode: 'commit', commitRef: payload.commitRef };
  } else {
    state.diffOpenRequest = { token: Date.now(), mode: 'history' };
  }
}

function toEpochMs(value?: string) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSessionTitle(session: Session) {
  const trimmed = session.title?.trim();
  if (!trimmed || trimmed.toLowerCase() === 'new session') return 'New Session';
  return trimmed;
}

function openExportDialog(sessionId: string) {
  const session = sessions.find((entry) => entry.id === sessionId);
  if (!session) return;
  exportDialog.sessionId = sessionId;
  exportDialog.title = session.title;
  exportDialog.error = '';
}

function closeExportDialog() {
  exportDialog.sessionId = '';
  exportDialog.title = '';
  exportDialog.error = '';
}

async function exportSession(format: typeof exportFormats[number]['value']) {
  const sessionId = exportDialog.sessionId;
  const session = sessions.find((entry) => entry.id === sessionId);
  if (!session?.projectPath) return;
  exportDialog.error = '';
  try {
    const response = await apiBlob(`/sessions/${encodeURIComponent(sessionId)}/export?projectPath=${encodeURIComponent(session.projectPath)}&format=${encodeURIComponent(format)}`);
    const filename = filenameFromDisposition(response.headers.get('content-disposition')) || `${session.title || session.id}.${format === 'markdown' ? 'md' : format === 'json' ? 'json' : 'jsonl'}`;
    downloadBlob(await response.blob(), filename);
    closeExportDialog();
  } catch (error) {
    exportDialog.error = error instanceof Error ? error.message : 'Failed to export session';
  }
}

async function sendPrompt() {
  if (!state.activeSessionId || !forms.prompt.trim()) return;
  const sessionId = state.activeSessionId;
  const sentPrompt = forms.prompt;
  if (staleSessionIds.has(sessionId)) return;
  if (sendingSessionIds.has(sessionId)) return;
  const session = activeSession.value;
  if (!session?.projectPath) return;
  const bundle = contextBundleBySessionId[sessionId];
  sendingSessionIds.add(sessionId);

  // Prepend any text attachments as context before the prompt
  let finalPrompt = sentPrompt;
  if (textAttachments.length > 0) {
    const blocks = textAttachments.map((t, i) => `[Attached text ${i + 1}]\n${t.content}`).join('\n\n---\n\n');
    finalPrompt = `${blocks}\n\n---\n\n${sentPrompt}`;
  }

  try {
    await apiPost(`/agent/sessions/${encodeURIComponent(sessionId)}/send`, {
      prompt: finalPrompt,
      context: bundle?.payload,
      attachments: composerAttachments.filter((item) => item.status === 'uploaded' && item.id).map((item) => item.id),
      projectPath: session.projectPath
    });
    if (state.activeSessionId === sessionId && forms.prompt === sentPrompt) {
      forms.prompt = '';
      draftBySessionId[sessionId] = '';
      composerAttachments.splice(0, composerAttachments.length);
      textAttachments.splice(0, textAttachments.length);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send prompt';
    if (message.toLowerCase().includes('session not found')) {
      markSessionStale(sessionId, 'Session not found. Reload sessions or start a replacement session.');
      return;
    }
    sessionNoticeById[sessionId] = message;
  } finally {
    sendingSessionIds.delete(sessionId);
  }
}

function removeActiveContext() {
  if (!state.activeSessionId) return;
  if (!contextBundleBySessionId[state.activeSessionId]) return;
  contextBundleBySessionId[state.activeSessionId] = undefined;
  const list = timelineBySessionId[state.activeSessionId] ?? (timelineBySessionId[state.activeSessionId] = []);
  list.push({ id: `e${list.length + 1}`, kind: 'System', text: 'Context removed from session.', time: 'now', level: 'info' });
}

async function runPromote() {
  if (!state.activeSessionId) return;
  const session = activeSession.value;
  if (!session?.projectPath) return;
  state.promoteDialogOpen = true;
  promote.loading = true;
  promote.submitting = false;
  promote.stashing = false;
  promote.pushing = false;
  promote.error = '';
  promote.dirtyFiles = [];
  promote.result = null;
  promote.pushResult = null;
  promote.diff = '';
  promote.files = [];
  promote.selectedFiles = [];
  promote.fileMenuOpen = false;
  try {
    const payload = await apiGet<{ diff: string; files?: string[] }>(`/sessions/${encodeURIComponent(state.activeSessionId)}/diff?projectPath=${encodeURIComponent(session.projectPath)}`);
    promote.diff = payload.diff ?? '';
    promote.files = payload.files?.length ? payload.files : filesFromPatch(promote.diff);
    promote.selectedFiles = [...promote.files];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load session diff';
    promote.error = message;
    appendTimelineEvent(state.activeSessionId, {
      id: `${state.activeSessionId}-${Date.now()}-promote-open-err`,
      kind: 'Promote',
      text: message,
      time: 'now',
      level: 'error'
    });
  } finally {
    promote.loading = false;
  }
}

async function confirmPromote() {
  if (!state.activeSessionId) return;
  const session = activeSession.value;
  if (!session?.projectPath) return;
  if (promoteCommitDisabled.value) return;
  const files = promote.selectedFiles;
  const selector = !promote.files.length || files.length === promote.files.length ? { mode: 'all' as const } : { mode: 'files' as const, files };
  promote.submitting = true;
  promote.pushing = false;
  promote.error = '';
  promote.dirtyFiles = [];
  promote.pushResult = null;
  try {
    const result = await apiPost<{ sha: string; branch: string; prUrl?: string }>(`/sessions/${encodeURIComponent(state.activeSessionId)}/promote?projectPath=${encodeURIComponent(session.projectPath)}`, {
      selector,
      strategy: 'commit',
      message: promoteCommitMessage(session)
    });
    promote.result = result;
    if (promoteShouldPush.value && settings.durableProvider === 'local') {
      promote.submitting = false;
      promote.pushing = true;
      promote.pushResult = await apiPost<{ remote: string; branch: string; upstream: string; sha: string }>('/git/push', {});
    }
    appendTimelineEvent(state.activeSessionId, {
      id: `${state.activeSessionId}-${Date.now()}-promote`,
      kind: 'Promote',
      text: promote.pushResult
        ? `Committed and pushed: ${promote.pushResult.upstream} @ ${promote.pushResult.sha.slice(0, 7)}`
        : `${promoteResultTitle.value}: ${result.branch} @ ${result.sha.slice(0, 7)}`,
      time: 'now',
      level: 'info'
    });
    void hydrateGitStatus().catch(() => undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Promote failed';
    const payload = error instanceof ApiRequestError ? error.payload as { code?: string; conflictingFiles?: string[]; durableSha?: string; baselineSha?: string; files?: string[] } | undefined : undefined;
    if (payload?.code === 'BASELINE_CONFLICT') {
      conflict.conflictingFiles = payload.conflictingFiles ?? [];
      conflict.durableSha = payload.durableSha ?? '';
      conflict.baselineSha = payload.baselineSha ?? '';
      state.conflictDialogOpen = true;
      return;
    }
    if (payload?.code === 'DURABLE_REPO_DIRTY') {
      promote.dirtyFiles = payload.files ?? [];
    }
    promote.error = message;
    appendTimelineEvent(state.activeSessionId, {
      id: `${state.activeSessionId}-${Date.now()}-promote-err`,
      kind: 'Promote',
      text: message,
      time: 'now',
      level: 'error'
    });
  } finally {
    promote.submitting = false;
    promote.pushing = false;
  }
}

function promoteCommitMessage(session: Session) {
  const title = session.title?.trim() || 'Session changes';
  return `glib-code: ${title}\n\nGenerated-by: glib-code\nSession-id: ${session.id}`;
}

async function stashAndRetryPromote() {
  if (!promote.dirtyFiles.length) return;
  promote.stashing = true;
  promote.error = '';
  try {
    await apiPost('/git/stash', { message: `glib-code stash before session commit ${new Date().toISOString()}` });
    promote.dirtyFiles = [];
    await confirmPromote();
  } catch (error) {
    promote.error = error instanceof Error ? error.message : 'Stash failed';
  } finally {
    promote.stashing = false;
  }
}

async function abortTurn() {
  if (!state.activeSessionId) return;
  const session = activeSession.value;
  if (!session?.projectPath) return;
  await apiDelete(`/agent/sessions/${encodeURIComponent(state.activeSessionId)}/turn?projectPath=${encodeURIComponent(session.projectPath)}`);
}

function terminalWsUrl() {
  const base = API_BASE.replace(/\/$/, '');
  const wsBase = base.replace(/^http/i, 'ws');
  return `${wsBase}/term`;
}

function openAttachmentPicker() {
  attachmentInputRef.value?.click();
}

async function uploadAttachment(item: ComposerAttachment) {
  if (!item.file) return;
  item.status = 'uploading';
  item.error = '';
  const body = new FormData();
  body.set('file', item.file, item.name);
  try {
    const response = await fetch(`${API_BASE}/attachments`, { method: 'POST', body });
    if (!response.ok) throw new Error(await response.text());
    const payload = await response.json() as { id: string };
    item.id = payload.id;
    item.status = 'uploaded';
  } catch (error) {
    item.status = 'failed';
    item.error = error instanceof Error ? error.message : 'Upload failed';
  }
}

function onAttachmentInputChange(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (!files?.length) return;
  for (const file of Array.from(files)) {
    const item: ComposerAttachment = {
      localId: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      mime: file.type,
      status: 'queued',
      file
    };
    composerAttachments.push(item);
    void uploadAttachment(item);
  }
  (event.target as HTMLInputElement).value = '';
}

async function removeAttachment(localId: string) {
  const idx = composerAttachments.findIndex((item) => item.localId === localId);
  if (idx < 0) return;
  const item = composerAttachments[idx];
  if (item.id) {
    item.status = 'removing';
    try {
      await apiDelete(`/attachments/${encodeURIComponent(item.id)}`);
    } catch {
      item.status = 'failed';
      item.error = 'Delete failed';
      return;
    }
  }
  composerAttachments.splice(idx, 1);
}

function retryAttachment(localId: string) {
  const item = composerAttachments.find((entry) => entry.localId === localId);
  if (!item) return;
  void uploadAttachment(item);
}

function clearTerminalReconnectTimer() {
  if (!terminalReconnectTimer) return;
  clearTimeout(terminalReconnectTimer);
  terminalReconnectTimer = null;
}

function closeTerminalSocket() {
  clearTerminalReconnectTimer();
  if (terminalSocket) {
    terminalSocket.onopen = null;
    terminalSocket.onclose = null;
    terminalSocket.onerror = null;
    terminalSocket.onmessage = null;
    terminalSocket.close();
    terminalSocket = null;
  }
}

function scheduleTerminalReconnect() {
  clearTerminalReconnectTimer();
  if (!state.terminalOpen) return;
  if (terminal.reconnectAttempts >= 6) {
    terminal.status = 'error';
    terminal.error = 'Terminal disconnected. Retry limit reached.';
    return;
  }
  const delay = Math.min(1000 * 2 ** terminal.reconnectAttempts, 8000);
  terminal.status = 'reconnecting';
  terminalReconnectTimer = setTimeout(() => {
    terminal.reconnectAttempts += 1;
    openTerminalSocket(true);
  }, delay);
}

function openTerminalSocket(isReconnect = false) {
  closeTerminalSocket();
  terminal.status = isReconnect ? 'reconnecting' : 'connecting';
  terminal.error = '';

  let ws: WebSocket;
  try {
    ws = new WebSocket(terminalWsUrl());
  } catch {
    terminal.status = 'unavailable';
    terminal.error = 'Terminal transport unavailable';
    return;
  }

  terminalSocket = ws;
  ws.onopen = () => {
    terminal.status = 'open';
    terminal.reconnectAttempts = 0;
    ws.send(JSON.stringify({ type: 'hello', sessionId: terminal.sessionId || undefined }));
  };
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (data.type === 'ack' && typeof data.sessionId === 'string') {
        terminal.sessionId = data.sessionId;
        return;
      }
      if (data.type === 'error') {
        terminal.error = typeof data.message === 'string' ? data.message : 'Terminal error';
        terminal.status = data.retryable ? terminal.status : 'error';
        return;
      }
      if (data.type === 'output' && typeof data.text === 'string') {
        terminal.output = `${terminal.output === 'No commands run yet.' ? '' : `${terminal.output}\n`}${data.text}`.trimStart();
        return;
      }
      if (data.type === 'exit' && typeof data.id === 'string') {
        const code = typeof data.code === 'number' ? data.code : 1;
        terminal.output = `${terminal.output}\n[exit ${data.id}: ${code}]`;
      }
    } catch {
      terminal.error = 'Received invalid terminal response';
    }
  };
  ws.onerror = () => {
    terminal.error = 'Terminal connection failed';
  };
  ws.onclose = () => {
    terminalSocket = null;
    if (!state.terminalOpen) {
      terminal.status = 'closed';
      return;
    }
    scheduleTerminalReconnect();
  };
}

function runTerminal() {
  const command = forms.terminal.trim();
  if (!command) return;
  if (!terminalSocket || terminal.status !== 'open') {
    terminal.error = 'Terminal is not connected';
    return;
  }
  const id = crypto.randomUUID().slice(0, 8);
  terminal.output = `${terminal.output === 'No commands run yet.' ? '' : `${terminal.output}\n`}$ ${command}`.trimStart();
  terminalSocket.send(JSON.stringify({ type: 'run', id, command }));
}

function runPalette(id: string) {
  if (id === 'mode.diff' && currentProject.value) state.mode = 'diff';
  if (id === 'mode.session' && currentProject.value) state.mode = 'session';
  if (id === 'picker.open') {
    currentProject.value = null;
    state.mode = 'diff';
    clearActiveSession();
  }
  if (id === 'settings.open') openSettings('Models');
  if (id === 'terminal.toggle') state.terminalOpen = !state.terminalOpen;
  if (id === 'session.new') createSession();
  state.paletteOpen = false;
}

function updatePaletteQuery(value: string) {
  forms.palette = value;
  state.paletteIndex = 0;
}

function updateKeybinding(command: string, key: string) {
  const row = keybindings.find((k) => k.command === command);
  if (row) row.key = key;
}

async function updateDefaultProvider(providerId: string) {
  const provider = providerCapabilities.providers.find((item) => item.id === providerId);
  if (!provider || !provider.hasAuth) return;
  const nextModel = provider.modelIds[0] ?? settings.defaultModel;
  const saved = await apiPatch<{ defaultProvider: string; defaultModel: string }>('/providers/defaults', {
    defaultProvider: providerId,
    defaultModel: nextModel
  });
  settings.defaultProvider = saved.defaultProvider;
  settings.defaultModel = saved.defaultModel;
}

async function selectModel(providerId: string, modelId: string) {
  const provider = providerCapabilities.providers.find((item) => item.id === providerId);
  if (!provider || !provider.hasAuth) return;
  if (provider.modelIds.length > 0 && !provider.modelIds.includes(modelId)) return;
  const saved = await apiPatch<{ defaultProvider: string; defaultModel: string }>('/providers/defaults', {
    defaultProvider: providerId,
    defaultModel: modelId
  });
  settings.defaultProvider = saved.defaultProvider;
  settings.defaultModel = saved.defaultModel;
  state.modelPickerOpen = false;
}

function openProviderAuth(providerId: string, modelId?: string) {
  settings.defaultProvider = providerId;
  if (modelId) settings.defaultModel = modelId;
  state.modelPickerOpen = false;
  openSettings('Models');
}

watch(
  () => settings.defaultModel,
  async (nextModel, prevModel) => {
    if (!nextModel || !settings.defaultProvider) return;
    if (nextModel === prevModel) return;
    const provider = providerCapabilities.providers.find((item) => item.id === settings.defaultProvider);
    if (!provider) return;
    if (provider.modelIds.length > 0 && !provider.modelIds.includes(nextModel)) return;
    try {
      await apiPatch('/providers/defaults', {
        defaultProvider: settings.defaultProvider,
        defaultModel: nextModel
      });
    } catch {
      // keep UI responsive, next hydrate will reconcile
    }
  }
);

function pushTimelineInfo(sessionId: string, text: string) {
  const list = timelineBySessionId[sessionId] ?? (timelineBySessionId[sessionId] = []);
  list.push({ id: `info_${Date.now()}`, kind: 'info', text, time: new Date().toLocaleTimeString() });
}

function mapGitStatusToTree(status: { staged?: string[]; modified?: string[]; deleted?: string[]; not_added?: string[]; conflicted?: string[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of status.staged ?? []) out[f] = 'added';
  for (const f of status.modified ?? []) out[f] = 'modified';
  for (const f of status.deleted ?? []) out[f] = 'deleted';
  for (const f of status.not_added ?? []) out[f] = 'untracked';
  for (const f of status.conflicted ?? []) out[f] = 'modified';
  return out;
}

let treeArtifactInflight = false;

async function pushTreeArtifact(scopedPaths?: string[], scopedGitStatus?: Record<string, string>) {
  if (treeArtifactInflight) return;
  const sid = state.activeSessionId;
  if (!sid) return;

  treeArtifactInflight = true;
  const list = timelineBySessionId[sid] ?? (timelineBySessionId[sid] = []);

  let paths = scopedPaths;
  let gitStatus = scopedGitStatus ?? {};

  try {
    if (!paths) {
      try {
        const res = await apiGet<{ ok: boolean; paths: string[] }>('/fs/paths');
        paths = res.paths ?? [];
      } catch {
        paths = [];
      }
    }

    if (!scopedGitStatus) {
      try {
        const status = await apiGet<{ staged?: string[]; modified?: string[]; deleted?: string[]; not_added?: string[]; conflicted?: string[] }>('/git/status');
        if (status) gitStatus = mapGitStatusToTree(status);
      } catch {
        // keep empty gitStatus
      }
    }

    list.push({
      id: `tree_${Date.now()}`,
      kind: 'System',
      text: '',
      time: new Date().toLocaleTimeString(),
      toolCalls: [{
        id: `tc_tree_${Date.now()}`,
        title: 'File tree',
        status: 'done',
        renderKind: 'tree',
        preview: `${paths.length} paths`,
        treePaths: paths,
        treeGitStatus: gitStatus
      }]
    });
  } finally {
    treeArtifactInflight = false;
  }
}

function runComposerCommand(command: string, args?: string) {  if (command === 'help') {
    openCommandPalette();
    return;
  }

  if (command === 'model' || command === 'models') {
    if (args) {
      const [provider, modelId] = args.split('/');
      if (provider && modelId) {
        void selectModel(provider, modelId);
        return;
      }
    }
    state.modelPickerOpen = true;
    return;
  }

  if (command === 'theme' || command === 'themes') {
    state.themeDialogOpen = true;
    return;
  }

  if (command === 'new' || command === 'clear') {
    createSession();
    return;
  }

  if (command === 'sessions' || command === 'resume' || command === 'continue') {
    state.mode = 'session';
    if (!activeSession.value) createSession();
    return;
  }

  if (command === 'diff') {
    if (!currentProject.value) return;
    state.mode = 'diff';
    return;
  }

  if (command === 'tree') {
    if (!currentProject.value) return;
    void pushTreeArtifact();
    return;
  }

  if (command === 'session') {
    if (!currentProject.value) return;
    state.mode = 'session';
    if (!activeSession.value) createSession();
    return;
  }

  if (command === 'rename') {
    if (activeSession.value && args) {
      void apiPatch(`/sessions/${activeSession.value.id}`, { title: args }).catch(() => {});
    } else {
      openCommandPalette();
    }
    return;
  }

  if (command === 'fork') {
    if (activeSession.value) {
      void apiPost(`/sessions/${activeSession.value.id}/fork`, {}).then(() => {
        void reloadActiveSessions();
      }).catch(() => {});
    }
    return;
  }

  if (command === 'compact') {
    if (activeSession.value) {
      void apiPost(`/sessions/${activeSession.value.id}/compact`, {}).catch(() => {});
    }
    return;
  }

  if (command === 'archive') {
    if (activeSession.value) {
      confirmDeleteSession(activeSession.value.id);
    }
    return;
  }

  if (command === 'plan' || command === 'fast') {
    openCommandPalette();
    return;
  }

  if (command === 'cost') {
    if (activeSession.value) {
      const sid = activeSession.value.id;
      void apiGet(`/sessions/${sid}/stats`).then((stats: any) => {
        if (!stats) return;
        const cost = stats.totalCost != null ? formatCost(stats.totalCost) : '0¢';
        const t = stats.totalTokens ?? {};
        const total = (t.input ?? 0) + (t.output ?? 0) + (t.cacheRead ?? 0) + (t.cacheWrite ?? 0);
        const parts = [`Cost: ${cost}`, `Tokens: ${total.toLocaleString()}`];
        if (t.input) parts.push(`Input: ${t.input.toLocaleString()}`);
        if (t.output) parts.push(`Output: ${t.output.toLocaleString()}`);
        if (t.cacheRead) parts.push(`Cache read: ${t.cacheRead.toLocaleString()}`);
        if (t.cacheWrite) parts.push(`Cache write: ${t.cacheWrite.toLocaleString()}`);
        pushTimelineInfo(sid, parts.join(' · '));
      }).catch(() => {});
    }
    return;
  }

  if (command === 'status') {
    if (activeSession.value) {
      const sid = activeSession.value.id;
      void apiGet(`/sessions/${sid}/stats`).then((stats: any) => {
        if (!stats) return;
        const cost = stats.totalCost != null ? formatCost(stats.totalCost) : '0¢';
        const t = stats.totalTokens ?? {};
        const total = (t.input ?? 0) + (t.output ?? 0) + (t.cacheRead ?? 0) + (t.cacheWrite ?? 0);
        pushTimelineInfo(sid, `Status · Cost: ${cost} · Tokens: ${total.toLocaleString()}`);
      }).catch(() => {});
    }
    return;
  }

  if (command === 'undo' || command === 'redo' || command === 'share' || command === 'init') {
    openCommandPalette();
  }

  if (command === 'stop' || command === 'abort') {
    void abortTurn();
  }

  if (command === 'attach' || command === 'attachments') {
    openAttachmentPicker();
    return;
  }
}

const shortcuts = useGlobalShortcuts({
  state,
  forms,
  filteredPaletteCommands,
  runPalette,
  closeOnEscape: [
    () => {
      if (promote.fileMenuOpen) {
        promote.fileMenuOpen = false;
        return true;
      }
      return false;
    },
    () => {
      if (deleteDialog.open) {
        closeDeleteSessionDialog();
        return true;
      }
      return false;
    },
    () => {
      if (renameDialog.open) {
        closeRenameDialog();
        return true;
      }
      return false;
    },
    () => {
      if (exportDialog.sessionId) {
        closeExportDialog();
        return true;
      }
      return false;
    },
    () => {
      if (state.conflictDialogOpen) {
        state.conflictDialogOpen = false;
        return true;
      }
      return false;
    },
    () => {
      if (state.promoteDialogOpen) {
        state.promoteDialogOpen = false;
        return true;
      }
      return false;
    },
    () => {
      if (state.contextViewerOpen) {
        state.contextViewerOpen = false;
        return true;
      }
      return false;
    },
    () => {
      if (state.sessionDiffOverlayOpen) {
        state.sessionDiffOverlayOpen = false;
        return true;
      }
      return false;
    },
    () => {
      if (state.modelPickerOpen) {
        state.modelPickerOpen = false;
        return true;
      }
      return false;
    }
  ]
});

onMounted(() => {
  // Always re-classify tool calls on fresh load (classification logic may have changed)
  hydratedVersionBySessionId.clear();

  const storedSidebarWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
  if (storedSidebarWidth) {
    const parsedWidth = Number(storedSidebarWidth);
    if (!Number.isNaN(parsedWidth)) {
      state.sidebarWidth = clampSidebarWidth(parsedWidth);
    }
  }
  void hydrateRecents()
    .catch(() => undefined)
    .finally(() => {
      ensureDemoRecents();
    });
  void hydratePickerSessions().catch(() => undefined);
  if (isThemeCycleDemo) {
    void hydrateSettings()
      .catch(() => undefined)
      .finally(() => {
        startThemeCycleDemo();
      });
  } else {
    void hydrateSettings().catch(() => undefined);
  }
  void hydrateAuth().catch(() => undefined);
  void hydrateProviders().catch(() => undefined);
  shortcuts.bind();
});

const selectedModelLabel = computed(() => `${settings.defaultProvider}/${settings.defaultModel}`);

function formatCost(usd: number): string {
  if (usd < 0.01) return `${(usd * 100).toFixed(1)}¢`;
  if (usd < 1)    return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(1)}`;
}

const composerMetaLabel = computed(() => {
  const parts = [selectedModelLabel.value];
  const session = activeSession.value;
  if (session) {
    if (session.totalCost != null && session.totalCost > 0) {
      parts.push(formatCost(session.totalCost));
    }
    if (session.totalTokens) {
      const t = session.totalTokens;
      const total = (t.input ?? 0) + (t.output ?? 0) + (t.cacheRead ?? 0) + (t.cacheWrite ?? 0);
      if (total > 0) parts.push(`${total.toLocaleString()} tok`);
    }
  }
  return parts.join(' · ');
});

watch(
  () => currentProject.value?.path,
  (next) => {
    if (!next) return;
    void hydrateSessions().catch(() => undefined);
    void hydrateGitStatus().catch(() => undefined);
  }
);

watch(
  () => settings.themePreset,
  (next) => applyTheme(next)
);

watch(
  () => state.terminalOpen,
  (open) => {
    if (open) {
      openTerminalSocket();
      return;
    }
    closeTerminalSocket();
    terminal.status = 'closed';
    terminal.error = '';
  }
);

onUnmounted(() => {
  stopThemeCycleDemo();
  stopSidebarResize?.();
  closeTerminalSocket();
  for (const id of [...streamsBySessionId.keys()]) disconnectSessionStream(id);
  shortcuts.unbind();
});
</script>
