/**
 * Help command handler
 */

/**
 * Handle /help command
 * @param {string} args - Command arguments
 * @param {Object} session - Current session
 * @param {Object} context - Additional context
 * @returns {Promise<boolean>} - true to continue loop
 */
export async function handleHelp(args, session, context) {
  console.log(`
droid-cua - AI-powered Android testing CLI

Available commands:
  /help                    Show this help message
  /exit                    Exit the CLI
  /create <test-name>      Create a new test (autonomous design mode)
  /run <test-name>         Run an existing test

  /list                    List all tests (coming soon)
  /view <test-name>        View test contents (coming soon)
  /edit <test-name>        Edit a test (coming soon)

Current mode: Direct execution
You can type natural language instructions to control the device.

Examples:
  > /create my-test        (agent explores and generates test)
  > /run example           (execute saved test)
  > Open Chrome            (direct instruction)

For more info, see README.md
  `);

  return true; // Continue loop
}
