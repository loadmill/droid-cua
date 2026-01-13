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
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));

  addOutput({ type: 'system', text: 'droid-cua - AI-powered Android testing CLI' });
  addOutput({ type: 'info', text: '' });
  addOutput({ type: 'info', text: 'Available commands:' });
  addOutput({ type: 'info', text: '  /help                    Show this help message' });
  addOutput({ type: 'info', text: '  /exit                    Exit the CLI' });
  addOutput({ type: 'info', text: '  /create <test-name>      Create a new test (autonomous design mode - coming soon)' });
  addOutput({ type: 'info', text: '  /run <test-name>         Run an existing test' });
  addOutput({ type: 'info', text: '' });
  addOutput({ type: 'info', text: '  /list                    List all tests (coming soon)' });
  addOutput({ type: 'info', text: '  /view <test-name>        View test contents (coming soon)' });
  addOutput({ type: 'info', text: '  /edit <test-name>        Edit a test (coming soon)' });
  addOutput({ type: 'info', text: '' });
  addOutput({ type: 'info', text: 'Examples:' });
  addOutput({ type: 'info', text: '  /run example           (execute saved test)' });
  addOutput({ type: 'info', text: '' });
  addOutput({ type: 'info', text: 'For more info, see README.md' });

  return true; // Continue loop
}
