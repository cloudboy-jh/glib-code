import type { Ref } from 'vue';

type PaletteCommand = { id: string; label: string };

export function useGlobalShortcuts(options: {
  state: {
    paletteOpen: boolean;
    paletteIndex: number;
    terminalOpen: boolean;
    settingsOpen: boolean;
    themeDialogOpen: boolean;
    cloneDialogOpen: boolean;
    openProjectDialogOpen: boolean;
  };
  forms: { palette: string };
  filteredPaletteCommands: Ref<PaletteCommand[]>;
  runPalette: (id: string) => void;
  closeOnEscape?: Array<() => boolean>;
}) {
  function onGlobalKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      options.state.paletteOpen = !options.state.paletteOpen;
      if (options.state.paletteOpen) {
        options.forms.palette = '';
        options.state.paletteIndex = 0;
      }
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
      event.preventDefault();
      options.state.terminalOpen = !options.state.terminalOpen;
      return;
    }

    if (event.key === 'Escape') {
      for (const close of options.closeOnEscape ?? []) {
        if (close()) return;
      }
      if (options.state.paletteOpen) {
        options.state.paletteOpen = false;
        return;
      }
      if (options.state.settingsOpen) {
        options.state.settingsOpen = false;
        return;
      }
      if (options.state.themeDialogOpen) {
        options.state.themeDialogOpen = false;
        return;
      }
      if (options.state.cloneDialogOpen) {
        options.state.cloneDialogOpen = false;
        return;
      }
      if (options.state.openProjectDialogOpen) {
        options.state.openProjectDialogOpen = false;
        return;
      }
      if (options.state.terminalOpen) {
        options.state.terminalOpen = false;
      }
      return;
    }

    if (!options.state.paletteOpen) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      options.state.paletteIndex = Math.min(options.state.paletteIndex + 1, Math.max(options.filteredPaletteCommands.value.length - 1, 0));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      options.state.paletteIndex = Math.max(options.state.paletteIndex - 1, 0);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const cmd = options.filteredPaletteCommands.value[options.state.paletteIndex];
      if (cmd) options.runPalette(cmd.id);
    }
  }

  function bind() {
    window.addEventListener('keydown', onGlobalKeydown);
  }

  function unbind() {
    window.removeEventListener('keydown', onGlobalKeydown);
  }

  return { bind, unbind };
}
