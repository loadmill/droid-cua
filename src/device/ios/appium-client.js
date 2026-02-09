/**
 * Appium WebDriver Client
 *
 * Low-level HTTP client for Appium/WebDriver protocol.
 * Implements W3C WebDriver and Appium-specific endpoints.
 */

import { getAppiumUrl } from "./appium-server.js";

/**
 * Make a request to the Appium server
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {object} body - Request body (optional)
 * @returns {Promise<object>}
 */
async function appiumRequest(method, path, body = null) {
  const url = `${getAppiumUrl()}${path}`;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.value?.message || data.message || JSON.stringify(data);
    throw new Error(`Appium request failed: ${errorMessage}`);
  }

  return data;
}

/**
 * Create a new Appium session
 * @param {object} capabilities - Desired capabilities
 * @returns {Promise<{sessionId: string, value: object}>}
 */
export async function createSession(capabilities) {
  const response = await appiumRequest("POST", "/session", {
    capabilities: {
      alwaysMatch: capabilities,
    },
  });

  return {
    sessionId: response.value.sessionId,
    value: response.value,
  };
}

/**
 * Delete an Appium session
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
export async function deleteSession(sessionId) {
  await appiumRequest("DELETE", `/session/${sessionId}`);
}

/**
 * Get a screenshot
 * @param {string} sessionId
 * @returns {Promise<string>} Base64-encoded PNG
 */
export async function getScreenshot(sessionId) {
  const response = await appiumRequest("GET", `/session/${sessionId}/screenshot`);
  return response.value;
}

/**
 * Get window size
 * @param {string} sessionId
 * @returns {Promise<{width: number, height: number}>}
 */
export async function getWindowSize(sessionId) {
  const response = await appiumRequest("GET", `/session/${sessionId}/window/rect`);
  return {
    width: response.value.width,
    height: response.value.height,
  };
}

/**
 * Perform a tap action using W3C Actions
 * @param {string} sessionId
 * @param {number} x
 * @param {number} y
 * @returns {Promise<void>}
 */
export async function tap(sessionId, x, y) {
  await appiumRequest("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "pointer",
        id: "finger1",
        parameters: { pointerType: "touch" },
        actions: [
          { type: "pointerMove", duration: 0, x: Math.round(x), y: Math.round(y) },
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: 100 },
          { type: "pointerUp", button: 0 },
        ],
      },
    ],
  });
}

/**
 * Type text
 * @param {string} sessionId
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function type(sessionId, text) {
  // Use W3C key actions
  const keyActions = [];
  for (const char of text) {
    keyActions.push({ type: "keyDown", value: char });
    keyActions.push({ type: "keyUp", value: char });
  }

  await appiumRequest("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "key",
        id: "keyboard",
        actions: keyActions,
      },
    ],
  });
}

/**
 * Perform a scroll action using W3C Actions
 * @param {string} sessionId
 * @param {number} startX
 * @param {number} startY
 * @param {number} endX
 * @param {number} endY
 * @param {number} duration - Duration in ms
 * @returns {Promise<void>}
 */
export async function scroll(sessionId, startX, startY, endX, endY, duration = 500) {
  await appiumRequest("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "pointer",
        id: "finger1",
        parameters: { pointerType: "touch" },
        actions: [
          { type: "pointerMove", duration: 0, x: Math.round(startX), y: Math.round(startY) },
          { type: "pointerDown", button: 0 },
          { type: "pointerMove", duration, x: Math.round(endX), y: Math.round(endY) },
          { type: "pointerUp", button: 0 },
        ],
      },
    ],
  });
}

/**
 * Perform a drag action using W3C Actions
 * @param {string} sessionId
 * @param {number} startX
 * @param {number} startY
 * @param {number} endX
 * @param {number} endY
 * @param {number} duration - Duration in ms
 * @returns {Promise<void>}
 */
export async function drag(sessionId, startX, startY, endX, endY, duration = 500) {
  // Drag is similar to scroll but with longer press at start
  await appiumRequest("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "pointer",
        id: "finger1",
        parameters: { pointerType: "touch" },
        actions: [
          { type: "pointerMove", duration: 0, x: Math.round(startX), y: Math.round(startY) },
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: 200 }, // Hold before drag
          { type: "pointerMove", duration, x: Math.round(endX), y: Math.round(endY) },
          { type: "pointerUp", button: 0 },
        ],
      },
    ],
  });
}

/**
 * Press a device button (home, volumeUp, volumeDown)
 * @param {string} sessionId
 * @param {string} buttonName - 'home', 'volumeUp', or 'volumeDown'
 * @returns {Promise<void>}
 */
export async function pressButton(sessionId, buttonName) {
  await appiumRequest("POST", `/session/${sessionId}/execute/sync`, {
    script: "mobile: pressButton",
    args: [{ name: buttonName }],
  });
}

/**
 * Get session status
 * @param {string} sessionId
 * @returns {Promise<object>}
 */
export async function getSessionStatus(sessionId) {
  try {
    const response = await appiumRequest("GET", `/session/${sessionId}`);
    return response.value;
  } catch {
    return null;
  }
}
