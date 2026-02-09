import { getScreenshotAsBase64, connectToDevice, getDeviceInfo, getCurrentPlatform } from "../device/connection.js";
import { sendCUARequest } from "../device/openai.js";
import {
  isAssertion,
  extractAssertionPrompt,
  buildAssertionSystemPrompt,
  checkAssertionResult,
  handleAssertionFailure,
  handleAssertionSuccess,
} from "../device/assertions.js";
import {
  isLoadmillInstruction,
  extractLoadmillCommand,
  executeLoadmillInstruction,
} from "../device/loadmill.js";
import { logger } from "../utils/logger.js";

/**
 * Execution Mode - Run test scripts line-by-line
 * Each instruction is executed in isolation (messages cleared after each turn)
 */
export class ExecutionMode {
  constructor(session, executionEngine, instructions, isHeadlessMode = false) {
    this.session = session;
    this.engine = executionEngine;
    this.instructions = instructions; // Array of instruction strings
    this.initialSystemText = session.systemPrompt;
    this.shouldStop = false; // Flag to stop execution (set by /stop command)
    this.isHeadlessMode = isHeadlessMode; // true for CI/automated runs, false for interactive
  }

  /**
   * Execute all instructions in the test script
   * @param {Object} context - Additional context (Ink context with addOutput)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async execute(context = {}) {
    const addOutput = context.addOutput || ((item) => console.log(item.text || item));

    for (let i = 0; i < this.instructions.length; i++) {
      // Check if execution should be stopped
      if (this.shouldStop) {
        addOutput({ type: 'info', text: 'Test execution stopped by user.' });
        return { success: false, error: 'Stopped by user' };
      }

      const instruction = this.instructions[i];
      addOutput({ type: 'user', text: instruction });

      // Check for exit command
      if (instruction.toLowerCase() === "exit") {
        addOutput({ type: 'success', text: 'Test completed.' });
        return { success: true };
      }

      try {
        const result = await this.executeInstruction(instruction, context);
        if (!result.success) {
          return result; // Propagate failure
        }
      } catch (err) {
        // Log full error details to file
        logger.error('Execution mode error', {
          instruction,
          message: err.message,
          status: err.status,
          code: err.code,
          type: err.type,
          error: err.error,
          stack: err.stack
        });

        // Show user-friendly error message
        addOutput({ type: 'error', text: `Error executing instruction: ${instruction}` });
        addOutput({ type: 'error', text: err.message });
        addOutput({ type: 'info', text: 'Full error details have been logged to the debug log.' });
        return { success: false, error: err.message };
      }
    }

    addOutput({ type: 'success', text: 'Test completed successfully.' });
    return { success: true };
  }

  /**
   * Execute a single instruction
   * @param {string} instruction - The instruction to execute
   * @param {Object} context - Additional context
   * @param {number} retryCount - Current retry attempt (internal use)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async executeInstruction(instruction, context, retryCount = 0) {
    const MAX_RETRIES = 3;
    const addOutput = context.addOutput || ((item) => console.log(item.text || item));

    // ── Check for Loadmill instruction ──
    if (isLoadmillInstruction(instruction)) {
      const loadmillCommand = extractLoadmillCommand(instruction);
      this.session.addToTranscript(`[Loadmill] ${loadmillCommand}`);

      const result = await executeLoadmillInstruction(
        loadmillCommand,
        this.isHeadlessMode,
        context
      );

      // Handle retry request from interactive mode
      if (result.retry) {
        return await this.executeInstruction(instruction, context);
      }

      return result;
    }

    // ── Check for assertion ──
    const isAssertionStep = isAssertion(instruction);
    let assertionPrompt = null;

    if (isAssertionStep) {
      assertionPrompt = extractAssertionPrompt(instruction);
      const assertionSystemPrompt = buildAssertionSystemPrompt(
        this.initialSystemText,
        assertionPrompt
      );

      this.session.clearMessages();
      this.session.addMessage("system", assertionSystemPrompt);
      this.session.addToTranscript(`[Assertion] ${assertionPrompt}`);
      this.session.addMessage("user", `Validate this assertion: ${assertionPrompt}`);
    } else {
      this.session.addToTranscript(`[User] ${instruction}`);
      this.session.addMessage("user", instruction);
    }

    try {
      const screenshotBase64 = await getScreenshotAsBase64(
        this.session.deviceId,
        this.session.deviceInfo
      );

      // When continuing with previousResponseId, only send the new instruction
      // The server already has full context from previous responses
      let messagesToSend;
      if (this.session.previousResponseId && !isAssertionStep) {
        // Only send the new user instruction
        messagesToSend = [{ role: "user", content: instruction }];
      } else {
        // Fresh start or assertion - send full messages (system + user)
        messagesToSend = this.session.messages;
      }

      const response = await sendCUARequest({
        messages: messagesToSend,
        screenshotBase64,
        previousResponseId: this.session.previousResponseId,
        deviceInfo: this.session.deviceInfo,
      });

      const newResponseId = await this.engine.runFullTurn(response, null, context);
      this.session.updateResponseId(newResponseId);

      // ── Check assertion result ──
      if (isAssertionStep) {
        const result = checkAssertionResult(this.session.transcript);

        if (result.failed) {
          handleAssertionFailure(
            assertionPrompt,
            this.session.transcript,
            false, // Never exit process - we'll always prompt the user in interactive mode
            context
          );

          // In headless mode, exit immediately on assertion failure
          if (this.isHeadlessMode) {
            return { success: false, error: `Assertion failed: ${assertionPrompt}` };
          }

          // Interactive mode - ask user what to do
          addOutput({ type: 'system', text: 'What would you like to do? (retry/skip/stop)' });

          // Wait for user input
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
            // Retry the same instruction by recursing
            return await this.executeInstruction(instruction, context);
          } else if (choice === 'skip' || choice === 's') {
            // Continue to next instruction
            addOutput({ type: 'info', text: 'Skipping failed assertion and continuing...' });
          } else {
            // Stop execution
            return { success: false, error: `Assertion failed: ${assertionPrompt}` };
          }
        } else if (result.passed) {
          handleAssertionSuccess(assertionPrompt, context);
        }
      }

      // Clear messages after each turn but KEEP the response chain for context
      // When continuing with previousResponseId, only send new user message (not system)
      this.session.clearMessages();
      // Note: we keep previousResponseId to maintain context across the test
      return { success: true };
    } catch (err) {
      // Log full error details to file
      logger.error('Execution instruction error', {
        instruction,
        retryCount,
        message: err.message,
        status: err.status,
        code: err.code,
        type: err.type,
        error: err.error,
        stack: err.stack
      });

      const addOutput = context.addOutput || ((item) => console.log(item.text || item));

      // Check if we've exceeded max retries
      if (retryCount >= MAX_RETRIES) {
        addOutput({ type: 'error', text: `Failed after ${MAX_RETRIES} retries. Device may be disconnected.` });

        // Attempt to reconnect to the device
        addOutput({ type: 'info', text: 'Attempting to reconnect to device...' });
        try {
          const platform = getCurrentPlatform();
          const deviceName = this.session.deviceName || undefined;
          const deviceId = await connectToDevice(deviceName, platform);
          const deviceInfo = await getDeviceInfo(deviceId);

          // Update session with new connection
          this.session.deviceId = deviceId;
          this.session.deviceInfo = deviceInfo;

          addOutput({ type: 'success', text: 'Reconnected to device. Resuming...' });

          // Reset retry count and try again
          return await this.executeInstruction(instruction, context, 0);
        } catch (reconnectErr) {
          logger.error('Failed to reconnect to device', { error: reconnectErr.message });
          addOutput({ type: 'error', text: `Could not reconnect to device: ${reconnectErr.message}` });
          return { success: false, error: 'Device disconnected and reconnection failed' };
        }
      }

      addOutput({ type: 'info', text: `Connection issue. Retrying... (${retryCount + 1}/${MAX_RETRIES})` });

      // Build context for retry - include transcript in system message to avoid conversational responses
      const transcriptContext = this.session.getTranscriptText();

      this.session.clearMessages();
      // clearMessages() restores the base system prompt, but we need to add context

      // Build enhanced system prompt with recovery context
      let recoverySystemPrompt = this.initialSystemText;
      if (transcriptContext) {
        recoverySystemPrompt += `\n\n[SESSION RECOVERY - Connection was lost. Previous actions completed before the error:]\n${transcriptContext}\n\n[IMPORTANT: Resume execution silently. Do NOT narrate or explain. Just execute the next instruction.]`;
      }

      // Replace the system message with the enhanced one
      this.session.messages = [{ role: "system", content: recoverySystemPrompt }];
      this.session.updateResponseId(undefined);

      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Retry the same instruction with incremented counter
      return await this.executeInstruction(instruction, context, retryCount + 1);
    }
  }
}
