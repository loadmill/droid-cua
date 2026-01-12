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
  const testName = args.trim();

  // If no test name provided, list available tests
  if (!testName) {
    console.log("Usage: /run <test-name>");
    console.log("\nAvailable tests:");

    const tests = await listTests();
    if (tests.length === 0) {
      console.log("  (no tests found)");
      console.log("\nCreate a test first with: /create <test-name>");
    } else {
      for (const test of tests) {
        console.log(`  ${test.name} (${test.lines} lines)`);
      }
    }

    return true; // Continue loop
  }

  // Check if test exists
  const exists = await testExists(testName);
  if (!exists) {
    console.log(`Test not found: ${testName}`);
    console.log("Use /list to see available tests.");
    return true; // Continue loop
  }

  // Load test instructions
  console.log(`Loading test: ${testName}`);
  const instructions = await loadTest(testName);
  console.log(`Loaded ${instructions.length} instructions\n`);

  // Create execution mode
  const executionMode = new ExecutionMode(session, context.engine, instructions);

  // Execute the test
  const result = await executionMode.execute(context);

  if (result.success) {
    console.log("\n✓ Test passed!");
  } else {
    console.log(`\n✗ Test failed: ${result.error || "Unknown error"}`);
  }

  return true; // Continue loop
}
