import { ref, readonly } from "vue";

export type FirstLaunchStep =
  | "welcome"
  | "permissions"
  | "signin"
  | "done";

export type UpdateState =
  | { phase: "idle" }
  | { phase: "available"; version: string; releaseNotes?: string }
  | { phase: "downloading"; percent: number }
  | { phase: "ready"; version: string }
  | { phase: "error"; message: string };

const glibDesktop = () => (window as any).glibDesktop as {
  getFirstLaunchState: () => Promise<{ isFirstLaunch: boolean; platform: string; appVersion: string }>;
  markWelcomeSeen: () => Promise<{ ok: boolean }>;
  checkFsPermission: () => Promise<{ platform: string; needsRationale: boolean }>;
  downloadUpdate: () => Promise<{ ok: boolean; error?: string }>;
  installUpdate: () => Promise<void>;
  openExternal: (url: string) => Promise<{ ok: boolean; error?: string }>;
  onUpdateAvailable: (cb: (info: { version: string; releaseNotes?: string }) => void) => () => void;
  onUpdateNotAvailable: (cb: () => void) => () => void;
  onUpdateProgress: (cb: (info: { percent: number }) => void) => () => void;
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => () => void;
  onUpdateError: (cb: (info: { message: string }) => void) => () => void;
} | undefined;

export function useFirstLaunch() {
  const isDesktop = typeof window !== "undefined" && !!(window as any).glibDesktop;

  const showFirstLaunch = ref(false);
  const step = ref<FirstLaunchStep>("welcome");
  const platform = ref<string>("unknown");
  const appVersion = ref<string>("");
  const needsFsPermissionRationale = ref(false);
  const updateState = ref<UpdateState>({ phase: "idle" });
  const unsubscribers: Array<() => void> = [];

  async function init() {
    if (!isDesktop) return;

    const api = glibDesktop()!;

    // Query first-launch state from main process
    const state = await api.getFirstLaunchState();
    platform.value = state.platform;
    appVersion.value = state.appVersion;

    if (state.isFirstLaunch) {
      // Check if we need to show FS permission rationale (Windows MSIX only)
      const fsState = await api.checkFsPermission();
      needsFsPermissionRationale.value = fsState.needsRationale;
      showFirstLaunch.value = true;
      step.value = "welcome";
    }

    // Subscribe to update events regardless of first-launch state
    unsubscribers.push(
      api.onUpdateAvailable((info) => {
        updateState.value = { phase: "available", version: info.version, releaseNotes: info.releaseNotes };
      }),
      api.onUpdateNotAvailable(() => {
        if (updateState.value.phase === "idle") {
          // silently stay idle
        }
      }),
      api.onUpdateProgress((info) => {
        updateState.value = { phase: "downloading", percent: info.percent };
      }),
      api.onUpdateDownloaded((info) => {
        updateState.value = { phase: "ready", version: info.version };
      }),
      api.onUpdateError((info) => {
        updateState.value = { phase: "error", message: info.message };
      })
    );
  }

  function cleanup() {
    for (const unsub of unsubscribers) unsub();
    unsubscribers.length = 0;
  }

  async function advanceStep() {
    if (step.value === "welcome") {
      step.value = needsFsPermissionRationale.value ? "permissions" : "signin";
    } else if (step.value === "permissions") {
      step.value = "signin";
    } else if (step.value === "signin") {
      await completeFirstLaunch();
    }
  }

  async function completeFirstLaunch() {
    if (isDesktop) {
      await glibDesktop()?.markWelcomeSeen();
    }
    showFirstLaunch.value = false;
    step.value = "done";
  }

  async function downloadUpdate() {
    if (!isDesktop) return;
    const result = await glibDesktop()!.downloadUpdate();
    if (!result.ok) {
      updateState.value = { phase: "error", message: result.error ?? "Download failed" };
    }
  }

  async function installUpdate() {
    if (!isDesktop) return;
    await glibDesktop()!.installUpdate();
  }

  function dismissUpdate() {
    updateState.value = { phase: "idle" };
  }

  async function openExternal(url: string) {
    if (isDesktop) {
      await glibDesktop()!.openExternal(url);
    } else {
      window.open(url, "_blank", "noopener");
    }
  }

  return {
    isDesktop,
    showFirstLaunch: readonly(showFirstLaunch),
    step: readonly(step),
    platform: readonly(platform),
    appVersion: readonly(appVersion),
    needsFsPermissionRationale: readonly(needsFsPermissionRationale),
    updateState: readonly(updateState),
    init,
    cleanup,
    advanceStep,
    completeFirstLaunch,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
    openExternal,
  };
}
