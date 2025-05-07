import minimist from "minimist";
import readline from "readline/promises";
import { readFile } from "fs/promises";
import { connectToDevice, getScreenshotAsBase64, getDeviceInfo } from "./device.js";
import { sendCUARequest } from "./openai.js";
import { handleModelAction } from "./actions.js";

const transcript = [];

const args = minimist(process.argv.slice(2));
const avdName = args["avd"];
const instructionsFile = args.instructions || args.i || null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function promptUser() {
  return (await rl.question("> ")).trim();
}

async function loadInstructionsFile(file) {
  if (!file) return [];
  const content = await readFile(file, "utf-8");
  return content.split("\n").map(line => line.trim()).filter(line => line.length > 0);
}

async function runFullTurn(response, deviceId, deviceInfo) {
  let newResponseId = response.id;
  let pendingItems = []; // Items to carry over if needed

  while (true) {
    const items = response.output || [];
    const actions = items.filter(item => item.type === "computer_call");

    // ── Print assistant output ──
    for (const item of items) {
      if (item.type === "reasoning") {
        for (const entry of item.summary) {
          if (entry.type === "summary_text") {
            const line = `[Reasoning] ${entry.text}`;
            console.log(line);
            transcript.push(line);
          }
        }
      } else if (item.type === "message") {
        const textPart = item.content.find(c => c.type === "output_text");
        if (textPart) {
          const line = `[Assistant] ${textPart.text}`;
          console.log(line);
          transcript.push(line);
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
        await handleModelAction(deviceId, action, deviceInfo.scale);
      }

      const screenshotBase64 = await getScreenshotAsBase64(deviceId, deviceInfo.scale);

      // Build next input: screenshot + any carryover reasoning
      const input = [];

      if (pendingItems.length > 0) {
        input.push(...pendingItems);
        pendingItems = []; // Clear after using
      }

      input.push({
        type: "computer_call_output",
        call_id,
        output: {
          type: "computer_screenshot",
          image_url: `data:image/png;base64,${screenshotBase64}`,
        },
        ...(pending_safety_checks?.length > 0 ? { acknowledged_safety_checks: pending_safety_checks } : {})
      });

      response = await sendCUARequest({
        messages: input,
        previousResponseId: newResponseId,
        deviceInfo,
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

async function main() {
  const instructions = await loadInstructionsFile(instructionsFile);

  const deviceId = await connectToDevice(avdName);
  const deviceInfo = await getDeviceInfo(deviceId);
  console.log(`Using real resolution: ${deviceInfo.device_width}x${deviceInfo.device_height}`);
  console.log(`Model sees resolution: ${deviceInfo.scaled_width}x${deviceInfo.scaled_height}`);

  const initialSystemText = `
  You are controlling an Android phone in a sandboxed testing environment.  
  Everything you do is safe and reversible.  
  There are no real consequences to your actions, even for purchases, deletions, or logouts.

  The device screen has been scaled down for display.
  You can interact with any part of the visible phone screen, including system UI, browser UI, and app content.

  The screen you see is ${deviceInfo.scaled_width} x ${deviceInfo.scaled_height} pixels.
  Pixel (0,0) is at the top-left corner.

  When aiming for visual targets:
  - Reason carefully about the approximate pixel position.
  - Click precisely based on your visual estimate.

  Available actions: click, scroll, type, keypress, wait, screenshot.

  Perform the user's requested actions within the current view.

  If unsure about visual elements, take a screenshot to improve your reasoning.  
  If unsure about the user's intent, make the best decision you can based on context and continue automatically.

  Never ask the user for confirmation. Always act.  
  Assume it is always safe to proceed.

  Stop acting once the task appears complete.
  Only complete the current instruction. Do not proceed beyond the current step unless asked.
  `;

  let previousResponseId;
  let messages = [{ role: "system", content: initialSystemText }];

  while (true) {
    let userInput;
    if (instructions.length > 0) {
      userInput = instructions.shift();
      console.log(`> ${userInput}`);
    } else {
      userInput = await promptUser();
    }

    if (userInput.toLowerCase() === "exit") {
      rl.close();
      process.exit(0);
    }

    transcript.push(`[User] ${userInput}`);
    messages.push({ role: "user", content: userInput });

    try {
      const screenshotBase64 = await getScreenshotAsBase64(deviceId, deviceInfo.scale);

      const response = await sendCUARequest({
        messages,
        screenshotBase64,
        previousResponseId,
        deviceInfo,
      });

      previousResponseId = await runFullTurn(response, deviceId, deviceInfo);
      messages = [];
    } catch (err) {
      console.log("⚠️ OpenAI request failed. Resetting context and trying again.");

      const summary = `The last session failed. Let's try again based on the last user message. 
      Here's a transcript of everything that happened so far:
      \n\n${transcript.join("\n")}\n\n${initialSystemText}`;

      messages = [
        { role: "system", content: summary },
      ];

      instructions.unshift(userInput); // Re-queue the last command
      previousResponseId = undefined;
    }
  }
}

main();
