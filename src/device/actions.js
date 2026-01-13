import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

function adbShell(deviceId, command) {
  return execAsync(`adb -s ${deviceId} shell "${command}"`);
}

export async function handleModelAction(deviceId, action, scale = 1.0, context = null) {
  const addOutput = context?.addOutput || ((item) => console.log(item.text || item));

  try {
    const { x, y, x1, y1, x2, y2, text, keys, path } = action;

    switch (action.type) {
      case "click":
        const realX = Math.round(x / scale);
        const realY = Math.round(y / scale);
        addOutput({ type: 'action', text: `Clicking at (${realX}, ${realY})` });
        await adbShell(deviceId, `input tap ${realX} ${realY}`);
        break;

      case "scroll":
        const scrollX = Math.round(action.scroll_x / scale);
        const scrollY = Math.round(action.scroll_y / scale);
        addOutput({ type: 'action', text: `Scrolling by (${scrollX}, ${scrollY})` });
        const startX = 500;
        const startY = 500;
        const endX = startX + scrollX;
        const endY = startY - scrollY; // <--- INVERT Y
        await adbShell(deviceId, `input swipe ${startX} ${startY} ${endX} ${endY} 500`);
        break;

      case "drag":
        if (path && path.length >= 2) {
          const start = path[0];
          const end = path[path.length - 1];
          const realStartX = Math.round(start.x / scale);
          const realStartY = Math.round(start.y / scale);
          const realEndX = Math.round(end.x / scale);
          const realEndY = Math.round(end.y / scale);

          addOutput({ type: 'action', text: `Dragging from (${realStartX}, ${realStartY}) to (${realEndX}, ${realEndY})` });
          await adbShell(deviceId, `input swipe ${realStartX} ${realStartY} ${realEndX} ${realEndY} 500`);
        } else {
          addOutput({ type: 'info', text: `Drag action missing valid path: ${JSON.stringify(action)}` });
        }
        break;

      case "type":
        addOutput({ type: 'action', text: `Typing text: ${text}` });
        const escapedText = text.replace(/(["\\$`])/g, "\\$1").replace(/ /g, "%s");
        await adbShell(deviceId, `input text "${escapedText}"`);
        break;

      case "keypress":
        // Map ESC to Android Home button (since ESC doesn't exist on mobile)
        const mappedKeys = keys.map(key => {
          if (key.toUpperCase() === 'ESC' || key.toUpperCase() === 'ESCAPE') {
            return 'KEYCODE_HOME';
          }
          return key;
        });

        addOutput({ type: 'action', text: `Pressing key: ${mappedKeys.join(', ')}` });
        for (const key of mappedKeys) {
          await adbShell(deviceId, `input keyevent ${key}`);
        }
        break;

      case "wait":
        addOutput({ type: 'action', text: 'Waiting...' });
        await new Promise(res => setTimeout(res, 1000));
        break;

      default:
        addOutput({ type: 'info', text: `Unknown action: ${JSON.stringify(action)}` });
    }
  } catch (error) {
    // Log full error details to file
    logger.error('Action execution error', {
      action,
      message: error.message,
      stack: error.stack
    });

    // Show user-friendly error message
    addOutput({ type: 'error', text: `Error executing action: ${error.message}` });
    addOutput({ type: 'info', text: 'Full error details have been logged to the debug log.' });
  }
}
