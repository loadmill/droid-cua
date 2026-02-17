/**
 * Loadmill instruction handling for script execution
 */

import { executeLoadmillCommand } from "../integrations/loadmill/index.js";

/**
 * Check if an instruction is a Loadmill command
 * @param {string} userInput - The instruction text
 * @returns {boolean}
 */
export function isLoadmillInstruction(userInput) {
  const trimmed = userInput.trim();
  const lower = trimmed.toLowerCase();
  return lower.startsWith("loadmill:") || lower.startsWith("loadmill ");
}

/**
 * Extract the Loadmill command from an instruction
 * @param {string} userInput - The instruction text
 * @returns {string} - The extracted command
 */
export function extractLoadmillCommand(userInput) {
  const trimmed = userInput.trim();
  const lower = trimmed.toLowerCase();

  // Handle "loadmill:" or "Loadmill:"
  if (lower.startsWith("loadmill:")) {
    return trimmed.substring("loadmill:".length).trim();
  }

  // Handle "loadmill " or "Loadmill "
  if (lower.startsWith("loadmill ")) {
    return trimmed.substring("loadmill".length).trim();
  }

  return trimmed;
}

/**
 * Execute a Loadmill instruction and handle the result
 * @param {string} command - The Loadmill command to execute
 * @param {boolean} isHeadlessMode - Whether running in headless/CI mode
 * @param {Object} context - Execution context
 * @param {Object|null} stepContext - Optional step context metadata
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function executeLoadmillInstruction(command, isHeadlessMode, context, stepContext = null) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));
  const meta = {
    runId: context?.runId,
    stepId: stepContext?.stepId,
    instructionIndex: stepContext?.instructionIndex
  };

  addOutput({
    type: 'info',
    text: `[Loadmill] Executing: ${command}`,
    eventType: 'system_message',
    payload: { loadmillCommand: command },
    ...meta
  });

  const result = await executeLoadmillCommand(command, {
    onProgress: ({ message, runId }) => {
      const payload = runId ? { loadmillSuiteRunId: runId, loadmillCommand: command } : { loadmillCommand: command };
      addOutput({ type: 'info', text: `[Loadmill] ${message}`, eventType: 'system_message', payload, ...meta });
    }
  });

  if (result.success) {
    handleLoadmillSuccess(command, result, context, stepContext);
    return { success: true };
  } else {
    return await handleLoadmillFailure(command, result.error, isHeadlessMode, context, stepContext, result.runId);
  }
}

/**
 * Handle a Loadmill execution failure
 * @param {string} command - The failed command
 * @param {string} error - Error message
 * @param {boolean} isHeadlessMode - Whether running in headless/CI mode
 * @param {Object} context - Execution context
 * @param {Object|null} stepContext - Optional step context metadata
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function handleLoadmillFailure(command, error, isHeadlessMode, context, stepContext = null, suiteRunId = null) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));
  const meta = {
    runId: context?.runId,
    stepId: stepContext?.stepId,
    instructionIndex: stepContext?.instructionIndex
  };

  const payload = suiteRunId ? { loadmillSuiteRunId: suiteRunId, loadmillCommand: command } : { loadmillCommand: command };

  addOutput({ type: 'error', text: '[Loadmill] FAILED', eventType: 'error', payload, ...meta });
  addOutput({ type: 'error', text: `Command: ${command}`, eventType: 'error', payload, ...meta });
  addOutput({ type: 'error', text: `Error: ${error}`, eventType: 'error', payload, ...meta });

  if (isHeadlessMode) {
    // Headless mode: exit with error code
    if (context?.exit) {
      context.exit();
    }
    process.exit(1);
  }

  // Interactive mode: ask user what to do
  addOutput({
    type: 'system',
    text: 'What would you like to do? (retry/skip/stop)',
    eventType: 'input_request',
    payload: { options: ['retry', 'skip', 'stop'], ...payload },
    ...meta
  });

  const userChoice = await new Promise((resolve) => {
    if (context?.waitForUserInput) {
      context.waitForUserInput().then(resolve);
    } else {
      // Fallback if waitForUserInput not available
      resolve('stop');
    }
  });

  const choice = userChoice.toLowerCase().trim();

  if (choice === 'retry' || choice === 'r') {
    // Retry by returning a signal to re-execute
    return { success: false, retry: true };
  } else if (choice === 'skip' || choice === 's') {
    addOutput({
      type: 'info',
      text: 'Skipping failed Loadmill command and continuing...',
      eventType: 'system_message',
      payload,
      ...meta
    });
    return { success: true }; // Continue to next instruction
  } else {
    // Stop execution
    return { success: false, error: `Loadmill command failed: ${command}` };
  }
}

/**
 * Handle a successful Loadmill execution
 * @param {string} command - The executed command
 * @param {Object} result - The execution result
 * @param {Object} context - Execution context
 * @param {Object|null} stepContext - Optional step context metadata
 */
export function handleLoadmillSuccess(command, result, context, stepContext = null) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));
  const meta = {
    runId: context?.runId,
    stepId: stepContext?.stepId,
    instructionIndex: stepContext?.instructionIndex
  };

  const payload = result.runId ? { loadmillSuiteRunId: result.runId, loadmillCommand: command } : { loadmillCommand: command };

  if (result.action === "search") {
    addOutput({ type: 'success', text: `[Loadmill] Found ${result.result.flows.length} flow(s)`, eventType: 'system_message', payload, ...meta });
    result.result.flows.forEach((flow, i) => {
      const name = flow.description || flow.name || "Unknown";
      addOutput({ type: 'info', text: `  ${i + 1}. ${name} (ID: ${flow.id})`, eventType: 'system_message', payload, ...meta });
    });
  } else {
    addOutput({ type: 'success', text: `[Loadmill] Flow "${result.flowName}" passed`, eventType: 'system_message', payload, ...meta });
    if (result.runId) {
      addOutput({ type: 'info', text: `  Run ID: ${result.runId}`, eventType: 'system_message', payload, ...meta });
    }
  }
}
