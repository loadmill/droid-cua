/**
 * Command registry and router
 */

import { handleHelp } from './help.js';
import { handleExit } from './exit.js';

/**
 * Map of command names to their handlers
 * Each handler receives (args, session, context)
 */
const COMMAND_HANDLERS = {
  help: handleHelp,
  exit: handleExit,
  // Placeholders for future phases:
  // create: handleCreate,
  // run: handleRun,
  // list: handleList,
  // view: handleView,
  // edit: handleEdit,
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
  const handler = COMMAND_HANDLERS[command];

  if (!handler) {
    console.log(`Unknown command: /${command}`);
    console.log(`Type /help to see available commands.`);
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
