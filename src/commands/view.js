/**
 * View command handler
 */

import { testExists, getTestContent } from "../test-store/test-manager.js";

/**
 * Handle /view command
 * @param {string} args - Test name
 * @param {Object} session - Current session
 * @param {Object} context - Additional context
 * @returns {Promise<boolean>} - true to continue loop
 */
export async function handleView(args, session, context) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));
  const testName = args.trim();

  // Check if test name provided
  if (!testName) {
    addOutput({ type: 'error', text: 'Usage: /view <test-name>' });
    addOutput({ type: 'info', text: '' });
    addOutput({ type: 'info', text: 'Example:' });
    addOutput({ type: 'info', text: '  /view example' });
    return true; // Continue loop
  }

  // Check if test exists
  const exists = await testExists(testName);
  if (!exists) {
    addOutput({ type: 'error', text: `Test not found: ${testName}` });
    addOutput({ type: 'info', text: 'Use /list to see available tests.' });
    return true; // Continue loop
  }

  // Load and display test content
  const content = await getTestContent(testName);
  const lines = content.split('\n');

  addOutput({ type: 'system', text: `Test: ${testName}` });
  addOutput({ type: 'info', text: '─'.repeat(60) });

  // Display with line numbers
  lines.forEach((line, index) => {
    const lineNum = String(index + 1).padStart(3, ' ');
    addOutput({ type: 'info', text: `${lineNum} │ ${line}` });
  });

  addOutput({ type: 'info', text: '─'.repeat(60) });
  addOutput({ type: 'info', text: `${lines.length} lines total` });

  return true; // Continue loop
}
