<template>
  <div class="h-screen w-screen overflow-hidden bg-background text-foreground">
    <div class="grid h-full grid-cols-[auto_1fr]">
      <SessionSidebar
        :sessions="sessions"
        :active-id="state.activeSessionId"
        :collapsed="state.sidebarCollapsed"
        @select="state.activeSessionId = $event"
        @new="createSession"
        @open-settings="state.settingsOpen = true"
        @toggle-collapse="state.sidebarCollapsed = !state.sidebarCollapsed"
      />

      <section class="grid h-full grid-rows-[54px_1fr]">
        <SessionHeader
          :title="activeSession?.title ?? 'Untitled session'"
          :project="activeProject.name"
          :branch="activeProject.branch"
          :model="settings.defaultModel"
          @switch-mode="toggleMode"
          @open-model="state.settingsOpen = true"
          @git-action="noop"
          @menu="noop"
        />

        <main class="min-h-0">
          <template v-if="state.mode === 'session'">
            <div class="grid h-full grid-rows-[1fr_auto]">
              <Timeline :entries="timeline" />
              <Composer :context="contextLabel" :prompt="forms.prompt" @update:prompt="forms.prompt = $event" @trigger="onComposerTrigger" @send="sendPrompt" />
            </div>
          </template>

          <template v-else>
            <DiffWorkbench
              :projects="diffProjects"
              :selected-project-id="state.selectedProjectId"
              :selected-commit-id="state.selectedCommitId"
              :selected-file-path="state.selectedFilePath"
              :diff-style="state.diffStyle"
              @update:selected-project-id="onDiffProjectChange"
              @update:selected-commit-id="onDiffCommitChange"
              @update:selected-file-path="state.selectedFilePath = $event"
              @update:diff-style="state.diffStyle = $event"
            />
          </template>
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
      @close="state.settingsOpen = false"
      @update:theme="settings.themePreset = $event"
      @update:model="settings.defaultModel = $event"
      @update:keybinding="updateKeybinding"
    />

    <TerminalDrawer
      v-if="state.terminalOpen"
      :input="forms.terminal"
      :output="terminalOutput"
      @close="state.terminalOpen = false"
      @run="runTerminal"
      @update:input="forms.terminal = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, watch } from 'vue';
import CommandPalette from './components/app/CommandPalette.vue';
import TerminalDrawer from './components/app/TerminalDrawer.vue';
import SettingsModal from './components/settings/SettingsModal.vue';
import Composer from './components/session/Composer.vue';
import SessionHeader from './components/session/SessionHeader.vue';
import SessionSidebar from './components/session/SessionSidebar.vue';
import Timeline from './components/session/Timeline.vue';
import DiffWorkbench from './components/diff/DiffWorkbench.vue';
import { applyTheme } from './lib/theme';

type Session = {
  id: string;
  title: string;
  time: string;
  section: 'Now' | 'Today' | 'Yesterday' | 'Older';
  status: 'Working' | 'Completed';
};

const activeProject = reactive({
  id: 'proj-1',
  name: 'cloudboy-jh/glib-code',
  branch: 'main'
});

const sessions = reactive<Session[]>([
  { id: 's1', title: 'Refactor auth middleware flow', time: '1m ago', section: 'Now', status: 'Working' },
  { id: 's2', title: 'Theme selector parity pass', time: '19m ago', section: 'Today', status: 'Working' },
  { id: 's3', title: 'Command palette keymap cleanup', time: 'Yesterday', section: 'Yesterday', status: 'Completed' },
  { id: 's4', title: 'Inline diff renderer polish', time: 'Last week', section: 'Older', status: 'Completed' }
]);

const timeline = reactive([
  { id: 'e1', kind: 'User', text: 'I need settings to match t3 rhythm and spacing.', time: '7:31 PM', level: 'info' as const },
  { id: 'e2', kind: 'Work log', text: 'Edited SessionSidebar, SessionHeader, and CommandPalette structure.', time: '7:32 PM', level: 'info' as const },
  { id: 'e3', kind: 'Error', text: 'Timed out waiting for initialize.', time: '7:33 PM', level: 'error' as const }
]);

const diffProjects = reactive([
  {
    id: 'proj-1',
    name: 'cloudboy-jh/glib-code',
    commits: [
      {
        id: 'c1',
        label: 'b8305af · parity baseline sync',
        files: [
          {
            path: 'web/src/components/session/SessionSidebar.vue',
            stats: '+124 -21',
            diff: `diff --git a/web/src/components/session/SessionSidebar.vue b/web/src/components/session/SessionSidebar.vue\nindex 2e0a11..bf292f 100644\n--- a/web/src/components/session/SessionSidebar.vue\n+++ b/web/src/components/session/SessionSidebar.vue\n@@ -1,6 +1,9 @@\n-<aside class=\"box side\">\n+<aside class=\"border-r border-border/80 bg-card/60\">\n+  <div class=\"flex h-full flex-col p-3\">\n+    <div class=\"mb-3 flex items-center gap-2\">\n+      ...\n+    </div>\n`
          },
          {
            path: 'web/src/components/app/CommandPalette.vue',
            stats: '+68 -25',
            diff: `diff --git a/web/src/components/app/CommandPalette.vue b/web/src/components/app/CommandPalette.vue\nindex c1ebca..1eacdf 100644\n--- a/web/src/components/app/CommandPalette.vue\n+++ b/web/src/components/app/CommandPalette.vue\n@@ -1,6 +1,6 @@\n-<div class=\"modal\">\n+<div class=\"fixed inset-0 z-50 grid place-items-start\">\n ...\n`
          }
        ]
      },
      {
        id: 'c2',
        label: '3dc19aa · settings panel restyle',
        files: [
          {
            path: 'web/src/components/settings/SettingsModal.vue',
            stats: '+95 -38',
            diff: `diff --git a/web/src/components/settings/SettingsModal.vue b/web/src/components/settings/SettingsModal.vue\n@@ -1,7 +1,9 @@\n-<div class=\"modal\">\n+<div class=\"fixed inset-0 z-50 grid place-items-center bg-black/60\">\n+  <div class=\"max-w-[760px] rounded-xl border\">\n ...\n`
          }
        ]
      }
    ]
  }
]);

const settings = reactive({
  themePreset: 'tokyo-night',
  defaultModel: 'gpt-5.3-codex'
});

const keybindings = reactive([
  { command: 'palette.toggle', key: 'Ctrl+K' },
  { command: 'terminal.toggle', key: 'Ctrl+J' },
  { command: 'mode.diff', key: 'D' },
  { command: 'mode.session', key: 'S' }
]);

const state = reactive({
  mode: 'session' as 'session' | 'diff',
  activeSessionId: 's1',
  sidebarCollapsed: false,
  paletteOpen: false,
  paletteIndex: 0,
  settingsOpen: false,
  terminalOpen: false,
  selectedProjectId: 'proj-1',
  selectedCommitId: 'c1',
  selectedFilePath: 'web/src/components/session/SessionSidebar.vue',
  diffStyle: 'split' as 'split' | 'unified'
});

const forms = reactive({
  prompt: '',
  palette: '',
  terminal: ''
});

const paletteCommands = [
  { id: 'mode.diff', label: 'Switch to Diff mode' },
  { id: 'mode.session', label: 'Switch to Session mode' },
  { id: 'settings.open', label: 'Open settings' },
  { id: 'terminal.toggle', label: 'Toggle terminal drawer' },
  { id: 'session.new', label: 'Create new session' }
];

const activeSession = computed(() => sessions.find((s) => s.id === state.activeSessionId));

const commitsForProject = computed(() => {
  const project = diffProjects.find((p) => p.id === state.selectedProjectId);
  return project?.commits ?? [];
});

const filesForCommit = computed(() => {
  const commit = commitsForProject.value.find((c) => c.id === state.selectedCommitId);
  return commit?.files ?? [];
});

const contextLabel = computed(() => {
  if (state.mode !== 'diff') return '2 files · 1 commit from b8305af';
  return `${filesForCommit.value.length} files · ${state.selectedCommitId}`;
});

const filteredPaletteCommands = computed(() => {
  const q = forms.palette.trim().toLowerCase();
  if (!q) return paletteCommands;
  return paletteCommands.filter((c) => c.label.toLowerCase().includes(q) || c.id.includes(q));
});

const terminalOutput = computed(() => (forms.terminal ? `$ ${forms.terminal}\n\n(simulated output)` : 'No commands run yet.'));

function noop() {}

function toggleMode() {
  state.mode = state.mode === 'session' ? 'diff' : 'session';
}

function createSession() {
  const id = `s${sessions.length + 1}`;
  sessions.unshift({ id, title: 'New session', time: 'now', section: 'Now', status: 'Working' });
  state.activeSessionId = id;
  state.mode = 'session';
}

function sendPrompt() {
  if (!forms.prompt.trim()) return;
  timeline.push({ id: `e${timeline.length + 1}`, kind: 'User', text: forms.prompt, time: 'now', level: 'info' });
  forms.prompt = '';
}

function onComposerTrigger(kind: '/' | '@' | '#') {
  forms.prompt = `${forms.prompt}${kind}`;
}

function onDiffProjectChange(projectId: string) {
  state.selectedProjectId = projectId;
  const firstCommit = commitsForProject.value[0];
  state.selectedCommitId = firstCommit?.id ?? '';
  state.selectedFilePath = firstCommit?.files[0]?.path ?? '';
}

function onDiffCommitChange(commitId: string) {
  state.selectedCommitId = commitId;
  const selectedCommit = commitsForProject.value.find((c) => c.id === commitId);
  state.selectedFilePath = selectedCommit?.files[0]?.path ?? '';
}

function runTerminal() {
  if (!forms.terminal.trim()) return;
  forms.terminal = `${forms.terminal}`;
}

function runPalette(id: string) {
  if (id === 'mode.diff') state.mode = 'diff';
  if (id === 'mode.session') state.mode = 'session';
  if (id === 'settings.open') state.settingsOpen = true;
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

function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    state.paletteOpen = !state.paletteOpen;
    if (state.paletteOpen) {
      forms.palette = '';
      state.paletteIndex = 0;
    }
    return;
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
    event.preventDefault();
    state.terminalOpen = !state.terminalOpen;
    return;
  }

  if (event.key === 'Escape') {
    if (state.paletteOpen) {
      state.paletteOpen = false;
      return;
    }
    if (state.settingsOpen) {
      state.settingsOpen = false;
      return;
    }
    if (state.terminalOpen) {
      state.terminalOpen = false;
    }
    return;
  }

  if (!state.paletteOpen) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    state.paletteIndex = Math.min(state.paletteIndex + 1, Math.max(filteredPaletteCommands.value.length - 1, 0));
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    state.paletteIndex = Math.max(state.paletteIndex - 1, 0);
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    const cmd = filteredPaletteCommands.value[state.paletteIndex];
    if (cmd) runPalette(cmd.id);
  }
}

onMounted(() => {
  applyTheme(settings.themePreset);
  window.addEventListener('keydown', onGlobalKeydown);
});

watch(
  () => settings.themePreset,
  (next) => applyTheme(next)
);

onUnmounted(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
});
</script>
