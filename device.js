import { exec, spawn } from "child_process";
import { once } from "events";
import { promisify } from "util";
import sharp from "sharp";

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

export async function connectToDevice(avdName) {
  const devices = await listConnectedDevices();

  for (const id of devices) {
    if (id.startsWith("emulator-")) {
      try {
        const { stdout } = await execAsync(`adb -s ${id} emu avd name`);
        if (stdout.trim() === avdName) {
          console.log(`Emulator ${avdName} is already running as ${id}`);
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
    console.error(`Emulator ${avdName} did not appear in time.`);
    process.exit(1);
  }

  console.log(`Device ${deviceId} detected. Waiting for boot...`);
  const booted = await waitForDeviceBoot(deviceId);
  if (!booted) {
    console.error(`Emulator ${avdName} did not finish booting.`);
    process.exit(1);
  }

  console.log(`Emulator ${avdName} is fully booted.`);
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

export async function getScreenshotAsBase64(deviceId, scale = 1.0) {
  const adb = spawn("adb", ["-s", deviceId, "exec-out", "screencap", "-p"]);
  const chunks = [];

  adb.stdout.on("data", chunk => chunks.push(chunk));
  adb.stderr.on("data", err => console.error("ADB stderr:", err.toString()));

  const [code] = await once(adb, "close");

  if (code !== 0) {
    throw new Error(`adb screencap exited with code ${code}`);
  }

  let buffer = Buffer.concat(chunks);

  if (scale < 1.0) {
    buffer = await sharp(buffer)
      .resize({ width: Math.round(1080 * scale) })
      .png()
      .toBuffer();
  }

  return buffer.toString("base64");
}
