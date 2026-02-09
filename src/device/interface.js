/**
 * Device interface - contract that both Android and iOS backends must implement
 *
 * This file documents the expected API for device backends.
 * Each backend (android/, ios/) implements these functions.
 */

/**
 * @typedef {Object} DeviceInfo
 * @property {number} device_width - Actual device screen width in pixels
 * @property {number} device_height - Actual device screen height in pixels
 * @property {number} scaled_width - Width as seen by the model (after scaling)
 * @property {number} scaled_height - Height as seen by the model (after scaling)
 * @property {number} scale - Scale factor (scaled_width / device_width)
 */

/**
 * @typedef {Object} ActionContext
 * @property {Function} addOutput - Function to output messages to the user
 */

/**
 * Device Backend Interface
 *
 * Required exports for a device backend:
 *
 * connectToDevice(deviceName: string): Promise<string>
 *   - Connects to or launches the device/emulator/simulator
 *   - Returns a device ID for subsequent operations
 *
 * getDeviceInfo(deviceId: string): Promise<DeviceInfo>
 *   - Gets screen dimensions and calculates scale factor
 *   - Target width for scaling is 400px
 *
 * getScreenshotAsBase64(deviceId: string, deviceInfo: DeviceInfo): Promise<string>
 *   - Captures current screen state
 *   - Scales image if needed
 *   - Returns base64-encoded PNG
 *
 * handleModelAction(deviceId: string, action: object, scale: number, context: ActionContext): Promise<void>
 *   - Executes an action from the CUA model
 *   - Supported action types: click, type, scroll, drag, keypress, wait
 */

export const SUPPORTED_ACTIONS = [
  'click',     // Tap at (x, y) coordinates
  'type',      // Enter text
  'scroll',    // Scroll by (scroll_x, scroll_y)
  'drag',      // Drag from start to end via path
  'keypress',  // Press hardware keys (ESC/ESCAPE maps to home)
  'wait',      // Wait for UI to settle
  'screenshot' // Capture screen (handled by engine, not backend)
];

export const TARGET_SCALED_WIDTH = 400;
