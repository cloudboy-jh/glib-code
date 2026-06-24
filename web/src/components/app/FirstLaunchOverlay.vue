<template>
  <Transition name="fl-fade" appear>
    <div
      v-if="show"
      ref="overlayRef"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-background"
      role="dialog"
      aria-modal="true"
      :aria-label="stepAriaLabel"
      @keydown="onKeydown"
    >
      <!-- aria-live announcement for screen readers -->
      <div class="sr-only" aria-live="polite">{{ stepAriaLabel }}</div>

      <!-- Ambient glow, purely decorative -->
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div class="absolute -top-40 left-1/2 h-[37.5rem] w-[56.25rem] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div class="absolute bottom-0 right-0 h-[25rem] w-[37.5rem] translate-x-1/4 translate-y-1/4 rounded-full bg-primary/3 blur-3xl" />
      </div>

      <!-- Dismiss (close X) -->
      <button
        type="button"
        class="absolute right-5 top-5 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Skip setup"
        @click="$emit('dismiss')"
      >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      <!-- Step panels -->
      <Transition :name="panelTransition" mode="out-in">
        <!-- Welcome -->
        <div v-if="step === 'welcome'" key="welcome" class="fl-panel">
          <div class="mb-8 flex justify-center">
            <img :src="logoIconSrc" alt="glib-code" class="h-16 w-16 select-none" draggable="false" />
          </div>

          <div class="mb-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
            Welcome
          </div>
          <h1 class="mb-3 text-center text-3xl font-bold tracking-tight text-foreground">
            glib-code
          </h1>
          <p class="mb-2 text-center text-base text-muted-foreground leading-relaxed">
            Run AI coding agents on your git repos. Review every diff,
            then ship the changes you want.
          </p>
          <p v-if="appVersion" class="mb-8 text-center text-sm text-muted-foreground/60">
            v{{ appVersion }}
          </p>
          <div v-else class="mb-8" aria-hidden="true" />

          <div class="flex flex-col gap-3">
            <button
              type="button"
              class="fl-btn-primary"
              @click="$emit('advance')"
            >
              Get started
            </button>
          </div>
        </div>

        <!-- Permissions -->
        <div v-else-if="step === 'permissions'" key="permissions" class="fl-panel">
          <div class="mb-6 text-center">
            <div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border/80 bg-card">
              <svg class="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h2 class="text-xl font-semibold">Before we continue</h2>
            <p class="mt-1.5 text-sm text-muted-foreground">
              Windows will ask for a couple of permissions. Here's what they're for.
            </p>
          </div>

          <div class="mb-6 flex flex-col gap-3">
            <PermissionCard
              icon="folder"
              title="File system access"
              :rationale="fsPermissionCopy"
              when="Once, when you first open a project folder"
            />
            <PermissionCard
              icon="network"
              title="Network access"
              rationale="Used to reach AI provider APIs and check for app updates. Your code never leaves your machine unless you explicitly send it to an AI."
              when="Background, while the app is running"
            />
          </div>

          <div class="flex gap-3">
            <button type="button" class="fl-btn-back" @click="$emit('back')">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 12H5M12l-7 7 7 7" transform="rotate(180 12 12)" />
                <path d="m12 19-7-7 7-7" />
              </svg>
              Back
            </button>
            <button type="button" class="fl-btn-primary flex-1" @click="$emit('advance')">
              Continue
            </button>
          </div>
        </div>

        <!-- Sign-in -->
        <div v-else-if="step === 'signin'" key="signin" class="fl-panel">
          <div class="mb-6 text-center">
            <div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border/80 bg-card">
              <svg class="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="7.5" cy="15.5" r="5.5" />
                <path d="M21 2l-9.6 9.6M15.5 7.5l3 3" />
              </svg>
            </div>
            <h2 class="text-xl font-semibold">Connect your AI provider</h2>
            <p class="mt-1.5 text-sm text-muted-foreground">
              Add a key from OpenAI, Anthropic, Google, or another supported provider to start running sessions. Connect GitHub to back up sessions and open PRs.
            </p>
          </div>

          <!-- Readiness warnings -->
          <div v-if="readinessWarnings.length" class="mb-4 flex flex-col gap-2">
            <div v-for="warning in readinessWarnings" :key="warning" class="fl-warning">
              <svg class="h-4 w-4 shrink-0 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{{ warning }}</span>
            </div>
          </div>

          <div class="mb-6 flex flex-col gap-2.5">
            <!-- API key option, clickable -->
            <button type="button" class="fl-option-card fl-option-clickable" @click="$emit('openSettings', 'Models')">
              <div class="flex items-start gap-3">
                <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/50">
                  <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1 text-left">
                  <div class="text-sm font-medium">Add an API key</div>
                  <div class="text-xs text-muted-foreground">Open Settings to paste a key from OpenAI, Anthropic, Google, and others. Stored locally, never sent to our servers.</div>
                </div>
                <svg class="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </button>

            <!-- GitHub option, clickable -->
            <button type="button" class="fl-option-card fl-option-clickable" @click="$emit('openSettings', 'Git')">
              <div class="flex items-start gap-3">
                <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/50">
                  <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.09.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1 text-left">
                  <div class="text-sm font-medium">Connect GitHub</div>
                  <div class="text-xs text-muted-foreground">Open Settings to sign in with GitHub. Backs up your sessions and lets you open pull requests.</div>
                </div>
                <svg class="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </button>
          </div>

          <p class="mb-5 text-center text-xs text-muted-foreground/60">
            You can always add or change providers in Settings later.
          </p>

          <div class="flex gap-3">
            <button type="button" class="fl-btn-back" @click="$emit('back')">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 19-7-7 7-7" />
              </svg>
              Back
            </button>
            <button type="button" class="fl-btn-ghost flex-1" @click="$emit('skip')">
              Skip for now
            </button>
          </div>
        </div>
      </Transition>

      <!-- Step dots -->
      <div v-if="totalSteps > 1" class="absolute bottom-10 left-1/2 flex -translate-x-1/2 gap-2" aria-hidden="true">
        <div
          v-for="i in totalSteps"
          :key="i"
          :class="[
            'h-1.5 rounded-full transition-all duration-300',
            i === currentStepIndex ? 'w-6 bg-primary' : 'w-1.5 bg-border/70'
          ]"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { FirstLaunchStep } from "../../composables/useFirstLaunch";
import PermissionCard from "./PermissionCard.vue";

type SettingsTab = "Models" | "Git" | "Integrations" | "Appearance";

const props = defineProps<{
  show: boolean;
  step: FirstLaunchStep;
  appVersion: string;
  needsFsPermissionRationale: boolean;
  logoIconSrc: string;
  gitReady?: boolean;
  piReady?: boolean;
  readinessLoaded?: boolean;
}>();

const emit = defineEmits<{
  advance: [];
  back: [];
  skip: [];
  dismiss: [];
  openSettings: [tab: SettingsTab];
}>();

const overlayRef = ref<HTMLElement | null>(null);

const steps: FirstLaunchStep[] = computed(() => {
  const base: FirstLaunchStep[] = ["welcome"];
  if (props.needsFsPermissionRationale) base.push("permissions");
  base.push("signin");
  return base;
}).value;

const totalSteps = computed(() => steps.length);
const currentStepIndex = computed(() => {
  const idx = steps.indexOf(props.step);
  return idx === -1 ? 1 : idx + 1;
});

const panelTransition = computed(() => "fl-slide");

const stepAriaLabel = computed(() => {
  if (props.step === "welcome") return "Welcome to glib-code";
  if (props.step === "permissions") return "Permission explanations";
  if (props.step === "signin") return "Connect your AI provider";
  return "Setup complete";
});

const fsPermissionCopy = computed(() =>
  props.needsFsPermissionRationale
    ? "glib-code reads your git repositories and writes files on your behalf when an AI agent makes edits. Windows restricts this to apps you explicitly trust. Click Allow when the prompt appears."
    : "glib-code reads your git repositories and writes files on your behalf when an AI agent makes edits."
);

const readinessWarnings = computed<string[]>(() => {
  if (!props.readinessLoaded) return [];
  const warnings: string[] = [];
  if (!props.gitReady) warnings.push("git not found. Diff and session features require git.");
  if (!props.piReady) warnings.push("pi CLI not found. Agent sessions won't work until it's installed.");
  return warnings;
});

// Auto-focus the first focusable element when a step appears.
watch(
  () => props.step,
  () => {
    nextTick(() => {
      const root = overlayRef.value;
      if (!root) return;
      const focusable = root.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    });
  }
);

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("dismiss");
    return;
  }

  if (event.key === "Enter" && (props.step === "welcome" || props.step === "permissions")) {
    // Only auto-advance on Enter for steps with a single primary action.
    // The signin step has option cards and a skip button; Enter should not
    // pick one for the user.
    const target = event.target as HTMLElement;
    if (target.tagName === "BUTTON") {
      event.preventDefault();
      emit("advance");
      return;
    }
  }

  // Focus trap: keep Tab within the overlay.
  if (event.key === "Tab") {
    const root = overlayRef.value;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
}
</script>

<style scoped>
/* Screen-reader-only (visually hidden, announced to AT) */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Panel base */
.fl-panel {
  @apply relative z-10 w-full max-w-md rounded-2xl border border-border/60 bg-card/80 p-8 shadow-2xl shadow-black/40;
  backdrop-filter: blur(12px);
}

/* Buttons */
.fl-btn-primary {
  @apply h-11 w-full rounded-xl bg-primary/90 px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring;
}
.fl-btn-back {
  @apply inline-flex h-11 items-center gap-1.5 rounded-xl border border-border/70 bg-background/40 px-4 text-sm text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring;
}
.fl-btn-back:hover {
  background: hsl(var(--accent));
  color: hsl(var(--foreground));
}
.fl-btn-ghost {
  @apply h-11 w-full rounded-xl px-5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring;
}

/* Option cards */
.fl-option-card {
  @apply rounded-xl border border-border/70 bg-background/40 px-4 py-3.5 w-full text-left transition-colors;
}

/* Readiness warning */
.fl-warning {
  @apply flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400;
}
.fl-option-clickable {
  @apply cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring;
}
.fl-option-clickable:hover {
  border-color: hsl(var(--border));
  background: hsl(var(--background) / 0.6);
}

/* Overlay fade */
.fl-fade-enter-active,
.fl-fade-leave-active {
  transition: opacity 0.35s ease;
}
.fl-fade-enter-from,
.fl-fade-leave-to {
  opacity: 0;
}

/* Panel slide transition between steps */
.fl-slide-enter-active,
.fl-slide-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fl-slide-enter-from {
  opacity: 0;
  transform: translateX(1.5rem);
}
.fl-slide-leave-to {
  opacity: 0;
  transform: translateX(-1.5rem);
}
</style>
