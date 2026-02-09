/**
 * Device Connection Module
 *
 * Thin wrapper that delegates to the appropriate platform backend.
 * Maintains backwards compatibility with existing code.
 */

import { getDeviceBackend, detectPlatform, setCurrentPlatform, getCurrentPlatform } from "./factory.js";

let currentBackend = null;

/**
 * Connect to a device (Android emulator or iOS simulator)
 * @param {string} deviceName - AVD name (Android) or Simulator name (iOS)
 * @param {string} platform - Optional platform override ('android' or 'ios')
 * @returns {Promise<string>} Device ID
 */
export async function connectToDevice(deviceName, platform = null) {
  const detectedPlatform = platform || detectPlatform(deviceName);
  setCurrentPlatform(detectedPlatform);
  currentBackend = getDeviceBackend(detectedPlatform);

  console.log(`Platform: ${detectedPlatform}`);

  return currentBackend.connectToDevice(deviceName);
}

/**
 * Get device info (screen dimensions and scale factor)
 * @param {string} deviceId
 * @returns {Promise<object>}
 */
export async function getDeviceInfo(deviceId) {
  if (!currentBackend) {
    throw new Error("Not connected to a device. Call connectToDevice first.");
  }
  return currentBackend.getDeviceInfo(deviceId);
}

/**
 * Get screenshot as base64 string
 * @param {string} deviceId
 * @param {object} deviceInfo
 * @returns {Promise<string>}
 */
export async function getScreenshotAsBase64(deviceId, deviceInfo) {
  if (!currentBackend) {
    throw new Error("Not connected to a device. Call connectToDevice first.");
  }
  return currentBackend.getScreenshotAsBase64(deviceId, deviceInfo);
}

/**
 * Get the current platform
 * @returns {string|null}
 */
export { getCurrentPlatform } from "./factory.js";

/**
 * Disconnect from the device
 */
export async function disconnect() {
  if (currentBackend?.disconnect) {
    await currentBackend.disconnect();
  }
  currentBackend = null;
}
