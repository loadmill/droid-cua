/**
 * Device Actions Module
 *
 * Thin wrapper that delegates to the appropriate platform backend.
 * Maintains backwards compatibility with existing code.
 */

import { getDeviceBackend, getCurrentPlatform } from "./factory.js";

/**
 * Handle an action from the CUA model
 * @param {string} deviceId - The device/emulator/simulator ID
 * @param {object} action - The action to execute
 * @param {number} scale - Scale factor for coordinates
 * @param {object} context - Context with addOutput function
 */
export async function handleModelAction(deviceId, action, scale = 1.0, context = null) {
  const platform = getCurrentPlatform();
  if (!platform) {
    throw new Error("No platform set. Call connectToDevice first.");
  }

  const backend = getDeviceBackend(platform);
  return backend.handleModelAction(deviceId, action, scale, context);
}
