/**
 * Command registry and router
 */

import { handleHelp } from './help.js';
import { handleExit } from './exit.js';
import { handleRun } from './run.js';
import { handleCreate } from './create.js';
import { handleList } from './list.js';
import { handleView } from './view.js';
import { handleEdit } from './edit.js';
import { handleStop } from './stop.js';

/**
 * Map of command names to their handlers
 * Each handler receives (args, session, context)
 */
const COMMAND_HANDLERS = {
  help: handleHelp,
  exit: handleExit,
  run: handleRun,
  create: handleCreate,
  list: handleList,
  view: handleView,
  edit: handleEdit,
  stop: handleStop,
};

/**
 * Route a command to its handler
 * @param {string} command - Command name (without /)
 * @param {string} args - Command arguments
 * @param {Object} session - Current session
 * @param {Object} context - Additional context (rl, etc.)
 * @returns {Promise<boolean>} - true if command should continue loop, false to exit
 */
export async function routeCommand(command, args, session, context) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));
  const handler = COMMAND_HANDLERS[command];

  if (!handler) {
    addOutput({ type: 'error', text: `Unknown command: /${command}` });
    addOutput({ type: 'info', text: 'Type /help to see available commands.' });
    return true; // Continue loop
  }

  return await handler(args, session, context);
}

/**
 * Get list of available commands
 */
export function getAvailableCommands() {
  return Object.keys(COMMAND_HANDLERS);
}
