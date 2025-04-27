import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

function adbShell(deviceId, command) {
  return execAsync(`adb -s ${deviceId} shell "${command}"`);
}

export async function handleModelAction(deviceId, action, scale = 1.0) {
  try {
    const { x, y, x1, y1, x2, y2, text, keys, path } = action;

    switch (action.type) {
      case "click":
        const realX = Math.round(x / scale);
        const realY = Math.round(y / scale);
        console.log(`Clicking at (${realX}, ${realY})`);
        await adbShell(deviceId, `input tap ${realX} ${realY}`);
        break;

      case "scroll":
        const scrollX = Math.round(action.scroll_x / scale);
        const scrollY = Math.round(action.scroll_y / scale);
        console.log(`Scrolling by (${scrollX}, ${scrollY})`);
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

          console.log(`Dragging from (${realStartX}, ${realStartY}) to (${realEndX}, ${realEndY})`);
          await adbShell(deviceId, `input swipe ${realStartX} ${realStartY} ${realEndX} ${realEndY} 500`);
        } else {
          console.log("Drag action missing valid path:", action);
        }
        break;

      case "type":
        console.log(`Typing text: ${text}`);
        const escapedText = text.replace(/(["\\$`])/g, "\\$1").replace(/ /g, "%s");
        await adbShell(deviceId, `input text "${escapedText}"`);
        break;

      case "keypress":
        console.log(`Pressing key: ${keys}`);
        for (const key of keys) {
          await adbShell(deviceId, `input keyevent ${key}`);
        }
        break;

      case "wait":
        console.log("Waiting...");
        await new Promise(res => setTimeout(res, 1000));
        break;

      default:
        console.log("Unknown action:", action);
    }
  } catch (error) {
    console.error("Error executing action:", action, error);
  }
}
