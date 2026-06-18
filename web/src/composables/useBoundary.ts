// Boundary composable — drives the right rail's ephemeral/durable zone and
// task-state panel. Polls /boundary and /plan on a 12s interval while the
// session is active, with an immediate fetch on sessionId change.
//
// Intentionally separate from rail visibility — this composable talks to
// GitTrix state; visibility is pure view state.

import { ref, watch, onUnmounted, computed } from 'vue';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:4273/api';
const POLL_INTERVAL_MS = 12_000;
// Poll faster when agent is running so the file list updates promptly
const POLL_INTERVAL_RUNNING_MS = 5_000;

export type BoundaryState = 'clean' | 'pending' | 'no_workspace' | 'promoting' | 'promoted';

export type BoundaryData = {
  state: BoundaryState;
  touchedFiles: string[];
  touchedFileCount: number;
  baselineSha: string | null;
  lastPromotedAt: string | null;
  alreadyPromoted?: boolean;
};

export type PlanData = {
  status: 'idle' | 'running' | 'done' | 'error' | 'aborted';
  isRunning: boolean;
  currentTurnId: string | null;
  turnStartedAt: string | null;
  turnCount: number;
  toolCallCount: number;
  recentTools: string[];
};

export function useBoundary(options: {
  sessionId: () => string | null;
  projectPath: () => string | null;
  isSessionActive: () => boolean;
}) {
  const boundary = ref<BoundaryData>({
    state: 'no_workspace',
    touchedFiles: [],
    touchedFileCount: 0,
    baselineSha: null,
    lastPromotedAt: null,
  });

  const plan = ref<PlanData>({
    status: 'idle',
    isRunning: false,
    currentTurnId: null,
    turnStartedAt: null,
    turnCount: 0,
    toolCallCount: 0,
    recentTools: [],
  });

  const loading = ref(false);
  const error = ref<string | null>(null);

  // Transient promote animation state — set by the caller (App.vue) when
  // the promote dialog resolves, not by polling.
  const promoteAnimating = ref(false);

  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  async function fetchBoundary(sessionId: string, projectPath: string) {
    const qs = `?projectPath=${encodeURIComponent(projectPath)}`;
    const [boundaryRes, planRes] = await Promise.allSettled([
      fetch(`${API_BASE}/sessions/${sessionId}/boundary${qs}`).then(r => r.ok ? r.json() : Promise.reject(r.status)),
      fetch(`${API_BASE}/sessions/${sessionId}/plan${qs}`).then(r => r.ok ? r.json() : Promise.reject(r.status)),
    ]);

    if (boundaryRes.status === 'fulfilled') {
      const d = boundaryRes.value as BoundaryData;
      // Don't clobber an in-progress promote animation
      if (!promoteAnimating.value) {
        boundary.value = d;
      }
      error.value = null;
    } else {
      error.value = 'boundary unavailable';
    }

    if (planRes.status === 'fulfilled') {
      plan.value = planRes.value as PlanData;
    }
  }

  async function poll() {
    clearTimer();
    const sessionId = options.sessionId();
    const projectPath = options.projectPath();
    if (!sessionId || !projectPath || !options.isSessionActive()) return;

    try {
      await fetchBoundary(sessionId, projectPath);
    } catch {
      // best-effort; errors are soft-surfaced via error ref
    } finally {
      // Schedule next poll — faster while agent is running
      const interval = plan.value.isRunning ? POLL_INTERVAL_RUNNING_MS : POLL_INTERVAL_MS;
      pollTimer = setTimeout(() => { void poll(); }, interval);
    }
  }

  async function refresh() {
    const sessionId = options.sessionId();
    const projectPath = options.projectPath();
    if (!sessionId || !projectPath) return;
    loading.value = true;
    try {
      await fetchBoundary(sessionId, projectPath);
    } finally {
      loading.value = false;
    }
  }

  // Trigger a promote animation then refresh to settled state
  async function onPromoteComplete() {
    promoteAnimating.value = true;
    boundary.value = { ...boundary.value, state: 'promoting' };
    await new Promise(resolve => setTimeout(resolve, 800));
    boundary.value = { ...boundary.value, state: 'promoted', touchedFiles: [], touchedFileCount: 0 };
    await new Promise(resolve => setTimeout(resolve, 1200));
    promoteAnimating.value = false;
    // Refresh to get the real clean state from the server
    await refresh();
    // Restart the poll cycle
    void poll();
  }

  // Re-fetch immediately whenever the active session changes
  watch(
    () => options.sessionId(),
    (id) => {
      clearTimer();
      boundary.value = { state: 'no_workspace', touchedFiles: [], touchedFileCount: 0, baselineSha: null, lastPromotedAt: null };
      plan.value = { status: 'idle', isRunning: false, currentTurnId: null, turnStartedAt: null, turnCount: 0, toolCallCount: 0, recentTools: [] };
      if (id && options.projectPath() && options.isSessionActive()) {
        void poll();
      }
    },
    { immediate: true }
  );

  onUnmounted(() => { clearTimer(); });

  return { boundary, plan, loading, error, refresh, onPromoteComplete };
}
