export type SlashCommandCategory = 'session' | 'navigation' | 'mode' | 'actions' | 'info';

export type SlashCommand = {
  id: string;
  value: string;
  label: string;
  description: string;
  category: SlashCommandCategory;
  aliases?: string[];
  inlineArgs?: boolean;
  argHint?: string;
  available?: () => boolean;
  availableDuringTask?: boolean;
};

const COMMANDS: SlashCommand[] = [
  { id: 'cmd-new', value: 'new', label: 'New session', description: 'Start a fresh session.', category: 'session', aliases: ['clear'] },
  { id: 'cmd-sessions', value: 'sessions', label: 'Sessions', description: 'Browse or switch sessions.', category: 'session', aliases: ['resume', 'continue'] },
  { id: 'cmd-rename', value: 'rename', label: 'Rename', description: 'Rename session title.', category: 'session', inlineArgs: true, argHint: 'title' },
  { id: 'cmd-fork', value: 'fork', label: 'Fork', description: 'Fork current session into a new branch.', category: 'session' },
  { id: 'cmd-compact', value: 'compact', label: 'Compact', description: 'Compress context to free tokens.', category: 'session' },
  { id: 'cmd-archive', value: 'archive', label: 'Archive', description: 'Archive and clean up session.', category: 'session' },

  { id: 'cmd-diff', value: 'diff', label: 'Switch to diffs', description: 'Jump to the diff review surface.', category: 'navigation' },
  { id: 'cmd-tree', value: 'tree', label: 'File tree', description: 'Show the project file tree.', category: 'navigation' },
  { id: 'cmd-session', value: 'session', label: 'Switch to session', description: 'Stay in the session workspace.', category: 'navigation' },
  { id: 'cmd-models', value: 'model', label: 'Model', description: 'Open the model picker.', category: 'navigation', aliases: ['models'], inlineArgs: true, argHint: 'provider/model' },
  { id: 'cmd-themes', value: 'theme', label: 'Theme', description: 'Open the theme picker.', category: 'navigation', aliases: ['themes'] },

  { id: 'cmd-plan', value: 'plan', label: 'Plan mode', description: 'Switch to plan mode (review before edit).', category: 'mode' },
  { id: 'cmd-fast', value: 'fast', label: 'Fast mode', description: 'Switch to fast mode (speed over reasoning).', category: 'mode' },

  { id: 'cmd-undo', value: 'undo', label: 'Undo', description: 'Undo the previous step.', category: 'actions', availableDuringTask: false },
  { id: 'cmd-redo', value: 'redo', label: 'Redo', description: 'Redo the last undone step.', category: 'actions', availableDuringTask: false },
  { id: 'cmd-attach', value: 'attach', label: 'Attach files', description: 'Open file picker and upload attachments.', category: 'actions' },
  { id: 'cmd-attachments', value: 'attachments', label: 'Attachments', description: 'Focus attachment list.', category: 'actions' },
  { id: 'cmd-share', value: 'share', label: 'Share', description: 'Share the current session.', category: 'actions' },
  { id: 'cmd-init', value: 'init', label: 'Initialize', description: 'Initialize workspace guidance.', category: 'actions' },

  { id: 'cmd-cost', value: 'cost', label: 'Cost', description: 'Show session cost and token breakdown.', category: 'info' },
  { id: 'cmd-status', value: 'status', label: 'Status', description: 'Show session config and token usage.', category: 'info' },
  { id: 'cmd-help', value: 'help', label: 'Help', description: 'Show available commands.', category: 'info' },
];

export const CATEGORY_ORDER: SlashCommandCategory[] = ['session', 'navigation', 'mode', 'actions', 'info'];

export const CATEGORY_LABELS: Record<SlashCommandCategory, string> = {
  session: 'Session',
  navigation: 'Navigation',
  mode: 'Mode',
  actions: 'Actions',
  info: 'Info',
};

export function getSlashCommands(isRunning = false): SlashCommand[] {
  return COMMANDS.filter((cmd) => {
    if (isRunning && cmd.availableDuringTask === false) return false;
    if (cmd.available && !cmd.available()) return false;
    return true;
  });
}

export function parseCommandInput(input: string): { command: string; args: string } | null {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith('/')) return null;
  const rest = trimmed.slice(1);
  const spaceIdx = rest.indexOf(' ');
  if (spaceIdx === -1) return { command: rest.toLowerCase(), args: '' };
  return { command: rest.slice(0, spaceIdx).toLowerCase(), args: rest.slice(spaceIdx + 1).trim() };
}

export function resolveCommand(partial: string): SlashCommand | undefined {
  return COMMANDS.find((cmd) => cmd.value === partial || cmd.aliases?.includes(partial));
}
