import path from "path";
import { writeFile } from "fs/promises";
import { getScreenshotAsBase64 } from "../device/connection.js";
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
   */
  async runFullTurn(response, trackAction = null) {
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

      // ── Print assistant output ──
      for (const item of items) {
        if (item.type === "reasoning") {
          for (const entry of item.summary) {
            if (entry.type === "summary_text") {
              const line = `[Reasoning] ${entry.text}`;
              console.log(line);
              this.session.addToTranscript(line);
            }
          }
        } else if (item.type === "message") {
          const textPart = item.content.find(c => c.type === "output_text");
          if (textPart) {
            const line = `[Assistant] ${textPart.text}`;
            console.log(line);
            this.session.addToTranscript(line);
          }
        }
      }

      if (actions.length === 0) {
        // No actions = turn complete
        break;
      }

      // ── Process model actions ──
      for (const { action, call_id, pending_safety_checks } of actions) {
        if (action.type === "screenshot") {
          console.log("Model requested screenshot.");
        } else {
          await handleModelAction(this.session.deviceId, action, this.session.deviceInfo.scale);

          // Track action and check for interruption
          if (trackAction) {
            const shouldStop = trackAction(action);
            if (shouldStop) {
              // User interrupted - stop execution immediately
              return newResponseId;
            }
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
          ...(pending_safety_checks?.length > 0 ? { acknowledged_safety_checks: pending_safety_checks } : {})
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
      console.log("Warning: last item was reasoning without follow-up. Dropping to avoid 400 error.");
    }

    return newResponseId;
  }
}
