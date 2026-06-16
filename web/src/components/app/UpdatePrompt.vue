<template>
  <Transition name="update-slide" appear>
    <div
      v-if="visible"
      class="fixed bottom-4 right-4 z-[90] w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-border/80 bg-card/95 shadow-2xl shadow-black/40"
      style="backdrop-filter: blur(8px);"
      role="status"
      aria-live="polite"
    >
      <!-- ── Update available ── -->
      <template v-if="updateState.phase === 'available'">
        <div class="p-4">
          <div class="mb-1 flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-primary" />
            <span class="text-sm font-semibold">Update available</span>
            <span class="ml-auto text-xs text-muted-foreground">v{{ updateState.version }}</span>
          </div>
          <p class="mb-3 text-xs text-muted-foreground">
            A new version of glib-code is ready to download.
          </p>
          <div class="flex items-center gap-2">
            <button type="button" class="up-btn-primary flex-1" @click="$emit('download')">
              Download update
            </button>
            <button type="button" class="up-btn-ghost" @click="$emit('dismiss')">
              Later
            </button>
          </div>
        </div>
      </template>

      <!-- ── Downloading ── -->
      <template v-else-if="updateState.phase === 'downloading'">
        <div class="p-4">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-semibold">Downloading update…</span>
            <span class="text-xs tabular-nums text-muted-foreground">{{ updateState.percent }}%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-muted/50">
            <div
              class="h-full rounded-full bg-primary transition-all duration-300"
              :style="{ width: `${updateState.percent}%` }"
            />
          </div>
        </div>
      </template>

      <!-- ── Ready to install ── -->
      <template v-else-if="updateState.phase === 'ready'">
        <div class="p-4">
          <div class="mb-1 flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-green-400" />
            <span class="text-sm font-semibold">Update ready</span>
            <span class="ml-auto text-xs text-muted-foreground">v{{ updateState.version }}</span>
          </div>
          <p class="mb-3 text-xs text-muted-foreground">
            Downloaded and verified. Restart to apply.
          </p>
          <div class="flex items-center gap-2">
            <button type="button" class="up-btn-primary flex-1" @click="$emit('install')">
              Restart and install
            </button>
            <button type="button" class="up-btn-ghost" @click="$emit('dismiss')">
              Later
            </button>
          </div>
        </div>
      </template>

      <!-- ── Error ── -->
      <template v-else-if="updateState.phase === 'error'">
        <div class="p-4">
          <div class="mb-1 flex items-center gap-2">
            <div class="h-2 w-2 rounded-full bg-red-400" />
            <span class="text-sm font-semibold text-foreground/90">Update failed</span>
          </div>
          <p class="mb-3 text-xs text-muted-foreground">{{ errorMessage }}</p>
          <div class="flex items-center gap-2">
            <button type="button" class="up-btn-ghost flex-1 border border-border/70" @click="$emit('dismiss')">
              Dismiss
            </button>
          </div>
        </div>
      </template>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { UpdateState } from "../../composables/useFirstLaunch";

const props = defineProps<{
  updateState: UpdateState;
}>();

defineEmits<{
  download: [];
  install: [];
  dismiss: [];
}>();

const visible = computed(() =>
  props.updateState.phase !== "idle"
);

const errorMessage = computed(() => {
  if (props.updateState.phase !== "error") return "";
  const msg = props.updateState.message;
  // Translate common errors into plain English
  if (msg.includes("ENOENT") || msg.includes("disk")) return "Not enough disk space or the download path is inaccessible.";
  if (msg.includes("signature") || msg.includes("verify")) return "Signature verification failed. The download may be corrupt — try again.";
  if (msg.includes("network") || msg.includes("ECONNRESET") || msg.includes("fetch")) return "Network error. Check your connection and try again.";
  if (msg.includes("permission") || msg.includes("EACCES")) return "Permission denied writing the update. Try running glib-code as your normal user.";
  return msg;
});
</script>

<style scoped>
.up-btn-primary {
  @apply h-8 rounded-lg bg-primary/85 px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring;
}
.up-btn-ghost {
  @apply h-8 rounded-lg px-3 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring;
}

.update-slide-enter-active,
.update-slide-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.update-slide-enter-from,
.update-slide-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
