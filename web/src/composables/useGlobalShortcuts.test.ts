import { ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { useGlobalShortcuts } from './useGlobalShortcuts';

function makeState(overrides: Partial<Record<string, boolean | number>> = {}) {
  return {
    paletteOpen: false,
    paletteIndex: 0,
    terminalOpen: false,
    settingsOpen: false,
    themeDialogOpen: false,
    cloneDialogOpen: false,
    openProjectDialogOpen: false,
    ...overrides
  } as {
    paletteOpen: boolean;
    paletteIndex: number;
    terminalOpen: boolean;
    settingsOpen: boolean;
    themeDialogOpen: boolean;
    cloneDialogOpen: boolean;
    openProjectDialogOpen: boolean;
  };
}

describe('useGlobalShortcuts', () => {
  it('closes top-most overlay first on Escape', () => {
    const state = makeState({ paletteOpen: true });
    const filteredPaletteCommands = ref([{ id: 'settings.open', label: 'Open settings' }]);
    const calls: string[] = [];

    const shortcuts = useGlobalShortcuts({
      state,
      filteredPaletteCommands,
      runPalette: (id) => calls.push(id),
      closeOnEscape: [
        () => false,
        () => {
          calls.push('close-top');
          return true;
        }
      ]
    });

    shortcuts.bind();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    shortcuts.unbind();

    expect(calls).toEqual(['close-top']);
    expect(state.paletteOpen).toBe(true);
  });

  it('does not bind modifier-combo globals (Ctrl+K is a no-op)', () => {
    const state = makeState();
    const filteredPaletteCommands = ref([{ id: 'settings.open', label: 'Open settings' }]);

    const shortcuts = useGlobalShortcuts({ state, filteredPaletteCommands, runPalette: () => undefined });
    shortcuts.bind();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    shortcuts.unbind();

    expect(state.paletteOpen).toBe(false);
  });

  it('drives palette selection with arrows + Enter while open', () => {
    const state = makeState({ paletteOpen: true, paletteIndex: 0 });
    const filteredPaletteCommands = ref([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' }
    ]);
    const calls: string[] = [];

    const shortcuts = useGlobalShortcuts({
      state,
      filteredPaletteCommands,
      runPalette: (id) => calls.push(id)
    });

    shortcuts.bind();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(state.paletteIndex).toBe(1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    shortcuts.unbind();

    expect(calls).toEqual(['b']);
  });
});
