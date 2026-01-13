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

  // Force immediate exit to stop any ongoing execution
  // Use setTimeout to allow the "Goodbye!" message to render first
  setTimeout(() => {
    process.exit(0);
  }, 100);

  return false;
}
