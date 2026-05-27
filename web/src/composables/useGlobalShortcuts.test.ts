import { ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { useGlobalShortcuts } from './useGlobalShortcuts';

describe('useGlobalShortcuts', () => {
  it('closes top-most overlay first on Escape', () => {
    const state = {
      paletteOpen: true,
      paletteIndex: 0,
      terminalOpen: false,
      settingsOpen: false,
      themeDialogOpen: false,
      cloneDialogOpen: false,
      openProjectDialogOpen: false
    };
    const forms = { palette: '' };
    const filteredPaletteCommands = ref([{ id: 'settings.open', label: 'Open settings' }]);
    const calls: string[] = [];

    const shortcuts = useGlobalShortcuts({
      state,
      forms,
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

    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(event);
    shortcuts.bind();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    shortcuts.unbind();

    expect(calls).toEqual(['close-top']);
    expect(state.paletteOpen).toBe(true);
  });

  it('toggles palette with Ctrl/Cmd+K', () => {
    const state = {
      paletteOpen: false,
      paletteIndex: 3,
      terminalOpen: false,
      settingsOpen: false,
      themeDialogOpen: false,
      cloneDialogOpen: false,
      openProjectDialogOpen: false
    };
    const forms = { palette: 'abc' };
    const filteredPaletteCommands = ref([{ id: 'settings.open', label: 'Open settings' }]);

    const shortcuts = useGlobalShortcuts({ state, forms, filteredPaletteCommands, runPalette: () => undefined });
    shortcuts.bind();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    shortcuts.unbind();

    expect(state.paletteOpen).toBe(true);
    expect(state.paletteIndex).toBe(0);
    expect(forms.palette).toBe('');
  });
});
