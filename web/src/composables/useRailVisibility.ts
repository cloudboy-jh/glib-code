// Rail visibility — owns the two independent open/closed booleans and their
// persistence. Reads from localStorage synchronously at call time (before
// first paint) so there's no flash-open-then-snap-closed on boot.
//
// Rails own *visibility only*. Nothing here touches agent state, GitTrix, or
// any composable that does I/O.

import { ref } from 'vue';

const LEFT_KEY = 'glib-left-rail-open';
const RIGHT_KEY = 'glib-right-rail-open';

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // storage quota / private browsing — not fatal
  }
}

export function useRailVisibility() {
  // Reads are synchronous — refs are initialized before first paint, no flash.
  const leftRailOpen = ref(readBool(LEFT_KEY, true));
  const rightRailOpen = ref(readBool(RIGHT_KEY, true));

  function toggleLeft() {
    leftRailOpen.value = !leftRailOpen.value;
    writeBool(LEFT_KEY, leftRailOpen.value);
  }

  function toggleRight() {
    rightRailOpen.value = !rightRailOpen.value;
    writeBool(RIGHT_KEY, rightRailOpen.value);
  }

  function setLeft(open: boolean) {
    leftRailOpen.value = open;
    writeBool(LEFT_KEY, open);
  }

  function setRight(open: boolean) {
    rightRailOpen.value = open;
    writeBool(RIGHT_KEY, open);
  }

  return { leftRailOpen, rightRailOpen, toggleLeft, toggleRight, setLeft, setRight };
}
