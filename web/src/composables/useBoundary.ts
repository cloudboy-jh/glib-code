// Boundary composable — drives the right rail's ephemeral/durable promote
// zone. State is push-driven: the server emits `boundary_changed` over the
// session SSE stream whenever the agent mutates files / promotes / discards.
// This composable hydrates once on session change via GET /boundary and then
// applies stream events reactively — no polling.
//
// Intentionally separate from rail visibility — this composable talks to
// GitTrix state; visibility is pure view state.

import { ref, watch } from 'vue';
import type { BoundaryPayload, BoundaryState } from '@glib-code/shared/events/agent';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:4273/api';

export type { BoundaryState };

export type PromoteEntry = {
  at: string;
  fromSha: string | null;
  toSha: string | null;
  fileCount: number;
};

// BoundaryData mirrors the server's BoundaryPayload exactly.
export type BoundaryData = BoundaryPayload;

function emptyBoundary(): BoundaryData {
  return {
    state: 'no_workspace',
    touchedFiles: [],
    touchedFileCount: 0,
    additions: 0,
    deletions: 0,
    baselineSha: null,
    lastPromotedAt: null,
    promoteHistory: [],
  };
}

export function useBoundary(options: {
  sessionId: () => string | null;
  projectPath: () => string | null;
  isSessionActive: () => boolean;
}) {
  const boundary = ref<BoundaryData>(emptyBoundary());
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Transient promote animation state — set by onPromoteComplete so incoming
  // stream/HTTP updates don't clobber the optimistic animation mid-flight.
  const promoteAnimating = ref(false);

  async function fetchBoundary(sessionId: string, projectPath: string) {
    const qs = `?projectPath=${encodeURIComponent(projectPath)}`;
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/boundary${qs}`);
    if (!res.ok) throw new Error(`boundary ${res.status}`);
    const d = (await res.json()) as BoundaryData;
    if (!promoteAnimating.value) {
      boundary.value = d;
    }
    error.value = null;
  }

  async function refresh() {
    const sessionId = options.sessionId();
    const projectPath = options.projectPath();
    if (!sessionId || !projectPath) return;
    loading.value = true;
    try {
      await fetchBoundary(sessionId, projectPath);
    } catch {
      error.value = 'boundary unavailable';
    } finally {
      loading.value = false;
    }
  }

  // Apply a `boundary_changed` event pushed over the session SSE stream. Ignored
  // when it targets a non-active session or during a promote animation.
  function applyBoundaryEvent(payload: BoundaryPayload & { sessionId?: string }) {
    if (payload.sessionId && payload.sessionId !== options.sessionId()) return;
    if (promoteAnimating.value) return;
    boundary.value = {
      state: payload.state,
      touchedFiles: payload.touchedFiles,
      touchedFileCount: payload.touchedFileCount,
      additions: payload.additions,
      deletions: payload.deletions,
      baselineSha: payload.baselineSha,
      lastPromotedAt: payload.lastPromotedAt,
      promoteHistory: payload.promoteHistory,
      alreadyPromoted: payload.alreadyPromoted,
    };
    error.value = null;
  }

  // Optimistic promote animation, then hydrate the settled state from the server
  // (the server also pushes a `promoted` boundary, but we refresh to be safe).
  async function onPromoteComplete() {
    promoteAnimating.value = true;
    const prev = boundary.value;
    boundary.value = { ...prev, state: 'promoting' };
    await new Promise((resolve) => setTimeout(resolve, 800));
    boundary.value = {
      ...prev,
      state: 'promoted',
      touchedFiles: [],
      touchedFileCount: 0,
      additions: 0,
      deletions: 0,
      lastPromotedAt: new Date().toISOString(),
    };
    await new Promise((resolve) => setTimeout(resolve, 1200));
    promoteAnimating.value = false;
    await refresh();
  }

  // Hydrate once whenever the active session changes.
  watch(
    () => options.sessionId(),
    (id) => {
      boundary.value = emptyBoundary();
      if (id && options.projectPath() && options.isSessionActive()) {
        void refresh();
      }
    },
    { immediate: true }
  );

  return { boundary, loading, error, refresh, applyBoundaryEvent, onPromoteComplete };
}
