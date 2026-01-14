import readline from "readline";
import { getScreenshotAsBase64 } from "../device/connection.js";
import { sendCUARequest, reviseTestScript } from "../device/openai.js";
import { buildDesignModePrompt } from "../core/prompts.js";
import { saveTest } from "../test-store/test-manager.js";
import { logger } from "../utils/logger.js";

/**
 * Design Mode - Interactive test design with autonomous exploration
 * Conversation is persistent (messages never cleared)
 */
export class DesignMode {
  constructor(session, executionEngine, testName) {
    this.session = session;
    this.engine = executionEngine;
    this.testName = testName;
    this.conversationActive = true;
    this.escPressed = false;
    this.recentActions = []; // Track recent actions for stuck detection
    this.initialUserPrompt = null; // Store initial prompt for error recovery
  }

  /**
   * Start design mode conversation
   * @param {Object} context - Additional context (rl)
   * @returns {Promise<void>}
   */
  async start(context) {
    // Set design mode system prompt
    const designPrompt = buildDesignModePrompt(this.session.deviceInfo);
    this.session.setSystemPrompt(designPrompt);

    console.log(`\n=== Design Mode: Creating test "${this.testName}" ===`);
    console.log("Describe what you want to test. The agent will explore autonomously.");
    console.log('When ready, type "generate the script" to create the test.');
    console.log('Type "cancel" to exit design mode.');
    console.log('\n💡 Tip: Press ESC at any time to interrupt and provide guidance.\n');

    // Get initial user description
    const initialPrompt = await this.promptUser(context.rl, "What do you want to test? ");

    if (initialPrompt.toLowerCase() === "cancel") {
      console.log("Design mode cancelled.");
      return;
    }

    // Store for error recovery
    this.initialUserPrompt = initialPrompt;

    // Add initial prompt to conversation
    this.session.addToTranscript(`[Design] ${initialPrompt}`);
    this.session.addMessage("user", initialPrompt);

    // Start conversation loop
    await this.conversationLoop(context);
  }

  /**
   * Check if agent appears stuck (repeated similar actions)
   */
  checkIfStuck() {
    if (this.recentActions.length < 10) return false;

    // Get last 10 actions
    const last10 = this.recentActions.slice(-10);

    // Count action types
    const actionCounts = {};
    for (const action of last10) {
      actionCounts[action] = (actionCounts[action] || 0) + 1;
    }

    // If any single action type appears 6+ times in last 10 actions, we're stuck
    const maxRepeats = Math.max(...Object.values(actionCounts));
    return maxRepeats >= 6;
  }

  /**
   * Track action for stuck detection
   */
  trackAction(action) {
    // Simplify action to key type (click, type, scroll, wait, key)
    let actionType = action.type;

    // Exclude scroll from repeat detection (scrolling long pages is normal)
    if (actionType === "scroll") {
      return;
    }

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
  }

  /**
   * Setup ESC key detection using readline's keypress events
   * This is cleaner than raw mode and doesn't conflict with readline
   */
  setupEscDetection() {
    if (!process.stdin.isTTY) return null;

    // Enable keypress events on stdin
    readline.emitKeypressEvents(process.stdin);

    // Set raw mode temporarily for keypress detection
    process.stdin.setRawMode(true);

    const keypressHandler = (str, key) => {
      if (key && key.name === 'escape' && !this.escPressed) {
        this.escPressed = true;
        console.log("\n[ESC pressed - stopping after current action...]");
      }
    };

    process.stdin.on('keypress', keypressHandler);
    return keypressHandler;
  }

  /**
   * Cleanup ESC detection and restore stdin to normal state
   */
  cleanupEscDetection(keypressHandler) {
    if (!process.stdin.isTTY) return;

    try {
      // Remove keypress handler
      if (keypressHandler) {
        process.stdin.removeListener('keypress', keypressHandler);
      }

      // Exit raw mode
      if (process.stdin.isRaw) {
        process.stdin.setRawMode(false);
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  /**
   * Main conversation loop for design mode
   */
  async conversationLoop(context) {
    while (this.conversationActive) {
      try {
        // Reset ESC flag
        this.escPressed = false;

        // Setup ESC detection
        console.log("\n[Agent is running - press ESC to interrupt]");
        const keypressHandler = this.setupEscDetection();

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
          // Check if user pressed ESC - stop immediately
          if (this.escPressed) {
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
            // Set flag to stop after this action completes
            this.session._shouldStopForGuidance = true;
          }

          return false; // Continue execution
        });

        this.session.updateResponseId(newResponseId);

        // Cleanup ESC detection
        this.cleanupEscDetection(keypressHandler);

        // Check if user pressed ESC
        if (this.escPressed) {
          // Small delay for stdin to settle
          await new Promise(resolve => setTimeout(resolve, 100));

          console.log("\n⏸️  Agent paused. Provide your guidance:");

          const guidance = await this.promptUser(context.rl, "> ");

          if (guidance.toLowerCase() === "cancel") {
            console.log("Design mode cancelled.");
            this.conversationActive = false;
            return;
          }

          // Check if user just wants to continue
          if (guidance.toLowerCase() === "continue" || guidance.toLowerCase() === "ok" || guidance.trim() === "") {
            console.log("Continuing...\n");
            continue;
          }

          // User provided guidance
          console.log("✓ Guidance received, continuing with your input...\n");
          this.session.addToTranscript(`[User Guidance] ${guidance}`);
          this.session.addMessage("user", guidance);

          // Reset action tracking and response ID for fresh conversation with guidance
          this.recentActions = [];
          this.session.updateResponseId(null);
          continue;
        }

        // Check if agent is stuck (automatic detection as safety net)
        if (this.session._shouldStopForGuidance || this.checkIfStuck()) {
          this.session._shouldStopForGuidance = false;

          console.log("\n\n⚠️  The agent appears to be repeating similar actions without progress.");
          console.log("Options:");
          console.log("  - Type guidance to help the agent (e.g., 'click the + button to open new tab')");
          console.log("  - Type 'continue' to let the agent keep trying");
          console.log("  - Type 'cancel' to exit\n");

          const guidance = await this.promptUser(context.rl, "> ");

          if (guidance.toLowerCase() === "cancel") {
            console.log("Design mode cancelled.");
            this.conversationActive = false;
            return;
          }

          // Check if user wants to continue without guidance
          if (guidance.toLowerCase() === "continue" || guidance.toLowerCase() === "ok" ||
              guidance.toLowerCase() === "it is ok, continue") {
            console.log("Continuing without new guidance...\n");
            // Reset action tracking but keep conversation context
            this.recentActions = [];
            // Don't reset previousResponseId or add to messages
            continue;
          }

          // User provided actual guidance
          console.log("✓ Guidance received, continuing with your input...\n");
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
          console.log("\n=== Generated Test Script ===");
          console.log(generatedScript);
          console.log("=============================\n");

          // Ask user to confirm
          let confirm = await this.promptUser(
            context.rl,
            "Save this test? (yes/no or type changes): "
          );

          if (confirm.toLowerCase() === "yes" || confirm.toLowerCase() === "y") {
            await this.saveGeneratedTest(generatedScript);
            console.log(`\n✓ Test saved as: ${this.testName}.dcua`);
            console.log("You can run it with: /run " + this.testName);
            this.conversationActive = false;
            return;
          } else if (confirm.toLowerCase() === "no" || confirm.toLowerCase() === "n") {
            console.log("Design mode cancelled.");
            this.conversationActive = false;
            return;
          } else {
            // User typed changes directly - use simple text revision (no CUA)
            let currentScript = generatedScript;
            let revising = true;

            while (revising) {
              // Use whatever the user typed as the revision
              const revision = confirm;

              // Use simple chat completion for revision instead of CUA
              console.log("Revising test script...");
              currentScript = await reviseTestScript(currentScript, revision);

              // Display the revised script
              console.log("\n=== Generated Test Script ===");
              console.log(currentScript);
              console.log("=============================\n");

              // Ask again
              confirm = await this.promptUser(
                context.rl,
                "Save this test? (yes/no or type changes): "
              );

              if (confirm.toLowerCase() === "yes" || confirm.toLowerCase() === "y") {
                await this.saveGeneratedTest(currentScript);
                console.log(`\n✓ Test saved as: ${this.testName}.dcua`);
                console.log("You can run it with: /run " + this.testName);
                this.conversationActive = false;
                return;
              } else if (confirm.toLowerCase() === "no" || confirm.toLowerCase() === "n") {
                console.log("Design mode cancelled.");
                this.conversationActive = false;
                return;
              }
              // If user typed anything else (including 'revise'), the while loop continues with new confirm value
            }
          }
        }

        // Get next user input
        const userInput = await this.promptUser(context.rl, "> ");

        if (userInput.toLowerCase() === "cancel") {
          console.log("Design mode cancelled.");
          this.conversationActive = false;
          return;
        }

        // Add to conversation (persistent - never cleared)
        this.session.addToTranscript(`[User] ${userInput}`);
        this.session.addMessage("user", userInput);

      } catch (err) {
        // Ensure stdin is reset on error
        this.cleanupEscDetection(null);

        // Log full error details to file
        logger.error('Design mode error', {
          message: err.message,
          status: err.status,
          code: err.code,
          type: err.type,
          error: err.error,
          stack: err.stack
        });

        // Show user-friendly error message
        console.error("\n⚠️ Error in design mode:", err.message);

        // Automatic recovery - continue from where we left off using transcript
        console.log("\nRecovering from error and continuing...");

        // Build recovery context with transcript
        const designPrompt = buildDesignModePrompt(this.session.deviceInfo);
        const recoveryContext = `${designPrompt}

RECOVERY MODE:
The previous session encountered an error and was interrupted. Here is everything that happened so far:

${this.session.getTranscriptText()}

Continue from where we left off and complete the original task: "${this.initialUserPrompt}"

Remember:
- Don't repeat actions that already succeeded
- Continue towards generating the test script
- If the flow was complete before the error, generate the script now`;

        // Reset conversation state for fresh API call
        this.session.clearMessages();
        this.session.addMessage("system", recoveryContext);
        this.session.updateResponseId(null);

        // Reset action tracking
        this.recentActions = [];

        // Continue the loop - will automatically get next response
        continue;
      }
    }

    // Final cleanup on exit
    this.cleanupEscDetection(null);
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
   * Prompt user for input
   */
  async promptUser(rl, prompt) {
    return (await rl.question(prompt)).trim();
  }
}
