/**
 * iOS Simulator Connection Module
 *
 * Manages connection to iOS Simulator via Appium.
 */

import { exec } from "child_process";
import { promisify } from "util";
import sharp from "sharp";
import { startAppium, setupAppiumCleanup } from "./appium-server.js";
import * as appium from "./appium-client.js";
import { logger } from "../../utils/logger.js";
import { emitDesktopDebug } from "../../utils/desktop-debug.js";

const execAsync = promisify(exec);

// Active session state
let activeSession = null;

/**
 * Get simulator UDID by name (prefers already-booted simulator)
 * @param {string} simulatorName
 * @returns {Promise<string|null>}
 */
async function getSimulatorUDID(simulatorName) {
  try {
    const { stdout } = await execAsync("xcrun simctl list devices --json");
    const data = JSON.parse(stdout);

    let firstMatch = null;
    let bootedMatch = null;

    for (const runtime of Object.values(data.devices)) {
      for (const device of runtime) {
        if (device.name === simulatorName && device.isAvailable) {
          if (!firstMatch) {
            firstMatch = device.udid;
          }
          // Prefer the already-booted one
          if (device.state === "Booted") {
            bootedMatch = device.udid;
          }
        }
      }
    }

    if (bootedMatch) {
      logger.debug(`Found booted simulator: ${bootedMatch}`);
      return bootedMatch;
    }
    return firstMatch;
  } catch (error) {
    logger.error("Failed to get simulator UDID", { error: error.message });
  }
  return null;
}

/**
 * Find any available simulator (prefers booted, then first available)
 * @returns {Promise<{name: string, udid: string}|null>}
 */
async function findAnySimulator() {
  try {
    const { stdout } = await execAsync("xcrun simctl list devices --json");
    const data = JSON.parse(stdout);

    let firstAvailable = null;
    let bootedDevice = null;

    for (const runtime of Object.values(data.devices)) {
      for (const device of runtime) {
        if (device.isAvailable) {
          if (!firstAvailable) {
            firstAvailable = { name: device.name, udid: device.udid };
          }
          if (device.state === "Booted") {
            bootedDevice = { name: device.name, udid: device.udid };
          }
        }
      }
    }

    return bootedDevice || firstAvailable;
  } catch (error) {
    logger.error("Failed to find simulators", { error: error.message });
  }
  return null;
}

/**
 * Boot simulator if not already booted
 * @param {string} simulatorName
 * @returns {Promise<string>} UDID of the simulator
 */
async function bootSimulator(simulatorName) {
  const udid = await getSimulatorUDID(simulatorName);
  if (!udid) {
    throw new Error(`Simulator "${simulatorName}" not found. Run "xcrun simctl list devices" to see available simulators.`);
  }
  console.log(`Found simulator "${simulatorName}" with UDID: ${udid}`);

  // Check if already booted
  const { stdout } = await execAsync("xcrun simctl list devices --json");
  const data = JSON.parse(stdout);

  for (const runtime of Object.values(data.devices)) {
    for (const device of runtime) {
      if (device.udid === udid) {
        if (device.state === "Booted") {
          console.log(`Simulator "${simulatorName}" is already booted`);
          return udid;
        }
        break;
      }
    }
  }

  console.log(`Booting simulator "${simulatorName}"...`);
  await execAsync(`xcrun simctl boot ${udid}`);

  // Open Simulator app to show the device
  await execAsync("open -a Simulator");

  // Wait for boot to complete
  await waitForSimulatorBoot(udid);

  console.log(`Simulator "${simulatorName}" is fully booted`);
  return udid;
}

/**
 * Wait for simulator to finish booting
 * @param {string} udid
 * @param {number} timeoutMs
 */
async function waitForSimulatorBoot(udid, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const { stdout } = await execAsync("xcrun simctl list devices --json");
      const data = JSON.parse(stdout);

      for (const runtime of Object.values(data.devices)) {
        for (const device of runtime) {
          if (device.udid === udid && device.state === "Booted") {
            // Additional check: wait for springboard
            await new Promise(resolve => setTimeout(resolve, 3000));
            return;
          }
        }
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error("Simulator did not boot in time");
}

/**
 * Connect to iOS Simulator
 * @param {string} simulatorName - Name of the simulator (e.g., "iPhone 16"), or null to auto-detect
 * @returns {Promise<string>} Simulator ID for use with other functions
 */
export async function connectToDevice(simulatorName) {
  emitDesktopDebug("device.connect", "device", {}, { platform: "ios", stage: "start", simulatorName: simulatorName || null });
  // Setup cleanup handlers
  setupAppiumCleanup();

  // Start Appium if not running
  await startAppium();

  // If no simulator specified, auto-detect
  if (!simulatorName) {
    const found = await findAnySimulator();
    if (!found) {
      console.error("No iOS Simulators found. Create one with Xcode or run:");
      console.error("  xcrun simctl create 'iPhone 16' 'com.apple.CoreSimulator.SimDeviceType.iPhone-16'");
      process.exit(1);
    }
    simulatorName = found.name;
    console.log(`No simulator specified, using: ${simulatorName}`);
  }

  // Boot simulator
  const udid = await bootSimulator(simulatorName);

  // Create Appium session
  console.log("Creating Appium session...");
  const session = await appium.createSession({
    platformName: "iOS",
    "appium:automationName": "XCUITest",
    "appium:deviceName": simulatorName,
    "appium:udid": udid,
    "appium:noReset": true,
    "appium:shouldTerminateApp": false,
  });

  activeSession = {
    sessionId: session.sessionId,
    udid,
    simulatorName,
  };

  console.log(`Connected to simulator "${simulatorName}" (${udid})`);
  emitDesktopDebug("device.connect", "device", {}, {
    platform: "ios",
    stage: "success",
    simulatorName,
    udid
  });
  return udid;
}

/**
 * Get device info (screen dimensions and scale)
 * @param {string} simulatorId - The UDID returned from connectToDevice
 * @returns {Promise<object>}
 */
export async function getDeviceInfo(simulatorId) {
  await ensureSessionAlive();

  // Get logical window size (points)
  const windowSize = await appium.getWindowSize(activeSession.sessionId);

  // Take a test screenshot to get actual pixel dimensions
  // iOS screenshots are at Retina resolution (2x or 3x)
  const testScreenshot = await appium.getScreenshot(activeSession.sessionId);
  const testBuffer = Buffer.from(testScreenshot, "base64");
  const metadata = await sharp(testBuffer).metadata();

  const pixelWidth = metadata.width;
  const pixelHeight = metadata.height;

  // Calculate the iOS device scale factor (typically 2 or 3)
  const devicePixelRatio = Math.round(pixelWidth / windowSize.width);
  console.log(`Device pixel ratio: ${devicePixelRatio}x (${pixelWidth}x${pixelHeight} pixels, ${windowSize.width}x${windowSize.height} points)`);

  // Store the pixel ratio for coordinate conversion
  activeSession.devicePixelRatio = devicePixelRatio;

  // Use pixel dimensions as the "real" resolution (like Android does)
  const targetWidth = 400;
  const scale = pixelWidth > targetWidth ? targetWidth / pixelWidth : 1.0;
  const scaledWidth = Math.round(pixelWidth * scale);
  const scaledHeight = Math.round(pixelHeight * scale);

  return {
    device_width: pixelWidth,
    device_height: pixelHeight,
    scaled_width: scaledWidth,
    scaled_height: scaledHeight,
    scale,
  };
}

/**
 * Get screenshot as base64
 * @param {string} simulatorId
 * @param {object} deviceInfo
 * @returns {Promise<string>}
 */
export async function getScreenshotAsBase64(simulatorId, deviceInfo) {
  await ensureSessionAlive();

  const rawBase64 = await appium.getScreenshot(activeSession.sessionId);
  let buffer = Buffer.from(rawBase64, "base64");

  logger.debug(`iOS screenshot captured: ${buffer.length} bytes before scaling`);

  if (deviceInfo.scale < 1.0) {
    buffer = await sharp(buffer)
      .resize({ width: deviceInfo.scaled_width, height: deviceInfo.scaled_height })
      .png()
      .toBuffer();
    logger.debug(`iOS screenshot scaled: ${buffer.length} bytes after scaling`);
  }

  const base64 = buffer.toString("base64");
  emitDesktopDebug("device.screenshot", "device", {}, {
    platform: "ios",
    simulatorId,
    width: deviceInfo?.scaled_width,
    height: deviceInfo?.scaled_height,
    base64Length: base64.length
  });
  return base64;
}

/**
 * Ensure the Appium session is still alive, recreate if dead
 */
async function ensureSessionAlive() {
  if (!activeSession) {
    throw new Error("No active iOS session. Call connectToDevice first.");
  }

  const status = await appium.getSessionStatus(activeSession.sessionId);
  if (!status) {
    emitDesktopDebug("reconnect.attempt", "device", {}, {
      platform: "ios",
      stage: "start",
      reason: "appium session status check failed"
    });
    emitDesktopDebug("device.disconnect", "device", {}, {
      platform: "ios",
      reason: "appium session no longer active"
    });
    console.log("Session died, recreating...");
    const session = await appium.createSession({
      platformName: "iOS",
      "appium:automationName": "XCUITest",
      "appium:deviceName": activeSession.simulatorName,
      "appium:udid": activeSession.udid,
      "appium:noReset": true,
      "appium:shouldTerminateApp": false,
    });
    activeSession.sessionId = session.sessionId;
    emitDesktopDebug("reconnect.attempt", "device", {}, {
      platform: "ios",
      stage: "success",
      sessionId: session.sessionId
    });
  }
}

/**
 * Get the active session (for use by actions module)
 * @returns {object|null}
 */
export function getActiveSession() {
  return activeSession;
}

/**
 * Get the device pixel ratio (for coordinate conversion)
 * @returns {number}
 */
export function getDevicePixelRatio() {
  return activeSession?.devicePixelRatio || 3;
}

/**
 * Disconnect and cleanup
 */
export async function disconnect() {
  if (activeSession) {
    emitDesktopDebug("device.disconnect", "device", {}, {
      platform: "ios",
      udid: activeSession.udid,
      simulatorName: activeSession.simulatorName
    });
    try {
      await appium.deleteSession(activeSession.sessionId);
    } catch {}
    activeSession = null;
  }
}
