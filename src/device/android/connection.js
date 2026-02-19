import { exec, spawn } from "child_process";
import { once } from "events";
import { promisify } from "util";
import sharp from "sharp";
import { logger } from "../../utils/logger.js";
import { emitDesktopDebug } from "../../utils/desktop-debug.js";

const execAsync = promisify(exec);

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function listConnectedDevices() {
  const { stdout } = await execAsync("adb devices");
  return stdout
    .trim()
    .split("\n")
    .slice(1)
    .map(line => line.split("\t")[0])
    .filter(id => id.length > 0);
}

async function waitForDeviceConnection(avdName, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const devices = await listConnectedDevices();
    const match = devices.find(id => id.includes(avdName));
    if (match) return match;
    await wait(2000);
  }
  return null;
}

async function waitForDeviceBoot(deviceId, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const { stdout } = await execAsync(`adb -s ${deviceId} shell getprop sys.boot_completed`);
      if (stdout.trim() === "1") return true;
    } catch {}
    await wait(2000);
  }
  return false;
}

/**
 * Get list of available AVDs
 */
async function listAvailableAVDs() {
  try {
    const { stdout } = await execAsync("emulator -list-avds");
    return stdout.trim().split("\n").filter(name => name.length > 0);
  } catch {
    return [];
  }
}

export async function connectToDevice(avdName) {
  emitDesktopDebug("device.connect", "device", {}, { platform: "android", stage: "start", avdName: avdName || null });
  const devices = await listConnectedDevices();

  // If no AVD specified, try to use an already-running emulator or pick the first available
  if (!avdName) {
    // Check for already-running emulator
    for (const id of devices) {
      if (id.startsWith("emulator-")) {
        console.log(`Using already-running emulator: ${id}`);
        emitDesktopDebug("device.connect", "device", {}, { platform: "android", stage: "success", deviceId: id, reused: true });
        return id;
      }
    }

    // No running emulator, pick first available AVD
    const avds = await listAvailableAVDs();
    if (avds.length === 0) {
      console.error("No Android AVDs found. Create one with Android Studio or run:");
      console.error("  avdmanager create avd -n Pixel_8 -k 'system-images;android-35;google_apis;arm64-v8a'");
      process.exit(1);
    }
    avdName = avds[0];
    console.log(`No AVD specified, using first available: ${avdName}`);
  }

  for (const id of devices) {
    if (id.startsWith("emulator-")) {
      try {
        const { stdout } = await execAsync(`adb -s ${id} emu avd name`);
        if (stdout.trim() === avdName) {
          console.log(`Emulator ${avdName} is already running as ${id}`);
          emitDesktopDebug("device.connect", "device", {}, { platform: "android", stage: "success", deviceId: id, reused: true });
          return id;
        }
      } catch {}
    }
  }

  console.log(`No emulator with AVD "${avdName}" is running. Launching...`);
  const emulatorProcess = spawn("emulator", ["-avd", avdName], { detached: true, stdio: "ignore" });
  emulatorProcess.unref();

  const deviceId = await waitForDeviceConnection("emulator-", 120000);
  if (!deviceId) {
    emitDesktopDebug("device.error", "device", {}, { platform: "android", operation: "connect", message: `Emulator ${avdName} did not appear in time.` });
    console.error(`Emulator ${avdName} did not appear in time.`);
    process.exit(1);
  }

  console.log(`Device ${deviceId} detected. Waiting for boot...`);
  const booted = await waitForDeviceBoot(deviceId);
  if (!booted) {
    emitDesktopDebug("device.error", "device", {}, { platform: "android", operation: "connect", message: `Emulator ${avdName} did not finish booting.` });
    console.error(`Emulator ${avdName} did not finish booting.`);
    process.exit(1);
  }

  console.log(`Emulator ${avdName} is fully booted.`);
  emitDesktopDebug("device.connect", "device", {}, { platform: "android", stage: "success", deviceId, reused: false });
  return deviceId;
}

export async function getDeviceInfo(deviceId) {
  const { stdout } = await execAsync(`adb -s ${deviceId} shell wm size`);
  const match = stdout.match(/Physical size:\s*(\d+)x(\d+)/);
  if (!match) {
    console.error("Could not get device screen size.");
    process.exit(1);
  }
  const [_, width, height] = match.map(Number);

  const targetWidth = 400;
  const scale = width > targetWidth ? targetWidth / width : 1.0;
  const scaledWidth = Math.round(width * scale);
  const scaledHeight = Math.round(height * scale);

  return {
    device_width: width,
    device_height: height,
    scaled_width: scaledWidth,
    scaled_height: scaledHeight,
    scale,
  };
}

export async function getScreenshotAsBase64(deviceId, deviceInfo) {
  const adb = spawn("adb", ["-s", deviceId, "exec-out", "screencap", "-p"]);
  const chunks = [];
  const stderrChunks = [];

  adb.stdout.on("data", chunk => chunks.push(chunk));
  adb.stderr.on("data", err => {
    stderrChunks.push(err);
    console.error("ADB stderr:", err.toString());
  });

  const [code] = await once(adb, "close");

  if (code !== 0) {
    const stderrOutput = Buffer.concat(stderrChunks).toString();
    logger.error(`ADB screencap failed with code ${code}`, { stderr: stderrOutput });
    emitDesktopDebug("device.error", "device", {}, { platform: "android", operation: "screenshot", deviceId, message: `adb screencap exited with code ${code}` });
    throw new Error(`adb screencap exited with code ${code}`);
  }

  let buffer = Buffer.concat(chunks);

  logger.debug(`Screenshot captured: ${buffer.length} bytes before scaling`);

  if (buffer.length === 0) {
    logger.error('Screenshot buffer is empty!', { deviceId, chunks: chunks.length });
    emitDesktopDebug("device.error", "device", {}, { platform: "android", operation: "screenshot", deviceId, message: "Screenshot capture returned empty buffer" });
    throw new Error('Screenshot capture returned empty buffer');
  }

  if (deviceInfo.scale < 1.0) {
    buffer = await sharp(buffer)
      .resize({ width: deviceInfo.scaled_width, height: deviceInfo.scaled_height})
      .png()
      .toBuffer();
    logger.debug(`Screenshot scaled: ${buffer.length} bytes after scaling`);
  }

  const base64 = buffer.toString("base64");
  emitDesktopDebug("device.screenshot", "device", {}, {
    platform: "android",
    deviceId,
    width: deviceInfo?.scaled_width,
    height: deviceInfo?.scaled_height,
    base64Length: base64.length
  });
  return base64;
}
