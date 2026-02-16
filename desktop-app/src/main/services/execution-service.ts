import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { LogEvent } from '../../preload/types';
import { getConnectionState } from './device-service';
import { importWorkspaceModule } from './module-loader';

let activeRun: { runId: string; mode: { shouldStop: boolean } | null } = {
  runId: '',
  mode: null
};

function nowIso(): string {
  return new Date().toISOString();
}

function emit(onLog: (event: LogEvent) => void, kind: LogEvent['kind'], text: string): void {
  onLog({ ts: nowIso(), kind, text });
}

export async function startExecution(testPath: string, testName: string, onLog: (event: LogEvent) => void): Promise<{ runId: string }> {
  if (activeRun.mode) {
    throw new Error('A test execution is already in progress.');
  }

  const connection = getConnectionState();
  if (!connection.connected || !connection.deviceId) {
    throw new Error('No device connected. Connect a device before running a test.');
  }
  if (!connection.deviceInfo) {
    throw new Error('Missing device info. Reconnect the device and try again.');
  }

  const runId = randomUUID();
  const filename = testName.endsWith('.dcua') ? testName : `${testName}.dcua`;

  const content = await readFile(testPath, 'utf-8');
  const instructions = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const [{ Session }, { ExecutionEngine }, { ExecutionMode }, { buildExecutionModePrompt }, { logger }] = await Promise.all([
    importWorkspaceModule<{ Session: new (deviceId: string, deviceInfo: unknown) => { deviceInfo: unknown; setSystemPrompt: (prompt: string) => void; deviceName?: string | null } }>('src/core/session.js'),
    importWorkspaceModule<{ ExecutionEngine: new (session: unknown, options?: { recordScreenshots?: boolean }) => unknown }>('src/core/execution-engine.js'),
    importWorkspaceModule<{ ExecutionMode: new (session: unknown, engine: unknown, instructions: string[], isHeadlessMode?: boolean) => { execute: (context?: { addOutput?: (item: { type?: string; text?: string }) => void }) => Promise<unknown>; shouldStop: boolean } }>('src/modes/execution-mode.js'),
    importWorkspaceModule<{ buildExecutionModePrompt: (deviceInfo: unknown) => string }>('src/core/prompts.js'),
    importWorkspaceModule<{ logger: { init: (debug: boolean) => Promise<void> } }>('src/utils/logger.js')
  ]);

  await logger.init(false);

  const session = new Session(connection.deviceId, {
    ...connection.deviceInfo
  });

  (session as { deviceName?: string | null }).deviceName = connection.deviceName;

  const systemPrompt = buildExecutionModePrompt(session.deviceInfo);
  session.setSystemPrompt(systemPrompt);

  const engine = new ExecutionEngine(session, {
    recordScreenshots: false
  });

  const mode = new ExecutionMode(session, engine, instructions, false);
  activeRun = { runId, mode };

  emit(onLog, 'system', `Running ${filename}...`);

  void mode
    .execute({
      addOutput: (item: { type?: string; text?: string }) => {
        const text = item?.text ?? '';
        if (!text) return;

        const type = item.type ?? 'info';
        const kind: LogEvent['kind'] =
          type === 'user' ||
          type === 'assistant' ||
          type === 'reasoning' ||
          type === 'action' ||
          type === 'warning' ||
          type === 'info' ||
          type === 'error' ||
          type === 'success' ||
          type === 'system' ||
          type === 'muted'
            ? type
            : 'info';

        emit(onLog, kind, text);
      }
    })
    .catch((error: Error) => {
      emit(onLog, 'error', error.message);
    })
    .finally(() => {
      emit(onLog, 'system', `Execution finished: ${filename}`);
      activeRun = { runId: '', mode: null };
    });

  return { runId };
}

export async function stopExecution(runId: string): Promise<{ stopped: true }> {
  if (!activeRun.mode || activeRun.runId !== runId) {
    throw new Error('No active run matching this run ID.');
  }

  activeRun.mode.shouldStop = true;
  return { stopped: true };
}
