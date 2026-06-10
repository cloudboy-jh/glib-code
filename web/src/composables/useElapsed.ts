import { computed, onUnmounted, ref, watch, type Ref } from 'vue';

/**
 * Reactive mm:ss elapsed timer that ticks every second.
 * When `startAt` becomes a valid ISO string, the timer starts.
 * When `startAt` becomes nullish, the timer stops and resets to empty string.
 */
export function useElapsed(startAt: Ref<string | null | undefined>) {
  const now = ref(Date.now());
  let timer: ReturnType<typeof setInterval> | null = null;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  watch(
    startAt,
    (value) => {
      stop();
      if (!value) return;
      now.value = Date.now();
      timer = setInterval(() => {
        now.value = Date.now();
      }, 1000);
    },
    { immediate: true }
  );

  onUnmounted(stop);

  const label = computed(() => {
    const start = startAt.value ? Date.parse(startAt.value) : NaN;
    if (!Number.isFinite(start)) return '';
    const seconds = Math.max(0, Math.floor((now.value - start) / 1000));
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  });

  return { label };
}
