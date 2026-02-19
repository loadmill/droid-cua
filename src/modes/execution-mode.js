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
import { emitDesktopDebug } from "../utils/desktop-debug.js";

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

    // Stats tracking
    this.stats = {
      startTime: null,
      actionCount: 0,
      instructionsCompleted: 0,
      retryCount: 0,
      assertionsPassed: 0,
      assertionsFailed: 0,
    };
  }

  /**
   * Format duration in human-readable format (Xm Ys)
   */
  formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Format stats for display
   */
  formatStats() {
    const duration = Date.now() - this.stats.startTime;
    const instructionCount = this.instructions.length;
    const totalAssertions = this.stats.assertionsPassed + this.stats.assertionsFailed;

    const lines = [
      '',
      `  Duration:     ${this.formatDuration(duration)}`,
      `  Steps:        ${this.stats.actionCount} actions (${instructionCount} instructions)`,
    ];

    if (totalAssertions > 0) {
      lines.push(`  Assertions:   ${this.stats.assertionsPassed}/${totalAssertions} passed`);
    }

    lines.push(`  Retries:      ${this.stats.retryCount}`);

    return lines;
  }

  buildStepContext(instructionIndex) {
    return {
      instructionIndex,
      stepId: `step-${String(instructionIndex + 1).padStart(4, "0")}`,
    };
  }

  emit(addOutput, type, text, context = {}, stepContext = null, extra = {}) {
    addOutput({
      type,
      text,
      eventType: extra.eventType,
      actionType: extra.actionType,
      runId: context?.runId,
      stepId: stepContext?.stepId,
      instructionIndex: stepContext?.instructionIndex,
      payload: extra.payload
    });
  }

  /**
   * Execute all instructions in the test script
   * @param {Object} context - Additional context (Ink context with addOutput)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async execute(context = {}) {
    const runContext = {
      ...context,
      runId: context.runId || `run-${Date.now()}`
    };
    const addOutput = runContext.addOutput || ((item) => console.log(item.text || item));

    // Start timing
    this.stats.startTime = Date.now();

    for (let i = 0; i < this.instructions.length; i++) {
      const stepContext = this.buildStepContext(i);
      // Check if execution should be stopped
      if (this.shouldStop) {
        this.emit(addOutput, 'info', 'Test execution stopped by user.', runContext, stepContext, {
          eventType: 'system_message'
        });
        return { success: false, error: 'Stopped by user' };
      }

      const instruction = this.instructions[i];
      this.emit(addOutput, 'user', instruction, runContext, stepContext, {
        eventType: 'instruction_started',
        payload: {
          instruction,
          isAssertion: isAssertion(instruction)
        }
      });

      // Check for exit command
      if (instruction.toLowerCase() === "exit") {
        this.stats.instructionsCompleted++;
        this.emit(addOutput, 'success', 'Test completed.', runContext, stepContext, {
          eventType: 'system_message'
        });
        return { success: true };
      }

      try {
        const result = await this.executeInstruction(instruction, runContext, 0, stepContext);
        if (!result.success) {
          return result; // Propagate failure
        }
        this.stats.instructionsCompleted++;
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
        this.emit(addOutput, 'error', `Error executing instruction: ${instruction}`, runContext, stepContext, {
          eventType: 'error',
          payload: {
            instruction,
            message: err.message,
            status: err.status,
            code: err.code
          }
        });
        this.emit(addOutput, 'error', err.message, runContext, stepContext, {
          eventType: 'error',
          payload: {
            message: err.message,
            status: err.status,
            code: err.code
          }
        });
        this.emit(addOutput, 'info', 'Full error details have been logged to the debug log.', runContext, stepContext, {
          eventType: 'system_message'
        });
        return { success: false, error: err.message };
      }
    }

    this.emit(addOutput, 'success', 'Test completed successfully.', runContext, null, {
      eventType: 'system_message'
    });

    // Display stats
    for (const line of this.formatStats()) {
      addOutput({ type: 'info', text: line });
    }

    return { success: true };
  }

  /**
   * Execute a single instruction
   * @param {string} instruction - The instruction to execute
   * @param {Object} context - Additional context
   * @param {number} retryCount - Current retry attempt (internal use)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async executeInstruction(instruction, context, retryCount = 0, stepContext = null) {
    const MAX_RETRIES = 3;
    const addOutput = context.addOutput || ((item) => console.log(item.text || item));

    // ── Check for Loadmill instruction ──
    if (isLoadmillInstruction(instruction)) {
      const loadmillCommand = extractLoadmillCommand(instruction);
      this.session.addToTranscript(`[Loadmill] ${loadmillCommand}`);

      const result = await executeLoadmillInstruction(
        loadmillCommand,
        this.isHeadlessMode,
        context,
        stepContext
      );

      // Handle retry request from interactive mode
      if (result.retry) {
        this.stats.retryCount++;
        return await this.executeInstruction(instruction, context, 0, stepContext);
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
        debugContext: {
          scope: "execution",
          runId: context?.runId,
          stepId: stepContext?.stepId,
          instructionIndex: stepContext?.instructionIndex
        }
      });

      // Track actions for stats
      const trackAction = (action) => {
        if (action && action.type !== 'screenshot') {
          this.stats.actionCount++;
        }
        return false; // Don't stop execution
      };

      const newResponseId = await this.engine.runFullTurn(response, trackAction, context, stepContext);
      this.session.updateResponseId(newResponseId);

      // ── Check assertion result ──
      if (isAssertionStep) {
        const result = checkAssertionResult(this.session.transcript);

        if (result.failed) {
          handleAssertionFailure(
            assertionPrompt,
            this.session.transcript,
            false, // Never exit process - we'll always prompt the user in interactive mode
            context,
            stepContext
          );

          // In headless mode, exit immediately on assertion failure
          if (this.isHeadlessMode) {
            this.stats.assertionsFailed++;
            return { success: false, error: `Assertion failed: ${assertionPrompt}` };
          }

          // Interactive mode - ask user what to do
          this.emit(addOutput, 'system', 'What would you like to do? (retry/skip/stop)', context, stepContext, {
            eventType: 'input_request',
            payload: {
              options: ['retry', 'skip', 'stop']
            }
          });

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
            this.stats.retryCount++;
            return await this.executeInstruction(instruction, context, 0, stepContext);
          } else if (choice === 'skip' || choice === 's') {
            // Continue to next instruction
            this.stats.assertionsFailed++;
            this.emit(addOutput, 'info', 'Skipping failed assertion and continuing...', context, stepContext, {
              eventType: 'system_message'
            });
          } else {
            // Stop execution
            this.stats.assertionsFailed++;
            return { success: false, error: `Assertion failed: ${assertionPrompt}` };
          }
        } else if (result.passed) {
          this.stats.assertionsPassed++;
          handleAssertionSuccess(assertionPrompt, context, stepContext);
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
        emitDesktopDebug(
          "reconnect.attempt",
          "device",
          {
            runId: context?.runId,
            stepId: stepContext?.stepId,
            instructionIndex: stepContext?.instructionIndex
          },
          {
            stage: "start",
            reason: err.message,
            attemptsExhausted: retryCount,
            maxRetries: MAX_RETRIES
          }
        );
        this.emit(addOutput, 'error', `Failed after ${MAX_RETRIES} retries. Device may be disconnected.`, context, stepContext, {
          eventType: 'error',
          payload: {
            message: `Failed after ${MAX_RETRIES} retries. Device may be disconnected.`,
            attempt: retryCount,
            maxRetries: MAX_RETRIES
          }
        });

        // Attempt to reconnect to the device
        this.emit(addOutput, 'info', 'Attempting to reconnect to device...', context, stepContext, {
          eventType: 'system_message'
        });
        try {
          const platform = getCurrentPlatform();
          const deviceName = this.session.deviceName || undefined;
          const deviceId = await connectToDevice(deviceName, platform);
          const deviceInfo = await getDeviceInfo(deviceId);

          // Update session with new connection
          this.session.deviceId = deviceId;
          this.session.deviceInfo = deviceInfo;

          emitDesktopDebug(
            "reconnect.attempt",
            "device",
            {
              runId: context?.runId,
              stepId: stepContext?.stepId,
              instructionIndex: stepContext?.instructionIndex
            },
            {
              stage: "success",
              deviceId
            }
          );

          this.emit(addOutput, 'success', 'Reconnected to device. Resuming...', context, stepContext, {
            eventType: 'system_message'
          });

          // Reset retry count and try again
          return await this.executeInstruction(instruction, context, 0, stepContext);
        } catch (reconnectErr) {
          emitDesktopDebug(
            "reconnect.attempt",
            "device",
            {
              runId: context?.runId,
              stepId: stepContext?.stepId,
              instructionIndex: stepContext?.instructionIndex
            },
            {
              stage: "failed",
              message: reconnectErr.message
            }
          );
          logger.error('Failed to reconnect to device', { error: reconnectErr.message });
          this.emit(addOutput, 'error', `Could not reconnect to device: ${reconnectErr.message}`, context, stepContext, {
            eventType: 'error',
            payload: {
              message: reconnectErr.message
            }
          });
          return { success: false, error: 'Device disconnected and reconnection failed' };
        }
      }

      this.emit(addOutput, 'info', `Connection issue. Retrying... (${retryCount + 1}/${MAX_RETRIES})`, context, stepContext, {
        eventType: 'retry',
        payload: {
          attempt: retryCount + 1,
          maxRetries: MAX_RETRIES,
          reason: err.message
        }
      });

      emitDesktopDebug(
        "retry.attempt",
        "device",
        {
          runId: context?.runId,
          stepId: stepContext?.stepId,
          instructionIndex: stepContext?.instructionIndex
        },
        {
          attempt: retryCount + 1,
          maxRetries: MAX_RETRIES,
          reason: err.message
        }
      );
      emitDesktopDebug(
        "device.disconnect",
        "device",
        {
          runId: context?.runId,
          stepId: stepContext?.stepId,
          instructionIndex: stepContext?.instructionIndex
        },
        {
          reason: err.message
        }
      );

      // Track retry for stats
      this.stats.retryCount++;

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
      return await this.executeInstruction(instruction, context, retryCount + 1, stepContext);
    }
  }
}
