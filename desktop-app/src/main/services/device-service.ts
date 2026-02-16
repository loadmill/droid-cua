import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { ConnectionState, DeviceOption, LogEvent } from '../../preload/types';
import { importWorkspaceModule } from './module-loader';

const execAsync = promisify(exec);

type Platform = 'android' | 'ios';
type DeviceInfo = NonNullable<ConnectionState['deviceInfo']>;

const state: {
  connection: ConnectionState;
} = {
  connection: {
    connected: false,
    platform: null,
    deviceName: null,
    deviceId: null
  }
};

function nowIso(): string {
  return new Date().toISOString();
}

function pushLog(onLog: (event: LogEvent) => void, kind: LogEvent['kind'], text: string): void {
  onLog({ ts: nowIso(), kind, text });
}

async function getAndroidDevices(): Promise<DeviceOption[]> {
  const devices: DeviceOption[] = [];

  try {
    const { stdout } = await execAsync('adb devices');
    const runningIds = stdout
      .trim()
      .split('\n')
      .slice(1)
      .map((line) => line.split('\t')[0])
      .filter((id) => id.startsWith('emulator-'));

    for (const id of runningIds) {
      try {
        const { stdout: avdStdout } = await execAsync(`adb -s ${id} emu avd name`);
        const name = avdStdout.trim();
        if (!name) continue;
        devices.push({
          name,
          label: `${name} (running)`,
          platform: 'android',
          running: true
        });
      } catch {
        // ignore per-device failures
      }
    }
  } catch {
    // ignore if adb unavailable
  }

  try {
    const { stdout } = await execAsync('emulator -list-avds');
    const avds = stdout
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    for (const avd of avds) {
      if (!devices.some((device) => device.name === avd)) {
        devices.push({
          name: avd,
          label: avd,
          platform: 'android',
          running: false
        });
      }
    }
  } catch {
    // ignore if emulator unavailable
  }

  return devices.sort((a, b) => {
    if (a.running !== b.running) return a.running ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function getIosDevices(): Promise<DeviceOption[]> {
  try {
    const { stdout } = await execAsync('xcrun simctl list devices --json');
    const data = JSON.parse(stdout) as { devices: Record<string, Array<{ name: string; isAvailable: boolean; state: string }>> };
    const seen = new Set<string>();
    const devices: DeviceOption[] = [];

    for (const [runtime, runtimeDevices] of Object.entries(data.devices)) {
      const versionMatch = runtime.match(/iOS[- ](\d+[-\.]\d+)/i);
      const version = versionMatch ? versionMatch[1].replace('-', '.') : '';

      for (const device of runtimeDevices) {
        if (!device.isAvailable || !device.name.startsWith('iPhone') || seen.has(device.name)) {
          continue;
        }

        seen.add(device.name);
        const running = device.state === 'Booted';
        const versionText = version ? ` - iOS ${version}` : '';
        devices.push({
          name: device.name,
          label: `${device.name}${running ? ' (running)' : ''}${versionText}`,
          platform: 'ios',
          running
        });
      }
    }

    return devices.sort((a, b) => {
      if (a.running !== b.running) return a.running ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

async function withCapturedConsole<T>(fn: () => Promise<T>, onLog: (event: LogEvent) => void): Promise<T> {
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    originalLog(...args);
    pushLog(onLog, 'info', args.map(String).join(' '));
  };

  console.error = (...args: unknown[]) => {
    originalError(...args);
    pushLog(onLog, 'error', args.map(String).join(' '));
  };

  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

export async function refreshDevices(platform: Platform, onLog: (event: LogEvent) => void): Promise<DeviceOption[]> {
  pushLog(onLog, 'system', `Refreshing ${platform} devices...`);
  const devices = platform === 'ios' ? await getIosDevices() : await getAndroidDevices();
  pushLog(onLog, 'info', `Found ${devices.length} ${platform} device(s).`);
  return devices;
}

export async function connectDevice(
  payload: { platform: Platform; deviceName: string },
  onLog: (event: LogEvent) => void
): Promise<ConnectionState> {
  const { connectToDevice, getDeviceInfo } = await importWorkspaceModule<{
    connectToDevice: (deviceName: string, platform: Platform) => Promise<string>;
    getDeviceInfo: (deviceId: string) => Promise<unknown>;
  }>('src/device/connection.js');

  const connection = await withCapturedConsole(async () => {
    const deviceId = await connectToDevice(payload.deviceName, payload.platform);
    const rawDeviceInfo = await getDeviceInfo(deviceId);
    const deviceInfo: DeviceInfo = {
      device_width: Number((rawDeviceInfo as Record<string, unknown>).device_width),
      device_height: Number((rawDeviceInfo as Record<string, unknown>).device_height),
      scaled_width: Number((rawDeviceInfo as Record<string, unknown>).scaled_width),
      scaled_height: Number((rawDeviceInfo as Record<string, unknown>).scaled_height),
      scale: Number((rawDeviceInfo as Record<string, unknown>).scale)
    };

    const next: ConnectionState = {
      connected: true,
      platform: payload.platform,
      deviceName: payload.deviceName,
      deviceId,
      resolution: `${deviceInfo.scaled_width}x${deviceInfo.scaled_height}`,
      deviceInfo
    };

    state.connection = next;
    return next;
  }, onLog);

  pushLog(onLog, 'success', `Connected to ${payload.deviceName}.`);
  return connection;
}

export function getConnectionState(): ConnectionState {
  return state.connection;
}
