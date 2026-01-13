/**
 * Create command handler
 */

import { testExists } from "../test-store/test-manager.js";
import { DesignModeInk } from "../modes/design-mode-ink.js";

/**
 * Handle /create command
 * @param {string} args - Test name
 * @param {Object} session - Current session
 * @param {Object} context - Additional context (includes engine, addOutput, etc.)
 * @returns {Promise<boolean>} - true to continue loop
 */
export async function handleCreate(args, session, context) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));
  const testName = args.trim();

  // Check if test name provided
  if (!testName) {
    addOutput({ type: 'error', text: 'Usage: /create <test-name>' });
    addOutput({ type: 'info', text: '' });
    addOutput({ type: 'info', text: 'Example:' });
    addOutput({ type: 'info', text: '  /create login-flow' });
    addOutput({ type: 'info', text: '  /create calculator-test' });
    return true; // Continue loop
  }

  // Check if test already exists
  const exists = await testExists(testName);
  if (exists) {
    addOutput({ type: 'error', text: `Test already exists: ${testName}` });
    addOutput({ type: 'info', text: 'Choose a different name or delete the existing test first.' });
    return true; // Continue loop
  }

  // Create design mode
  const designMode = new DesignModeInk(session, context.engine, testName, context);

  // Store reference in context so ink-shell can route inputs to it
  context.activeDesignMode = designMode;

  // Start design mode conversation
  await designMode.start();

  addOutput({ type: 'system', text: '=== Exited Design Mode ===' });

  return true; // Continue loop
}
