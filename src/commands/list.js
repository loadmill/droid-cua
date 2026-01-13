/**
 * List command handler
 */

import { listTests } from "../test-store/test-manager.js";

/**
 * Handle /list command
 * @param {string} args - Command arguments (unused)
 * @param {Object} session - Current session
 * @param {Object} context - Additional context
 * @returns {Promise<boolean>} - true to continue loop
 */
export async function handleList(args, session, context) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));

  addOutput({ type: 'system', text: 'Available tests:' });
  addOutput({ type: 'info', text: '' });

  const tests = await listTests();

  if (tests.length === 0) {
    addOutput({ type: 'info', text: '  (no tests found)' });
    addOutput({ type: 'info', text: '' });
    addOutput({ type: 'info', text: 'Create a test with: /create <test-name>' });
  } else {
    for (const test of tests) {
      // Format date as relative time
      const now = new Date();
      const diff = now - test.modified;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      let timeAgo;
      if (days > 0) {
        timeAgo = `${days} day${days > 1 ? 's' : ''} ago`;
      } else if (hours > 0) {
        timeAgo = `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else if (minutes > 0) {
        timeAgo = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      } else {
        timeAgo = 'just now';
      }

      // Output test name in cyan, metadata in dim
      addOutput({
        type: 'test-name',
        text: `  ${test.name}`,
        metadata: `(${test.lines} lines, modified ${timeAgo})`
      });
    }
    addOutput({ type: 'info', text: '' });
    addOutput({ type: 'info', text: 'Run a test with: /run <test-name>' });
    addOutput({ type: 'info', text: 'View a test with: /view <test-name>' });
  }

  return true; // Continue loop
}
