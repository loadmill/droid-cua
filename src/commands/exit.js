/**
 * Exit command handler
 */

/**
 * Handle /exit command
 * @param {string} args - Command arguments
 * @param {Object} session - Current session
 * @param {Object} context - Additional context (includes rl)
 * @returns {Promise<boolean>} - false to exit loop
 */
export async function handleExit(args, session, context) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));

  addOutput({ type: 'system', text: 'Goodbye!' });

  // Exit via context (for Ink) or process.exit (for headless)
  if (context?.exit) {
    context.exit();
  } else {
    process.exit(0);
  }

  // This won't be reached, but return false for consistency
  return false;
}
