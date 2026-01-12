/**
 * Create command handler
 */

import { testExists } from "../test-store/test-manager.js";
import { DesignMode } from "../modes/design-mode.js";

/**
 * Handle /create command
 * @param {string} args - Test name
 * @param {Object} session - Current session
 * @param {Object} context - Additional context (includes rl, engine)
 * @returns {Promise<boolean>} - true to continue loop
 */
export async function handleCreate(args, session, context) {
  const testName = args.trim();

  // Check if test name provided
  if (!testName) {
    console.log("Usage: /create <test-name>");
    console.log("\nExample:");
    console.log("  /create login-flow");
    console.log("  /create calculator-test");
    return true; // Continue loop
  }

  // Check if test already exists
  const exists = await testExists(testName);
  if (exists) {
    console.log(`Test already exists: ${testName}`);
    console.log("Choose a different name or delete the existing test first.");
    return true; // Continue loop
  }

  // Create design mode
  const designMode = new DesignMode(session, context.engine, testName);

  // Start design mode conversation
  await designMode.start(context);

  console.log("\n=== Exited Design Mode ===\n");

  return true; // Continue loop
}
