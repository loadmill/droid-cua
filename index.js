import minimist from "minimist";
import path from "path";
import readline from "readline/promises";
import { readFile, mkdir } from "fs/promises";
import { connectToDevice, getScreenshotAsBase64, getDeviceInfo } from "./src/device/connection.js";
import { sendCUARequest } from "./src/device/openai.js";
import {
  isAssertion,
  extractAssertionPrompt,
  buildAssertionSystemPrompt,
  checkAssertionResult,
  handleAssertionFailure,
  handleAssertionSuccess,
} from "./src/device/assertions.js";
import { Session } from "./src/core/session.js";
import { ExecutionEngine } from "./src/core/execution-engine.js";
import { buildBaseSystemPrompt } from "./src/core/prompts.js";
import { parseInput } from "./src/cli/command-parser.js";
import { routeCommand } from "./src/commands/index.js";

const args = minimist(process.argv.slice(2));
const avdName = args["avd"];
const recordScreenshots = args["record"] || false;
const instructionsFile = args.instructions || args.i || null;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const screenshotDir = path.join("droid-cua-recording-" + Date.now());
if (recordScreenshots) await mkdir(screenshotDir, { recursive: true });

async function promptUser() {
  return (await rl.question("> ")).trim();
}

async function loadInstructionsFile(file) {
  if (!file) return [];
  const content = await readFile(file, "utf-8");
  return content.split("\n").map(line => line.trim()).filter(line => line.length > 0);
}

async function main() {
  const instructions = await loadInstructionsFile(instructionsFile);

  const deviceId = await connectToDevice(avdName);
  const deviceInfo = await getDeviceInfo(deviceId);
  console.log(`Using real resolution: ${deviceInfo.device_width}x${deviceInfo.device_height}`);
  console.log(`Model sees resolution: ${deviceInfo.scaled_width}x${deviceInfo.scaled_height}`);

  // Create session to manage state
  const session = new Session(deviceId, deviceInfo);
  const initialSystemText = buildBaseSystemPrompt(deviceInfo);
  session.setSystemPrompt(initialSystemText);

  // Create execution engine
  const engine = new ExecutionEngine(session, {
    recordScreenshots,
    screenshotDir,
  });

  while (true) {
    let userInput;
    if (instructions.length > 0) {
      userInput = instructions.shift();
      console.log(`> ${userInput}`);
    } else {
      userInput = await promptUser();
    }

    // Parse input to check if it's a command or instruction
    const parsed = parseInput(userInput);

    // ── Handle slash commands ──
    if (parsed.type === 'command') {
      const shouldContinue = await routeCommand(parsed.command, parsed.args, session, { rl, engine });
      if (!shouldContinue) {
        break; // Exit main loop
      }
      continue; // Go to next input
    }

    // ── Handle regular instructions ──
    const instruction = parsed.text;

    // Check for old-style "exit" (backward compatibility)
    if (instruction.toLowerCase() === "exit") {
      rl.close();
      process.exit(0);
    }

    // ── Check for assertion ──
    const isAssertionStep = isAssertion(instruction);
    let assertionPrompt = null;

    if (isAssertionStep) {
      assertionPrompt = extractAssertionPrompt(instruction);
      const assertionSystemPrompt = buildAssertionSystemPrompt(initialSystemText, assertionPrompt);

      session.clearMessages();
      session.addMessage("system", assertionSystemPrompt);
      session.addToTranscript(`[Assertion] ${assertionPrompt}`);
      session.addMessage("user", `Validate this assertion: ${assertionPrompt}`);
    } else {
      session.addToTranscript(`[User] ${instruction}`);
      session.addMessage("user", instruction);
    }

    try {
      const screenshotBase64 = await getScreenshotAsBase64(session.deviceId, session.deviceInfo);

      const response = await sendCUARequest({
        messages: session.messages,
        screenshotBase64,
        previousResponseId: session.previousResponseId,
        deviceInfo: session.deviceInfo,
      });

      const newResponseId = await engine.runFullTurn(response);
      session.updateResponseId(newResponseId);

      // ── Check assertion result ──
      if (isAssertionStep) {
        const result = checkAssertionResult(session.transcript);

        if (result.failed) {
          handleAssertionFailure(assertionPrompt, session.transcript, !!instructionsFile, rl);
          // Interactive mode: clear remaining instructions (stops script but keeps CLI alive)
          if (!instructionsFile) {
            instructions.length = 0;
          }
        } else if (result.passed) {
          handleAssertionSuccess(assertionPrompt);
        }
      }

      session.clearMessages();
    } catch (err) {
      console.log("⚠️ OpenAI request failed. Resetting context and trying again.");

      const summary = `The last session failed. Let's try again based on the last user message.
      Here's a transcript of everything that happened so far:
      \n\n${session.getTranscriptText()}\n\n${initialSystemText}`;

      session.clearMessages();
      session.addMessage("system", summary);

      instructions.unshift(instruction); // Re-queue the last instruction
      session.updateResponseId(undefined);
    }
  }
}

main();
