/**
 * Interactive device selection menu
 */

import { exec } from "child_process";
import { promisify } from "util";
import readline from "readline";

const execAsync = promisify(exec);

/**
 * Create a readline interface for user input
 */
function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user to select from a list of options
 * @param {string} question - The question to ask
 * @param {Array<{label: string, value: string}>} options - Available options
 * @returns {Promise<string>} Selected value
 */
async function selectFromList(question, options) {
  const rl = createReadline();

  console.log(`\n${question}\n`);
  options.forEach((opt, i) => {
    console.log(`  ${i + 1}. ${opt.label}`);
  });
  console.log();

  return new Promise((resolve) => {
    const ask = () => {
      rl.question(`Select (1-${options.length}): `, (answer) => {
        const index = parseInt(answer, 10) - 1;
        if (index >= 0 && index < options.length) {
          rl.close();
          resolve(options[index].value);
        } else {
          console.log("Invalid selection, try again.");
          ask();
        }
      });
    };
    ask();
  });
}

/**
 * Get list of available Android AVDs
 * @returns {Promise<Array<{label: string, value: string, running: boolean}>>}
 */
async function getAndroidDevices() {
  const devices = [];

  // Get running emulators
  try {
    const { stdout: adbOutput } = await execAsync("adb devices");
    const runningIds = adbOutput
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => line.split("\t")[0])
      .filter((id) => id.startsWith("emulator-"));

    for (const id of runningIds) {
      try {
        const { stdout } = await execAsync(`adb -s ${id} emu avd name`);
        const name = stdout.trim();
        devices.push({
          label: `${name} (running)`,
          value: name,
          running: true,
        });
      } catch {}
    }
  } catch {}

  // Get available AVDs
  try {
    const { stdout } = await execAsync("emulator -list-avds");
    const avds = stdout.trim().split("\n").filter((name) => name.length > 0);

    for (const avd of avds) {
      // Don't add if already in running list
      if (!devices.some((d) => d.value === avd)) {
        devices.push({
          label: avd,
          value: avd,
          running: false,
        });
      }
    }
  } catch {}

  return devices;
}

/**
 * Get list of available iOS Simulators
 * @returns {Promise<Array<{label: string, value: string, running: boolean}>>}
 */
async function getIOSDevices() {
  const devices = [];

  try {
    const { stdout } = await execAsync("xcrun simctl list devices --json");
    const data = JSON.parse(stdout);

    // Collect all available devices, noting which are booted
    const seen = new Set();

    for (const [runtime, deviceList] of Object.entries(data.devices)) {
      // Extract iOS version from runtime string
      const versionMatch = runtime.match(/iOS[- ](\d+[-\.]\d+)/i);
      const version = versionMatch ? versionMatch[1].replace("-", ".") : "";

      for (const device of deviceList) {
        // Only include iPhones (skip iPads, Apple TVs, Apple Watches, etc.)
        if (device.isAvailable && !seen.has(device.name) && device.name.startsWith("iPhone")) {
          seen.add(device.name);
          const isBooted = device.state === "Booted";
          devices.push({
            label: isBooted
              ? `${device.name} (running)${version ? ` - iOS ${version}` : ""}`
              : `${device.name}${version ? ` - iOS ${version}` : ""}`,
            value: device.name,
            running: isBooted,
          });
        }
      }
    }

    // Sort: running first, then alphabetically
    devices.sort((a, b) => {
      if (a.running && !b.running) return -1;
      if (!a.running && b.running) return 1;
      return a.value.localeCompare(b.value);
    });
  } catch {}

  return devices;
}

/**
 * Interactive device selection
 * @returns {Promise<{platform: string, deviceName: string}>}
 */
export async function selectDevice() {
  // Check what's available
  const [androidDevices, iosDevices] = await Promise.all([
    getAndroidDevices(),
    getIOSDevices(),
  ]);

  const hasAndroid = androidDevices.length > 0;
  const hasIOS = iosDevices.length > 0;

  if (!hasAndroid && !hasIOS) {
    console.error("\nNo devices found!");
    console.error("  Android: Create an AVD with Android Studio");
    console.error("  iOS: Xcode Simulator must be available");
    process.exit(1);
  }

  // Build platform options
  const platformOptions = [];
  if (hasAndroid) {
    const runningCount = androidDevices.filter((d) => d.running).length;
    platformOptions.push({
      label: `Android${runningCount > 0 ? ` (${runningCount} running)` : ""} - ${androidDevices.length} device(s)`,
      value: "android",
    });
  }
  if (hasIOS) {
    const runningCount = iosDevices.filter((d) => d.running).length;
    platformOptions.push({
      label: `iOS${runningCount > 0 ? ` (${runningCount} running)` : ""} - ${iosDevices.length} simulator(s)`,
      value: "ios",
    });
  }

  // Select platform
  let platform;
  if (platformOptions.length === 1) {
    platform = platformOptions[0].value;
    console.log(`\nUsing ${platform} (only available platform)`);
  } else {
    platform = await selectFromList("Select platform:", platformOptions);
  }

  // Select device
  const deviceList = platform === "ios" ? iosDevices : androidDevices;

  let deviceName;
  if (deviceList.length === 1) {
    deviceName = deviceList[0].value;
    console.log(`Using ${deviceName} (only available device)`);
  } else {
    // Check for running device - prefer it
    const runningDevice = deviceList.find((d) => d.running);
    if (runningDevice) {
      // Move running device to top of list
      const sorted = [
        runningDevice,
        ...deviceList.filter((d) => d !== runningDevice),
      ];
      deviceName = await selectFromList(
        `Select ${platform === "ios" ? "simulator" : "emulator"}:`,
        sorted
      );
    } else {
      deviceName = await selectFromList(
        `Select ${platform === "ios" ? "simulator" : "emulator"}:`,
        deviceList
      );
    }
  }

  return { platform, deviceName };
}
