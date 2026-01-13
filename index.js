import minimist from "minimist";
import path from "path";
import { mkdir } from "fs/promises";
import { connectToDevice, getDeviceInfo } from "./src/device/connection.js";
import { Session } from "./src/core/session.js";
import { ExecutionEngine } from "./src/core/execution-engine.js";
import { buildBaseSystemPrompt } from "./src/core/prompts.js";
import { startInkShell } from "./src/cli/ink-shell.jsx";
import { loadTest } from "./src/test-store/test-manager.js";
import { ExecutionMode } from "./src/modes/execution-mode.js";

const args = minimist(process.argv.slice(2));
const avdName = args["avd"];
const recordScreenshots = args["record"] || false;
const instructionsFile = args.instructions || args.i || null;

const screenshotDir = path.join("droid-cua-recording-" + Date.now());
if (recordScreenshots) await mkdir(screenshotDir, { recursive: true });

async function main() {
  // Connect to device
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

  // If --instructions provided, run in headless mode
  if (instructionsFile) {
    console.log(`\nRunning test from: ${instructionsFile}\n`);

    const instructions = await loadTest(instructionsFile);
    const executionMode = new ExecutionMode(session, engine, instructions);

    const result = await executionMode.execute();

    if (result.success) {
      process.exit(0);
    } else {
      console.error(`\nTest failed: ${result.error}`);
      process.exit(1);
    }
  }

  // Otherwise, start interactive Ink shell
  await startInkShell(session, engine);
}

main();
