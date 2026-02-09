/**
 * Appium Server Manager
 *
 * Manages Appium server lifecycle for iOS Simulator automation.
 * Auto-starts if not running, cleans up on process exit.
 */

import { spawn } from "child_process";

const APPIUM_URL = process.env.APPIUM_URL || "http://localhost:4723";
let appiumProcess = null;
let cleanupRegistered = false;

/**
 * Check if Appium server is running
 * @returns {Promise<boolean>}
 */
export async function isAppiumRunning() {
  try {
    const response = await fetch(`${APPIUM_URL}/status`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for Appium to be ready
 * @param {number} timeoutMs - Maximum time to wait
 * @returns {Promise<boolean>}
 */
async function waitForAppiumReady(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isAppiumRunning()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

/**
 * Start Appium server if not already running
 * @returns {Promise<void>}
 */
export async function startAppium() {
  if (await isAppiumRunning()) {
    console.log("Appium server is already running");
    return;
  }

  console.log("Starting Appium server...");

  appiumProcess = spawn("appium", [], {
    detached: true,
    stdio: "ignore"
  });
  appiumProcess.unref();

  const ready = await waitForAppiumReady(30000);
  if (!ready) {
    throw new Error("Appium server failed to start within 30 seconds");
  }

  console.log("Appium server is ready");
}

/**
 * Stop the Appium server if we started it
 */
export function stopAppium() {
  if (appiumProcess) {
    try {
      // Kill the process group
      process.kill(-appiumProcess.pid, "SIGTERM");
    } catch {
      // Process may already be dead
    }
    appiumProcess = null;
  }
}

/**
 * Register cleanup handlers for process exit
 */
export function setupAppiumCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  const cleanup = () => {
    stopAppium();
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
}

/**
 * Get the Appium server URL
 * @returns {string}
 */
export function getAppiumUrl() {
  return APPIUM_URL;
}
