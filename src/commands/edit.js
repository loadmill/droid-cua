/**
 * Edit command handler
 */

import { spawn } from 'child_process';
import { testExists } from "../test-store/test-manager.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TESTS_DIR = path.join(__dirname, "../../tests");

/**
 * Handle /edit command
 * @param {string} args - Test name
 * @param {Object} session - Current session
 * @param {Object} context - Additional context
 * @returns {Promise<boolean>} - true to continue loop
 */
export async function handleEdit(args, session, context) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));
  const testName = args.trim();

  // Check if test name provided
  if (!testName) {
    addOutput({ type: 'error', text: 'Usage: /edit <test-name>' });
    addOutput({ type: 'info', text: '' });
    addOutput({ type: 'info', text: 'Example:' });
    addOutput({ type: 'info', text: '  /edit example' });
    return true; // Continue loop
  }

  // Check if test exists
  const exists = await testExists(testName);
  if (!exists) {
    addOutput({ type: 'error', text: `Test not found: ${testName}` });
    addOutput({ type: 'info', text: 'Use /list to see available tests.' });
    return true; // Continue loop
  }

  // Determine editor to use
  const editor = process.env.EDITOR || process.env.VISUAL || 'nano';
  const filename = testName.endsWith('.dcua') ? testName : `${testName}.dcua`;
  const filepath = path.join(TESTS_DIR, filename);

  addOutput({ type: 'system', text: `Opening ${testName} in ${editor}...` });
  addOutput({ type: 'info', text: 'Save and exit the editor to return to droid-cua.' });

  // Open editor in foreground (blocking)
  return new Promise((resolve) => {
    const editorProcess = spawn(editor, [filepath], {
      stdio: 'inherit', // Inherit stdin/stdout/stderr to allow interactive editing
    });

    editorProcess.on('exit', (code) => {
      if (code === 0) {
        addOutput({ type: 'success', text: `Finished editing ${testName}` });
      } else {
        addOutput({ type: 'error', text: `Editor exited with code ${code}` });
      }
      resolve(true); // Continue loop
    });

    editorProcess.on('error', (err) => {
      addOutput({ type: 'error', text: `Failed to open editor: ${err.message}` });
      addOutput({ type: 'info', text: 'Try setting the EDITOR environment variable.' });
      resolve(true); // Continue loop
    });
  });
}
