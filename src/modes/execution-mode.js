import { getScreenshotAsBase64 } from "../device/connection.js";
import { sendCUARequest } from "../device/openai.js";
import {
  isAssertion,
  extractAssertionPrompt,
  buildAssertionSystemPrompt,
  checkAssertionResult,
  handleAssertionFailure,
  handleAssertionSuccess,
} from "../device/assertions.js";

/**
 * Execution Mode - Run test scripts line-by-line
 * Each instruction is executed in isolation (messages cleared after each turn)
 */
export class ExecutionMode {
  constructor(session, executionEngine, instructions) {
    this.session = session;
    this.engine = executionEngine;
    this.instructions = instructions; // Array of instruction strings
    this.initialSystemText = session.systemPrompt;
    this.isHeadlessMode = true; // Execution mode is always considered "headless" for assertions
  }

  /**
   * Execute all instructions in the test script
   * @param {Object} context - Additional context (rl for readline interface)
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async execute(context = {}) {
    for (let i = 0; i < this.instructions.length; i++) {
      const instruction = this.instructions[i];
      console.log(`> ${instruction}`);

      // Check for exit command
      if (instruction.toLowerCase() === "exit") {
        console.log("Test completed.");
        return { success: true };
      }

      try {
        const result = await this.executeInstruction(instruction, context);
        if (!result.success) {
          return result; // Propagate failure
        }
      } catch (err) {
        console.error(`Error executing instruction: ${instruction}`);
        console.error(err.message);
        return { success: false, error: err.message };
      }
    }

    console.log("Test completed successfully.");
    return { success: true };
  }

  /**
   * Execute a single instruction
   * @param {string} instruction - The instruction to execute
   * @param {Object} context - Additional context
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async executeInstruction(instruction, context) {
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

      const response = await sendCUARequest({
        messages: this.session.messages,
        screenshotBase64,
        previousResponseId: this.session.previousResponseId,
        deviceInfo: this.session.deviceInfo,
      });

      const newResponseId = await this.engine.runFullTurn(response);
      this.session.updateResponseId(newResponseId);

      // ── Check assertion result ──
      if (isAssertionStep) {
        const result = checkAssertionResult(this.session.transcript);

        if (result.failed) {
          handleAssertionFailure(
            assertionPrompt,
            this.session.transcript,
            this.isHeadlessMode,
            context.rl
          );
          return { success: false, error: `Assertion failed: ${assertionPrompt}` };
        } else if (result.passed) {
          handleAssertionSuccess(assertionPrompt);
        }
      }

      // Clear messages after each turn (isolated execution)
      this.session.clearMessages();
      return { success: true };
    } catch (err) {
      console.log("⚠️ OpenAI request failed. Resetting context and trying again.");

      const summary = `The last session failed. Let's try again based on the last user message.
      Here's a transcript of everything that happened so far:
      \n\n${this.session.getTranscriptText()}\n\n${this.initialSystemText}`;

      this.session.clearMessages();
      this.session.addMessage("system", summary);
      this.session.updateResponseId(undefined);

      // Retry the same instruction
      return await this.executeInstruction(instruction, context);
    }
  }
}
