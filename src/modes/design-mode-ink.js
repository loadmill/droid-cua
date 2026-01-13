import { getScreenshotAsBase64 } from "../device/connection.js";
import { sendCUARequest } from "../device/openai.js";
import { buildDesignModePrompt } from "../core/prompts.js";
import { saveTest } from "../test-store/test-manager.js";

/**
 * Design Mode for Ink - Interactive test design with autonomous exploration
 * Conversation is persistent (messages never cleared)
 * Uses Ink context for input/output instead of readline
 */
export class DesignModeInk {
  constructor(session, executionEngine, testName, context) {
    this.session = session;
    this.engine = executionEngine;
    this.testName = testName;
    this.context = context;
    this.conversationActive = true;
    this.recentActions = []; // Track recent actions for stuck detection
    this.inputQueue = []; // Queue for user inputs during autonomous exploration
    this.waitingForInput = false; // Flag to indicate we're explicitly waiting for input
    this.inputResolver = null; // Promise resolver for input
  }

  /**
   * Start design mode conversation
   * @returns {Promise<void>}
   */
  async start() {
    const addOutput = this.context.addOutput;

    // Set design mode system prompt
    const designPrompt = buildDesignModePrompt(this.session.deviceInfo);
    this.session.setSystemPrompt(designPrompt);

    // Update UI
    if (this.context.setMode) {
      this.context.setMode('design');
    }
    if (this.context.setTestName) {
      this.context.setTestName(this.testName);
    }

    addOutput({ type: 'system', text: `=== Design Mode: Creating test "${this.testName}" ===` });
    addOutput({ type: 'info', text: 'Describe what you want to test. The agent will explore autonomously.' });
    addOutput({ type: 'info', text: 'You can guide or correct the agent at any time by typing naturally.' });
    addOutput({ type: 'info', text: 'When ready, type "generate the script" to create the test.' });
    addOutput({ type: 'info', text: 'Type "cancel" to exit design mode.' });

    // Wait for initial user description
    addOutput({ type: 'system', text: 'What do you want to test?' });
    const initialPrompt = await this.waitForUserInput();

    if (initialPrompt.toLowerCase() === "cancel") {
      addOutput({ type: 'info', text: 'Design mode cancelled.' });
      this.cleanup();
      return;
    }

    // Add initial prompt to conversation
    this.session.addToTranscript(`[Design] ${initialPrompt}`);
    this.session.addMessage("user", initialPrompt);

    // Start conversation loop
    await this.conversationLoop();
  }

  /**
   * Wait for user input - creates a promise that resolves when user types
   */
  async waitForUserInput() {
    // Check if there's already queued input (from interruption)
    if (this.inputQueue.length > 0) {
      return this.inputQueue.shift();
    }

    // Create promise that will be resolved when user types
    return new Promise((resolve) => {
      this.waitingForInput = true;
      this.inputResolver = resolve;

      // Set placeholder to prompt user
      if (this.context.setInputPlaceholder) {
        this.context.setInputPlaceholder('Type your message...');
      }
    });
  }

  /**
   * Handle user input - called from ink-shell when user types
   */
  handleUserInput(input) {
    if (this.waitingForInput && this.inputResolver) {
      // We were explicitly waiting - resolve the promise
      this.inputResolver(input);
      this.waitingForInput = false;
      this.inputResolver = null;

      // Reset placeholder
      if (this.context.setInputPlaceholder) {
        this.context.setInputPlaceholder('Type a command or message...');
      }
    } else {
      // Agent is running autonomously - queue the input for interruption
      this.inputQueue.push(input);
      this.context.addOutput({
        type: 'info',
        text: '💡 Input received - agent will pause and respond...'
      });
    }
  }

  /**
   * Check if agent appears stuck (repeated similar actions)
   */
  checkIfStuck() {
    if (this.recentActions.length < 6) return false;

    // Get last 6 actions
    const last6 = this.recentActions.slice(-6);

    // Count action types
    const actionCounts = {};
    for (const action of last6) {
      actionCounts[action] = (actionCounts[action] || 0) + 1;
    }

    // If any single action type appears 4+ times in last 6 actions, we're stuck
    const maxRepeats = Math.max(...Object.values(actionCounts));
    return maxRepeats >= 4;
  }

  /**
   * Track action for stuck detection
   */
  trackAction(action) {
    // Simplify action to key type (click, type, scroll, wait, key)
    let actionType = action.type;
    if (actionType === "click") {
      actionType = "click";
    } else if (actionType === "type") {
      actionType = "type";
    } else if (actionType === "key") {
      actionType = `key:${action.text || "unknown"}`;
    }

    this.recentActions.push(actionType);

    // Keep only last 10 actions
    if (this.recentActions.length > 10) {
      this.recentActions.shift();
    }

    // Check if user interrupted (new input in queue)
    if (this.inputQueue.length > 0) {
      return true; // Signal to stop execution
    }

    return false; // Continue execution
  }

  /**
   * Main conversation loop for design mode
   */
  async conversationLoop() {
    const addOutput = this.context.addOutput;

    while (this.conversationActive) {
      try {
        // Check for user interruption before starting new turn
        if (this.inputQueue.length > 0) {
          const userInput = this.inputQueue.shift();

          if (userInput.toLowerCase() === "cancel") {
            addOutput({ type: 'info', text: 'Design mode cancelled.' });
            this.conversationActive = false;
            this.cleanup();
            return;
          }

          // User interrupted - add to conversation
          addOutput({ type: 'system', text: '✓ Guidance received, continuing with your input...' });
          this.session.addToTranscript(`[User Guidance] ${userInput}`);
          this.session.addMessage("user", userInput);

          // Reset action tracking and response ID for fresh conversation with guidance
          this.recentActions = [];
          this.session.updateResponseId(null);
          continue;
        }

        // Set agent working status
        if (this.context.setAgentWorking) {
          this.context.setAgentWorking(true, 'Agent is exploring autonomously...');
        }

        // Get screenshot and send to model
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

        // Run turn with action tracking and interruption checking
        const newResponseId = await this.engine.runFullTurn(response, (action) => {
          // Check if user interrupted - stop immediately
          if (this.inputQueue.length > 0) {
            return true; // Signal to stop execution
          }

          // If action is null, this is a pre-batch check
          if (action === null) {
            return false; // Continue execution
          }

          // Track the action
          this.trackAction(action);

          // Check if agent is stuck after each action
          if (this.checkIfStuck()) {
            return true; // Stop for guidance
          }

          return false; // Continue execution
        }, this.context);

        this.session.updateResponseId(newResponseId);

        // Clear agent working status
        if (this.context.setAgentWorking) {
          this.context.setAgentWorking(false);
        }

        // Check if agent is stuck (automatic detection)
        if (this.checkIfStuck()) {
          addOutput({ type: 'error', text: '⚠️ The agent appears to be repeating similar actions without progress.' });
          addOutput({ type: 'info', text: 'Please provide guidance to help the agent, or type "continue" to let it keep trying, or "cancel" to exit.' });

          const guidance = await this.waitForUserInput();

          if (guidance.toLowerCase() === "cancel") {
            addOutput({ type: 'info', text: 'Design mode cancelled.' });
            this.conversationActive = false;
            this.cleanup();
            return;
          }

          // Check if user wants to continue without guidance
          if (guidance.toLowerCase() === "continue" || guidance.toLowerCase() === "ok") {
            addOutput({ type: 'info', text: 'Continuing without new guidance...' });
            this.recentActions = [];
            continue;
          }

          // User provided actual guidance
          addOutput({ type: 'system', text: '✓ Guidance received, continuing with your input...' });
          this.session.addToTranscript(`[User Guidance] ${guidance}`);
          this.session.addMessage("user", guidance);

          // Reset action tracking and response ID for fresh conversation with guidance
          this.recentActions = [];
          this.session.updateResponseId(null);
          continue;
        }

        // Check if agent generated a test script
        const generatedScript = this.extractTestScript(this.session.transcript);
        if (generatedScript) {
          addOutput({ type: 'system', text: '=== Generated Test Script ===' });
          addOutput({ type: 'info', text: generatedScript });
          addOutput({ type: 'system', text: '=============================' });

          // Ask user to confirm
          addOutput({ type: 'system', text: 'Save this test? (yes/no/revise)' });
          const confirm = await this.waitForUserInput();

          if (confirm.toLowerCase() === "yes" || confirm.toLowerCase() === "y") {
            await this.saveGeneratedTest(generatedScript);
            addOutput({ type: 'success', text: `Test saved as: ${this.testName}.dcua` });
            addOutput({ type: 'info', text: `You can run it with: /run ${this.testName}` });
            this.conversationActive = false;
            this.cleanup();
            return;
          } else if (confirm.toLowerCase() === "no" || confirm.toLowerCase() === "n") {
            addOutput({ type: 'info', text: 'Design mode cancelled.' });
            this.conversationActive = false;
            this.cleanup();
            return;
          } else {
            // User wants to revise
            addOutput({ type: 'system', text: 'Revision mode: Describe the changes you want.' });
            const revision = await this.waitForUserInput();

            // Add revision request to conversation
            const revisionPrompt = `Please revise the test script with these changes: ${revision}\n\nRemember to output the revised script in a code block with the correct format (simple instructions, no numbers).`;
            this.session.addToTranscript(`[User] ${revisionPrompt}`);
            this.session.addMessage("user", revisionPrompt);

            // Reset previousResponseId to start fresh conversation thread
            this.session.updateResponseId(null);

            continue; // Go back to conversation loop
          }
        }

        // Get next user input
        const userInput = await this.waitForUserInput();

        if (userInput.toLowerCase() === "cancel") {
          addOutput({ type: 'info', text: 'Design mode cancelled.' });
          this.conversationActive = false;
          this.cleanup();
          return;
        }

        // Add to conversation (persistent - never cleared)
        this.session.addToTranscript(`[User] ${userInput}`);
        this.session.addMessage("user", userInput);

      } catch (err) {
        addOutput({ type: 'error', text: `⚠️ Error in design mode: ${err.message}` });

        if (err.message && err.message.includes("400")) {
          addOutput({ type: 'info', text: 'This is likely due to conversation state becoming too complex.' });
          addOutput({ type: 'info', text: 'The conversation state has been reset. You can try again.' });
        }

        addOutput({ type: 'system', text: 'Retry? (yes/no)' });
        const retry = await this.waitForUserInput();

        if (retry.toLowerCase() !== "yes" && retry.toLowerCase() !== "y") {
          this.conversationActive = false;
          this.cleanup();
          return;
        }

        // Clear the last user message that caused the error
        if (this.session.messages.length > 0) {
          this.session.messages.pop();
        }

        // Reset previousResponseId to start fresh conversation thread
        this.session.updateResponseId(null);

        // Reset action tracking
        this.recentActions = [];
      }
    }
  }

  /**
   * Extract test script from transcript
   * Looks for code blocks with test instructions
   * Returns the LAST (most recent) code block found
   */
  extractTestScript(transcript) {
    const transcriptText = transcript.join("\n");

    // Find ALL code blocks (global match)
    // Handles both ``` and ```language formats
    const codeBlockRegex = /```(?:\w+)?\s*\n([\s\S]*?)\n```/g;
    const matches = [...transcriptText.matchAll(codeBlockRegex)];

    if (matches.length > 0) {
      // Return the LAST match (most recent script)
      const lastMatch = matches[matches.length - 1];
      return lastMatch[1].trim();
    }

    return null;
  }

  /**
   * Save generated test to file
   */
  async saveGeneratedTest(script) {
    await saveTest(this.testName, script);
  }

  /**
   * Cleanup when exiting design mode
   */
  cleanup() {
    // Clear design mode reference from context FIRST
    // (unconditionally, since this design mode is exiting)
    if (this.context.setActiveDesignMode) {
      this.context.setActiveDesignMode(null);
    }

    // Reset mode
    if (this.context.setMode) {
      this.context.setMode('command');
    }
    if (this.context.setTestName) {
      this.context.setTestName(null);
    }
    if (this.context.setAgentWorking) {
      this.context.setAgentWorking(false);
    }
    if (this.context.setInputPlaceholder) {
      this.context.setInputPlaceholder('Type a command or message...');
    }
  }
}
