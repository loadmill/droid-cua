/**
 * Interactive device selection menu using Ink
 */

import React, { useState } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Interactive selection component with arrow key navigation
 */
function SelectList({ title, items, onSelect }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    }
    if (key.return) {
      onSelect(items[selectedIndex]);
    }
    if (input === 'q' || key.escape) {
      exit();
      process.exit(0);
    }
  });

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
        <Text bold color="cyan">{title}</Text>
      </Box>

      <Box flexDirection="column" paddingX={1}>
        {items.map((item, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Box key={item.value + index}>
              <Text color={isSelected ? 'green' : undefined}>
                {isSelected ? '❯ ' : '  '}
              </Text>
              <Text bold={isSelected} color={isSelected ? 'green' : undefined}>
                {item.label}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} paddingX={1}>
        <Text dimColor>↑/↓ Navigate  Enter Select  q Quit</Text>
      </Box>
    </Box>
  );
}

/**
 * Render a selection and wait for result
 */
function renderSelection(title, items) {
  return new Promise((resolve) => {
    const { unmount } = render(
      <SelectList
        title={title}
        items={items}
        onSelect={(item) => {
          unmount();
          resolve(item);
        }}
      />
    );
  });
}

/**
 * Get list of available Android AVDs
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
 * Get list of available iOS Simulators (iPhones only)
 */
async function getIOSDevices() {
  const devices = [];

  try {
    const { stdout } = await execAsync("xcrun simctl list devices --json");
    const data = JSON.parse(stdout);
    const seen = new Set();

    for (const [runtime, deviceList] of Object.entries(data.devices)) {
      const versionMatch = runtime.match(/iOS[- ](\d+[-\.]\d+)/i);
      const version = versionMatch ? versionMatch[1].replace("-", ".") : "";

      for (const device of deviceList) {
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
      label: `Android${runningCount > 0 ? ` (${runningCount} running)` : ""} - ${androidDevices.length} emulator(s)`,
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
    console.log(`\nUsing ${platform} (only available platform)\n`);
  } else {
    const selected = await renderSelection("Select Platform", platformOptions);
    platform = selected.value;
  }

  // Select device
  const deviceList = platform === "ios" ? iosDevices : androidDevices;
  const deviceType = platform === "ios" ? "Simulator" : "Emulator";

  let deviceName;
  if (deviceList.length === 1) {
    deviceName = deviceList[0].value;
    console.log(`Using ${deviceName} (only available ${deviceType.toLowerCase()})\n`);
  } else {
    const selected = await renderSelection(`Select ${deviceType}`, deviceList);
    deviceName = selected.value;
  }

  // Clear some space after selection
  console.log();

  return { platform, deviceName };
}
