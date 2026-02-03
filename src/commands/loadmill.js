/**
 * Loadmill command handler
 */

import { executeLoadmillCommand, getApiToken } from "../integrations/loadmill/index.js";

/**
 * Handle /loadmill command
 * @param {string} args - Command arguments (natural language command)
 * @param {Object} session - Current session
 * @param {Object} context - Additional context
 * @returns {Promise<boolean>} - true to continue loop
 */
export async function handleLoadmill(args, session, context) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));
  const command = args.trim();

  // Show help if no arguments
  if (!command) {
    addOutput({ type: 'system', text: 'Loadmill - Run test flows using natural language' });
    addOutput({ type: 'info', text: '' });
    addOutput({ type: 'info', text: 'Usage:' });
    addOutput({ type: 'info', text: '  /loadmill <command>          Execute a Loadmill flow' });
    addOutput({ type: 'info', text: '' });
    addOutput({ type: 'info', text: 'Examples:' });
    addOutput({ type: 'info', text: '  /loadmill search for login flow' });
    addOutput({ type: 'info', text: '  /loadmill run checkout flow with user=test123' });
    addOutput({ type: 'info', text: '  /loadmill run payment test with amount=100' });
    addOutput({ type: 'info', text: '' });
    addOutput({ type: 'info', text: 'In test scripts (.dcua files):' });
    addOutput({ type: 'info', text: '  loadmill: run user authentication flow' });
    addOutput({ type: 'info', text: '' });
    addOutput({ type: 'info', text: 'Configuration:' });
    addOutput({ type: 'info', text: '  Set LOADMILL_API_TOKEN in your .env file' });

    // Check if token is configured
    if (!getApiToken()) {
      addOutput({ type: 'warning', text: '' });
      addOutput({ type: 'warning', text: 'Warning: LOADMILL_API_TOKEN is not set.' });
    }

    return true;
  }

  // Check for API token
  if (!getApiToken()) {
    addOutput({ type: 'error', text: 'LOADMILL_API_TOKEN environment variable is not set.' });
    addOutput({ type: 'info', text: 'Add it to your .env file:' });
    addOutput({ type: 'info', text: '  LOADMILL_API_TOKEN=your-token-here' });
    return true;
  }

  // Set agent working status
  if (context.setAgentWorking) {
    context.setAgentWorking(true, 'Running Loadmill flow...');
  }

  // Execute the command
  const result = await executeLoadmillCommand(command, {
    onProgress: ({ message }) => {
      addOutput({ type: 'info', text: `[Loadmill] ${message}` });
    }
  });

  // Clear agent working status
  if (context.setAgentWorking) {
    context.setAgentWorking(false);
  }

  // Display results
  if (result.success) {
    if (result.action === "search") {
      addOutput({ type: 'success', text: `Found ${result.result.flows.length} flow(s):` });
      result.result.flows.forEach((flow, i) => {
        const name = flow.description || flow.name || "Unknown";
        const suite = flow.testSuiteDescription ? ` (Suite: ${flow.testSuiteDescription})` : '';
        addOutput({ type: 'info', text: `  ${i + 1}. ${name}${suite}` });
        addOutput({ type: 'info', text: `     ID: ${flow.id}` });
      });
      if (result.result.selectedFlow) {
        const selectedName = result.result.selectedFlow.description || result.result.selectedFlow.name || "Unknown";
        addOutput({ type: 'info', text: '' });
        addOutput({ type: 'info', text: `Best match: "${selectedName}" (confidence: ${(result.result.confidence * 100).toFixed(0)}%)` });
      }
    } else {
      addOutput({ type: 'success', text: `Flow "${result.flowName}" passed` });
      if (result.runId) {
        addOutput({ type: 'info', text: `Run ID: ${result.runId}` });
      }
    }
  } else {
    addOutput({ type: 'error', text: `Loadmill failed: ${result.error}` });
  }

  return true; // Continue loop
}
