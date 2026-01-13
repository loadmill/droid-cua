/**
 * Run command handler
 */

import { loadTest, listTests, testExists } from "../test-store/test-manager.js";
import { ExecutionMode } from "../modes/execution-mode.js";

/**
 * Handle /run command
 * @param {string} args - Test name
 * @param {Object} session - Current session
 * @param {Object} context - Additional context (includes rl, engine)
 * @returns {Promise<boolean>} - true to continue loop
 */
export async function handleRun(args, session, context) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));
  const testName = args.trim();

  // If no test name provided, list available tests
  if (!testName) {
    addOutput({ type: 'info', text: 'Usage: /run <test-name>' });
    addOutput({ type: 'info', text: '' });
    addOutput({ type: 'info', text: 'Available tests:' });

    const tests = await listTests();
    if (tests.length === 0) {
      addOutput({ type: 'info', text: '  (no tests found)' });
      addOutput({ type: 'info', text: '' });
      addOutput({ type: 'info', text: 'Create a test first with: /create <test-name>' });
    } else {
      for (const test of tests) {
        addOutput({ type: 'info', text: `  ${test.name} (${test.lines} lines)` });
      }
    }

    return true; // Continue loop
  }

  // Check if test exists
  const exists = await testExists(testName);
  if (!exists) {
    addOutput({ type: 'error', text: `Test not found: ${testName}` });
    addOutput({ type: 'info', text: 'Use /list to see available tests.' });
    return true; // Continue loop
  }

  // Set mode and test name in Ink UI
  if (context.setMode) {
    context.setMode('execution');
  }
  if (context.setTestName) {
    context.setTestName(testName);
  }

  // Load test instructions
  addOutput({ type: 'system', text: `Loading test: ${testName}` });
  const instructions = await loadTest(testName);
  addOutput({ type: 'info', text: `Loaded ${instructions.length} instructions` });
  addOutput({ type: 'info', text: '' });

  // Disable free-form input during execution (only allow commands like /exit)
  if (context.setInputDisabled) {
    context.setInputDisabled(false); // Keep input enabled, but...
  }
  if (context.setExecutionMode) {
    context.setExecutionMode(true); // Signal we're in execution mode
  }
  if (context.setInputPlaceholder) {
    context.setInputPlaceholder('Type /exit to stop test execution');
  }

  // Set agent working status
  if (context.setAgentWorking) {
    context.setAgentWorking(true, 'Executing test...');
  }

  // Create execution mode
  const executionMode = new ExecutionMode(session, context.engine, instructions);

  // Execute the test
  const result = await executionMode.execute(context);

  // Clear agent working status
  if (context.setAgentWorking) {
    context.setAgentWorking(false);
  }

  // Re-enable free-form input
  if (context.setExecutionMode) {
    context.setExecutionMode(false);
  }
  if (context.setInputPlaceholder) {
    context.setInputPlaceholder('Type a command or message...');
  }

  // Reset mode
  if (context.setMode) {
    context.setMode('command');
  }
  if (context.setTestName) {
    context.setTestName(null);
  }

  if (result.success) {
    addOutput({ type: 'success', text: '✓ Test passed!' });
  } else {
    addOutput({ type: 'error', text: `✗ Test failed: ${result.error || "Unknown error"}` });
  }

  return true; // Continue loop
}
