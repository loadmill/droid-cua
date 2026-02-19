/**
 * iOS Action Execution Module
 *
 * Executes CUA model actions on iOS Simulator via Appium.
 */

import * as appium from "./appium-client.js";
import { getActiveSession, getDevicePixelRatio } from "./connection.js";
import { logger } from "../../utils/logger.js";
import { emitDesktopDebug, truncateForDebug } from "../../utils/desktop-debug.js";

/**
 * Handle an action from the CUA model
 * @param {string} simulatorId - The simulator UDID
 * @param {object} action - The action to execute
 * @param {number} scale - Scale factor for coordinates
 * @param {object} context - Context with addOutput function
 */
export async function handleModelAction(simulatorId, action, scale = 1.0, context = null) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));
  const session = getActiveSession();
  const meta = (payload = {}) => ({
    eventType: "tool_call",
    actionType: action?.type,
    runId: context?.runId,
    stepId: context?.stepId,
    instructionIndex: context?.instructionIndex,
    payload: {
      platform: "ios",
      ...payload
    }
  });

  if (!session) {
    throw new Error("No active iOS session");
  }

  try {
    emitDesktopDebug(
      "device.action.execute",
      "device",
      {
        runId: context?.runId,
        sessionId: context?.sessionId,
        stepId: context?.stepId,
        instructionIndex: context?.instructionIndex
      },
      {
        platform: "ios",
        simulatorId,
        actionType: action?.type,
        scale,
        text: typeof action?.text === "string" ? truncateForDebug(action.text, 300) : undefined,
        keyCount: Array.isArray(action?.keys) ? action.keys.length : 0,
        pathPoints: Array.isArray(action?.path) ? action.path.length : 0
      }
    );

    switch (action.type) {
      case "click": {
        // Convert scaled coordinates to pixels, then to logical points for Appium
        const dpr = getDevicePixelRatio();
        const pixelX = Math.round(action.x / scale);
        const pixelY = Math.round(action.y / scale);
        const pointX = Math.round(pixelX / dpr);
        const pointY = Math.round(pixelY / dpr);
        addOutput({ type: "action", text: `Tapping at (${pointX}, ${pointY}) points`, ...meta({ x: pointX, y: pointY, unit: "points", deviceScale: dpr }) });
        await appium.tap(session.sessionId, pointX, pointY);
        break;
      }

      case "type": {
        addOutput({ type: "action", text: `Typing text: ${action.text}`, ...meta({ text: action.text }) });
        await appium.type(session.sessionId, action.text);
        break;
      }

      case "scroll": {
        const dpr = getDevicePixelRatio();
        const scrollX = Math.round((action.scroll_x / scale) / dpr);
        const scrollY = Math.round((action.scroll_y / scale) / dpr);
        addOutput({ type: "action", text: `Scrolling by (${scrollX}, ${scrollY}) points`, ...meta({ scrollX, scrollY, unit: "points" }) });

        // Start from center of screen (in logical points)
        const centerX = 197; // Center of iPhone 16 (393/2)
        const centerY = 426; // Center of iPhone 16 (852/2)
        const endX = centerX + scrollX;
        const endY = centerY - scrollY; // Invert Y for natural scrolling

        await appium.scroll(session.sessionId, centerX, centerY, endX, endY);
        break;
      }

      case "drag": {
        const { path } = action;
        if (path && path.length >= 2) {
          const dpr = getDevicePixelRatio();
          const start = path[0];
          const end = path[path.length - 1];
          // Convert to pixels then to logical points
          const startX = Math.round((start.x / scale) / dpr);
          const startY = Math.round((start.y / scale) / dpr);
          const endX = Math.round((end.x / scale) / dpr);
          const endY = Math.round((end.y / scale) / dpr);

          addOutput({
            type: "action",
            text: `Dragging from (${startX}, ${startY}) to (${endX}, ${endY}) points`,
            ...meta({ pathStart: { x: startX, y: startY }, pathEnd: { x: endX, y: endY }, unit: "points" })
          });
          await appium.drag(session.sessionId, startX, startY, endX, endY);
        } else {
          addOutput({ type: "info", text: `Drag action missing valid path: ${JSON.stringify(action)}` });
        }
        break;
      }

      case "keypress": {
        const { keys } = action;
        for (const key of keys) {
          const upperKey = key.toUpperCase();
          if (upperKey === "ESC" || upperKey === "ESCAPE") {
            // Map ESC to home button on iOS
            addOutput({ type: "action", text: "Pressing Home button", ...meta({ keys: [key], mapped: "home" }) });
            await appium.pressButton(session.sessionId, "home");
          } else if (upperKey === "ENTER" || upperKey === "RETURN") {
            addOutput({ type: "action", text: "Pressing Return key", ...meta({ keys: [key], mapped: "return" }) });
            await appium.type(session.sessionId, "\n");
          } else if (upperKey === "BACKSPACE" || upperKey === "DELETE") {
            addOutput({ type: "action", text: "Pressing Delete key", ...meta({ keys: [key], mapped: "delete" }) });
            await appium.type(session.sessionId, "\b");
          } else {
            addOutput({ type: "action", text: `Pressing key: ${key}`, ...meta({ keys: [key] }) });
            await appium.type(session.sessionId, key);
          }
        }
        break;
      }

      case "wait": {
        addOutput({ type: "action", text: "Waiting...", ...meta({}) });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        break;
      }

      default:
        addOutput({ type: "info", text: `Unknown action: ${JSON.stringify(action)}` });
    }
  } catch (error) {
    logger.error("iOS action execution error", {
      action,
      message: error.message,
      stack: error.stack,
    });

    emitDesktopDebug(
      "device.error",
      "device",
      {
        runId: context?.runId,
        sessionId: context?.sessionId,
        stepId: context?.stepId,
        instructionIndex: context?.instructionIndex
      },
      {
        platform: "ios",
        operation: "action.execute",
        actionType: action?.type,
        message: error.message
      }
    );

    addOutput({
      type: "error",
      text: `Error executing action: ${error.message}`,
      eventType: "error",
      actionType: action?.type,
      runId: context?.runId,
      stepId: context?.stepId,
      instructionIndex: context?.instructionIndex,
      payload: {
        message: error.message,
        platform: "ios"
      }
    });
    addOutput({ type: "info", text: "Full error details have been logged to the debug log." });
  }
}
