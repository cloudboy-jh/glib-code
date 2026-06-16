<template>
  <Transition name="fl-fade" appear>
    <div
      v-if="show"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-background"
      role="dialog"
      aria-modal="true"
      :aria-label="stepAriaLabel"
    >
      <!-- Ambient glow — purely decorative -->
      <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div class="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        <div class="absolute bottom-0 right-0 h-[400px] w-[600px] translate-x-1/4 translate-y-1/4 rounded-full bg-primary/3 blur-3xl" />
      </div>

      <!-- Step panels -->
      <Transition :name="panelTransition" mode="out-in">
        <!-- ── Welcome ─────────────────────────────────────────────── -->
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
            An AI coding agent that lives in your terminal's neighbourhood —
            review diffs, run agent sessions, ship changes.
          </p>
          <p class="mb-8 text-center text-sm text-muted-foreground/60">
            v{{ appVersion }}
          </p>

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

        <!-- ── Permissions ─────────────────────────────────────────── -->
        <div v-else-if="step === 'permissions'" key="permissions" class="fl-panel">
          <div class="mb-6 text-center">
            <div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border/80 bg-card">
              <svg class="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                <path d="M16 3v4M8 3v4M3 11h18" />
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

          <div class="flex flex-col gap-3">
            <button type="button" class="fl-btn-primary" @click="$emit('advance')">
              Got it — continue
            </button>
          </div>
        </div>

        <!-- ── Sign-in ─────────────────────────────────────────────── -->
        <div v-else-if="step === 'signin'" key="signin" class="fl-panel">
          <div class="mb-6 text-center">
            <div class="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border/80 bg-card">
              <!-- Key icon -->
              <svg class="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="7.5" cy="15.5" r="5.5" />
                <path d="M21 2l-9.6 9.6M15.5 7.5l3 3" />
              </svg>
            </div>
            <h2 class="text-xl font-semibold">Connect your AI provider</h2>
            <p class="mt-1.5 text-sm text-muted-foreground">
              glib-code works with any OpenAI-compatible provider. Paste an API key to start, or connect GitHub to use opencode auth.
            </p>
          </div>

          <div class="mb-6 flex flex-col gap-2.5">
            <!-- Inline option: paste API key -->
            <div class="fl-option-card">
              <div class="flex items-start gap-3">
                <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/50">
                  <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium">API key</div>
                  <div class="text-xs text-muted-foreground">Paste a key from OpenAI, Anthropic, or any compatible provider. Stored locally — never sent to our servers.</div>
                </div>
              </div>
            </div>

            <!-- Option: GitHub / opencode auth -->
            <div class="fl-option-card">
              <div class="flex items-start gap-3">
                <div class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/50">
                  <svg class="h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.09.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                  </svg>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium">GitHub / opencode</div>
                  <div class="text-xs text-muted-foreground">Sign in with GitHub to use opencode's managed auth. Opens a browser tab — return here when done.</div>
                </div>
              </div>
            </div>
          </div>

          <p class="mb-5 text-center text-xs text-muted-foreground/60">
            You can always add or change providers in Settings → Models.
          </p>

          <div class="flex flex-col gap-3">
            <button type="button" class="fl-btn-primary" @click="$emit('advance')">
              Set up providers in Settings
            </button>
            <button type="button" class="fl-btn-ghost" @click="$emit('advance')">
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
import { computed } from "vue";
import type { FirstLaunchStep } from "../../composables/useFirstLaunch";
import PermissionCard from "./PermissionCard.vue";

const props = defineProps<{
  show: boolean;
  step: FirstLaunchStep;
  appVersion: string;
  needsFsPermissionRationale: boolean;
  logoIconSrc: string;
}>();

defineEmits<{
  advance: [];
}>();

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
    ? "glib-code reads your git repositories and writes files on your behalf when an AI agent makes edits. Windows restricts this to apps you explicitly trust — click Allow when the prompt appears."
    : "glib-code reads your git repositories and writes files on your behalf when an AI agent makes edits."
);
</script>

<style scoped>
/* Panel base */
.fl-panel {
  @apply relative z-10 w-full max-w-md rounded-2xl border border-border/60 bg-card/80 p-8 shadow-2xl shadow-black/40;
  backdrop-filter: blur(12px);
}

/* Buttons */
.fl-btn-primary {
  @apply h-11 w-full rounded-xl bg-primary/90 px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring;
}
.fl-btn-ghost {
  @apply h-9 w-full rounded-xl px-5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring;
}

/* Option cards */
.fl-option-card {
  @apply rounded-xl border border-border/70 bg-background/40 px-4 py-3.5;
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
  transform: translateX(24px);
}
.fl-slide-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}
</style>
