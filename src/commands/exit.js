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
  console.log("Goodbye!");

  // Close readline interface
  if (context.rl) {
    context.rl.close();
  }

  // Exit process
  process.exit(0);

  // This won't be reached, but return false for consistency
  return false;
}
