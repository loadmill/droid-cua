/**
 * Parse user input to determine if it's a slash command or regular instruction
 */

/**
 * Parse user input
 * @param {string} input - Raw user input
 * @returns {{type: 'command'|'instruction', command?: string, args?: string, text?: string}}
 */
export function parseInput(input) {
  const trimmed = input.trim();

  // Check if it starts with /
  if (trimmed.startsWith('/')) {
    // Extract command and args
    const match = trimmed.match(/^\/(\w+)\s*(.*)/);

    if (match) {
      const [, command, args] = match;
      return {
        type: 'command',
        command: command.toLowerCase(),
        args: args.trim(),
      };
    }

    // Invalid slash command format
    return {
      type: 'command',
      command: trimmed.slice(1).toLowerCase(),
      args: '',
    };
  }

  // Not a command, treat as regular instruction
  return {
    type: 'instruction',
    text: trimmed,
  };
}

/**
 * Available slash commands
 */
export const COMMANDS = {
  help: 'Show available commands',
  exit: 'Exit the CLI',
  create: 'Create a new test with autonomous design',
  run: 'Execute an existing test',
  list: 'List all available tests',
  view: 'View test contents with line numbers',
  edit: 'Edit a test in your default editor',
};

/**
 * Get command suggestions for autocomplete
 * @param {string} partial - Partial command (e.g., "he" for "help")
 * @returns {string[]} - Array of matching commands
 */
export function getCommandSuggestions(partial) {
  const lower = partial.toLowerCase();
  return Object.keys(COMMANDS).filter(cmd => cmd.startsWith(lower));
}
