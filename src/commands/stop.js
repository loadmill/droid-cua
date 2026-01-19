/**
 * Stop command handler - stops current test creation or execution
 */

/**
 * Handle /stop command
 * @param {string} args - Command arguments (unused)
 * @param {Object} session - Current session
 * @param {Object} context - Additional context
 * @returns {Promise<boolean>} - true to continue loop
 */
export async function handleStop(args, session, context) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));

  // Check if we're in design mode
  if (context.activeDesignMode) {
    addOutput({ type: 'info', text: 'Stopping test creation...' });

    // Signal design mode to stop by queuing "cancel"
    context.activeDesignMode.handleUserInput('cancel');

    return true; // Continue loop
  }

  // Check if we're in execution mode
  if (context.isExecutionMode) {
    addOutput({ type: 'info', text: 'Stopping test execution...' });

    // Set flag to stop execution
    if (context.activeExecutionMode) {
      context.activeExecutionMode.shouldStop = true;
    }

    return true; // Continue loop
  }

  // Not in any mode that can be stopped
  addOutput({ type: 'info', text: 'No active test creation or execution to stop.' });

  return true; // Continue loop
}
