/**
 * Device Factory
 *
 * Provides platform detection and returns the appropriate device backend.
 */

import * as androidConnection from "./android/connection.js";
import * as androidActions from "./android/actions.js";
import * as iosConnection from "./ios/connection.js";
import * as iosActions from "./ios/actions.js";

// Current platform state
let currentPlatform = null;

/**
 * Detect platform from device name or environment variable
 * @param {string} deviceName - The device/AVD/simulator name
 * @returns {string} 'ios' or 'android'
 */
export function detectPlatform(deviceName) {
  // Environment variable takes precedence
  if (process.env.DROID_CUA_PLATFORM === "ios") {
    return "ios";
  }
  if (process.env.DROID_CUA_PLATFORM === "android") {
    return "android";
  }

  // Auto-detect from device name
  if (deviceName) {
    const lower = deviceName.toLowerCase();
    if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios")) {
      return "ios";
    }
  }

  // Default to Android
  return "android";
}

/**
 * Get the device backend for a platform
 * @param {string} platform - 'ios' or 'android'
 * @returns {object} Backend with connection and action functions
 */
export function getDeviceBackend(platform) {
  if (platform === "ios") {
    return {
      connectToDevice: iosConnection.connectToDevice,
      getDeviceInfo: iosConnection.getDeviceInfo,
      getScreenshotAsBase64: iosConnection.getScreenshotAsBase64,
      handleModelAction: iosActions.handleModelAction,
      disconnect: iosConnection.disconnect,
    };
  }

  // Default: Android
  return {
    connectToDevice: androidConnection.connectToDevice,
    getDeviceInfo: androidConnection.getDeviceInfo,
    getScreenshotAsBase64: androidConnection.getScreenshotAsBase64,
    handleModelAction: androidActions.handleModelAction,
    disconnect: async () => {}, // Android doesn't need explicit disconnect
  };
}

/**
 * Set the current platform
 * @param {string} platform
 */
export function setCurrentPlatform(platform) {
  currentPlatform = platform;
}

/**
 * Get the current platform
 * @returns {string|null}
 */
export function getCurrentPlatform() {
  return currentPlatform;
}
