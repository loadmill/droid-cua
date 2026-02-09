import path from "path";
import { writeFile } from "fs/promises";
import { getScreenshotAsBase64, getCurrentPlatform } from "../device/connection.js";
import { handleModelAction } from "../device/actions.js";
import { sendCUARequest } from "../device/openai.js";

export class ExecutionEngine {
  constructor(session, options = {}) {
    this.session = session;
    this.recordScreenshots = options.recordScreenshots || false;
    this.screenshotDir = options.screenshotDir || null;
  }

  /**
   * Run a full turn with the CUA model
   * Executes actions until the model stops requesting actions
   * Returns the new response ID for chaining
   * @param {Object} response - The CUA response
   * @param {Function} trackAction - Optional callback to track actions for stuck detection
   * @param {Object} context - Optional Ink context for output
   */
  async runFullTurn(response, trackAction = null, context = null) {
    const addOutput = context?.addOutput || ((item) => console.log(item.text || item));
    let newResponseId = response.id;

    while (true) {
      // Check for interruption before processing next batch of actions
      if (trackAction) {
        const shouldStop = trackAction(null); // null action = pre-batch check
        if (shouldStop) {
          return newResponseId;
        }
      }

      const items = response.output || [];
      const actions = items.filter(item => item.type === "computer_call");

      // ── Collect pending safety checks ──
      const pendingSafetyChecks = items
        .filter(item => item.type === "pending_safety_check")
        .map(item => ({ id: item.id }));

      // ── Print assistant output ──
      for (const item of items) {
        if (item.type === "reasoning") {
          for (const entry of item.summary) {
            if (entry.type === "summary_text") {
              addOutput({ type: 'reasoning', text: entry.text });
              this.session.addToTranscript(`[Reasoning] ${entry.text}`);
            }
          }
        } else if (item.type === "message") {
          const textPart = item.content.find(c => c.type === "output_text");
          if (textPart) {
            addOutput({ type: 'assistant', text: textPart.text });
            this.session.addToTranscript(`[Assistant] ${textPart.text}`);
          }
        } else if (item.type === "pending_safety_check") {
          addOutput({ type: 'warning', text: `⚠️ Safety check: ${item.code} - ${item.message}` });
        }
      }

      if (actions.length === 0) {
        // No actions = turn complete
        break;
      }

      // ── Process model actions ──
      for (const { action, call_id } of actions) {
        if (action.type === "screenshot") {
          addOutput({ type: 'info', text: '📸 Capturing screen' });
        } else {
          await handleModelAction(this.session.deviceId, action, this.session.deviceInfo.scale, context);

          // Track action and check for interruption
          if (trackAction) {
            const shouldStop = trackAction(action);
            if (shouldStop) {
              // User interrupted - stop execution immediately
              return newResponseId;
            }
          }

          // Add delay after UI-changing actions to let the interface update
          // before taking the screenshot (except for explicit wait actions which have their own delay)
          if (action.type !== "wait") {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        const screenshotBase64 = await getScreenshotAsBase64(
          this.session.deviceId,
          this.session.deviceInfo
        );

        if (this.recordScreenshots && this.screenshotDir) {
          const framePath = path.join(this.screenshotDir, `frame_${String(Date.now())}.png`);
          await writeFile(framePath, Buffer.from(screenshotBase64, "base64"));
        }

        // Build next input: screenshot + any carryover reasoning
        const input = [{
          type: "computer_call_output",
          call_id,
          output: {
            type: "computer_screenshot",
            image_url: `data:image/png;base64,${screenshotBase64}`,
          },
          current_url: getCurrentPlatform() === "ios" ? "ios://simulator" : "android://emulator",
          ...(pendingSafetyChecks.length > 0 ? { acknowledged_safety_checks: pendingSafetyChecks } : {})
        }];

        response = await sendCUARequest({
          messages: input,
          previousResponseId: newResponseId,
          deviceInfo: this.session.deviceInfo,
        });

        newResponseId = response.id;
      }
    }

    // ── At end, if last output was only reasoning ──
    const finalItems = response.output || [];
    if (finalItems.length > 0 && finalItems.at(-1).type === "reasoning") {
      addOutput({ type: 'info', text: 'Warning: last item was reasoning without follow-up. Dropping to avoid 400 error.' });
    }

    return newResponseId;
  }
}
