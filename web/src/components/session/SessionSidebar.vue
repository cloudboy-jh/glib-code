<template>
  <aside class="flex h-full flex-col bg-card/95 text-foreground">
    <div :class="['flex h-full flex-col', collapsed ? 'px-2 py-3' : 'px-3 py-3']">
      <div class="relative flex h-9 items-center justify-center">
        <div v-if="!collapsed" class="min-w-0">
          <div class="flex min-w-0 items-center justify-center rounded-lg px-1.5 py-1 text-muted-foreground transition-colors hover:text-foreground">
            <div
              v-if="logoWordmarkSrc"
              class="logo-wordmark h-4 w-[112px] shrink-0"
              :style="{ '--logo-url': `url(${logoWordmarkSrc})` }"
              role="img"
              aria-label="glib-code"
            />
            <div v-else class="truncate text-sm font-medium tracking-tight text-foreground">glib-code</div>
          </div>
        </div>

        <div v-else class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground" aria-label="glib-code">
          <div v-if="logoIconSrc" class="logo-icon h-5 w-5" :style="{ '--logo-url': `url(${logoIconSrc})` }" role="img" aria-label="glib-code icon" />
          <span v-else class="text-base font-semibold leading-none">g</span>
        </div>

        <button
          type="button"
          :class="['inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground', 'absolute right-0 h-8 w-8']"
          @click="$emit('toggleCollapse')"
        >
          {{ collapsed ? '›' : '‹' }}
        </button>
      </div>

      <button
        v-if="!collapsed"
        type="button"
        :disabled="disabled"
        class="mt-3 mb-3 flex h-10 items-center gap-2 rounded-xl border border-border/80 bg-background/70 px-3 text-left text-sm text-muted-foreground shadow-sm/5 transition-colors hover:bg-accent/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Search class="sidebar-icon" />
        <span class="flex-1">Search sessions</span>
        <span class="rounded-md border border-border/70 bg-muted/70 px-1.5 py-0.5 text-[11px] text-muted-foreground">⌘K</span>
      </button>

      <div v-else class="mt-3 mb-3 flex justify-center">
        <button
          type="button"
          :disabled="disabled"
          class="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-background/70 text-muted-foreground/80 shadow-sm/5 transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Search class="sidebar-icon" />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-auto">
        <template v-if="collapsed">
          <div class="space-y-1">
            <button
              v-for="s in sessions"
              :key="s.id"
              type="button"
              :disabled="disabled"
              :class="[
                'mx-auto flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                s.id === activeId ? 'bg-accent text-foreground shadow-sm/5' : 'text-foreground/80 hover:bg-accent/70'
              ]"
              @click="$emit('select', s.id)"
            >
              <span class="h-2 w-2 rounded-full" :class="s.status === 'Working' ? 'bg-sky-400' : 'bg-emerald-400'" />
            </button>
          </div>
        </template>

        <template v-else>
          <div v-for="repo in grouped" :key="repo.repo" class="mb-2.5">
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground/80 transition-colors hover:bg-accent/45 hover:text-foreground"
              @click="toggleRepo(repo.repo)"
            >
              <ChevronRight v-if="isRepoCollapsed(repo.repo)" class="tree-chevron" />
              <ChevronDown v-else class="tree-chevron" />
              <span class="truncate">{{ repo.repo }}</span>
            </button>

            <div v-if="!isRepoCollapsed(repo.repo)" class="mt-1 space-y-1.5">
              <div v-for="project in repo.projects" :key="project.key">
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground"
                  @click="toggleProject(project.key)"
                >
                  <ChevronRight v-if="isProjectCollapsed(project.key)" class="tree-chevron" />
                  <ChevronDown v-else class="tree-chevron" />
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-foreground/90">{{ project.name }}</div>
                    <div v-if="project.path" class="truncate text-[10px] text-muted-foreground/70">{{ project.path }}</div>
                  </div>
                </button>

                <div v-if="!isProjectCollapsed(project.key)" class="mt-1 space-y-1">
                  <button
                    v-for="s in project.rows"
                    :key="s.id"
                    type="button"
                    :disabled="disabled"
                    :class="[
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      s.id === activeId ? 'bg-accent text-foreground shadow-sm/5' : 'text-foreground/92 hover:bg-accent/70'
                    ]"
                    @click="$emit('select', s.id)"
                  >
                    <span class="h-2 w-2 shrink-0 rounded-full" :class="s.status === 'Working' ? 'bg-sky-400' : 'bg-emerald-400'" />
                    <span class="min-w-0 flex-1 truncate text-sm leading-none">{{ s.title }}</span>
                    <span class="shrink-0 text-xs text-muted-foreground/80">{{ s.time }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div class="mt-2 border-t border-border/70 pt-2">
        <button
          type="button"
          :class="[
            'flex items-center rounded-lg text-sm transition-colors',
            collapsed ? 'mx-auto mb-0.5 h-9 w-9 justify-center text-muted-foreground/70 hover:bg-accent hover:text-foreground' : 'mb-0.5 h-9 w-full gap-2 px-3 text-muted-foreground/75 hover:bg-accent hover:text-foreground'
          ]"
          @click="$emit('goHome')"
        >
          <House class="sidebar-icon" />
          <span v-if="!collapsed">Home</span>
        </button>
        <button
          type="button"
          :disabled="disabled"
          :class="[
            'flex items-center rounded-lg text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            collapsed ? 'mx-auto h-9 w-9 justify-center text-muted-foreground/70 hover:bg-accent hover:text-foreground' : 'mb-0.5 h-9 w-full gap-2 px-3 text-muted-foreground/75 hover:bg-accent hover:text-foreground'
          ]"
          @click="$emit('new')"
        >
          <Plus class="sidebar-icon" />
          <span v-if="!collapsed">New session</span>
        </button>
        <button
          type="button"
          :class="[
            'flex items-center rounded-lg text-sm transition-colors',
            collapsed ? 'mx-auto h-9 w-9 justify-center text-muted-foreground/70 hover:bg-accent hover:text-foreground' : 'h-9 w-full gap-2 px-3 text-muted-foreground/75 hover:bg-accent hover:text-foreground'
          ]"
          @click="$emit('openSettings')"
        >
          <Settings2 class="sidebar-icon" />
          <span v-if="!collapsed">Settings</span>
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronDown, ChevronRight, House, Plus, Search, Settings2 } from 'lucide-vue-next';

type SessionRow = {
  id: string;
  title: string;
  time: string;
  status: 'Working' | 'Completed';
  repo: string;
  project: string;
  projectPath: string;
};

const props = withDefaults(
  defineProps<{
    sessions: SessionRow[];
    activeId: string;
    collapsed?: boolean;
    logoWordmarkSrc?: string;
    logoIconSrc?: string;
    disabled?: boolean;
  }>(),
  { collapsed: false, disabled: false }
);

defineEmits<{ select: [id: string]; new: []; openSettings: []; toggleCollapse: []; goHome: [] }>();

const collapsedRepos = ref<Set<string>>(new Set());
const collapsedProjects = ref<Set<string>>(new Set());

const grouped = computed(() => {
  const repoMap = new Map<
    string,
    {
      repo: string;
      projects: Array<{ key: string; name: string; path: string; rows: SessionRow[] }>;
    }
  >();

  for (const session of props.sessions) {
    const repoName = normalizeRepoLabel(session.repo);
    const projectName = normalizeProjectLabel(session.project, session.projectPath);
    const projectPath = normalizeProjectPath(session.projectPath, projectName);
    const projectKey = `${repoName}::${projectPath || projectName}`;

    let repoEntry = repoMap.get(repoName);
    if (!repoEntry) {
      repoEntry = { repo: repoName, projects: [] };
      repoMap.set(repoName, repoEntry);
    }

    let projectEntry = repoEntry.projects.find((project) => project.key === projectKey);
    if (!projectEntry) {
      projectEntry = { key: projectKey, name: projectName, path: projectPath, rows: [] };
      repoEntry.projects.push(projectEntry);
    }

    projectEntry.rows.push(session);
  }

  return Array.from(repoMap.values());
});

function isRepoCollapsed(repo: string) {
  return collapsedRepos.value.has(repo);
}

function toggleRepo(repo: string) {
  const next = new Set(collapsedRepos.value);
  if (next.has(repo)) next.delete(repo);
  else next.add(repo);
  collapsedRepos.value = next;
}

function isProjectCollapsed(projectKey: string) {
  return collapsedProjects.value.has(projectKey);
}

function toggleProject(projectKey: string) {
  const next = new Set(collapsedProjects.value);
  if (next.has(projectKey)) next.delete(projectKey);
  else next.add(projectKey);
  collapsedProjects.value = next;
}

function normalizeRepoLabel(repo: string) {
  const normalized = repo.replace(/\\/g, '/').trim();
  if (!normalized) return 'Repository';
  return normalized.split('/').filter(Boolean).pop() ?? normalized;
}

function normalizeProjectLabel(project: string, projectPath: string) {
  const fromProject = project.replace(/\\/g, '/').trim();
  if (fromProject) return fromProject.split('/').filter(Boolean).pop() ?? fromProject;

  const fromPath = projectPath.replace(/\\/g, '/').trim();
  if (fromPath) return fromPath.split('/').filter(Boolean).pop() ?? fromPath;

  return 'Project';
}

function normalizeProjectPath(projectPath: string, projectName: string) {
  const normalized = projectPath.replace(/\\/g, '/').trim();
  if (!normalized) return '';

  const segments = normalized.split('/').filter(Boolean);
  if (!segments.length) return '';

  const last = segments[segments.length - 1];
  const parentSegments = last === projectName ? segments.slice(0, -1) : segments;
  if (!parentSegments.length) return '';

  if (parentSegments.length <= 2) return parentSegments.join('/');
  return `…/${parentSegments.slice(-2).join('/')}`;
}
</script>

<style scoped>
.logo-wordmark,
.logo-icon {
  background-color: hsl(var(--primary));
  -webkit-mask-image: var(--logo-url);
  mask-image: var(--logo-url);
  -webkit-mask-mode: luminance;
  mask-mode: luminance;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}

.sidebar-icon {
  width: 16px;
  height: 16px;
  stroke-width: 2.2;
}

.tree-chevron {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  stroke-width: 2.3;
}
</style>
