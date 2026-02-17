import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { LogEvent } from '../../preload/types';
import { getConnectionState } from './device-service';
import { importWorkspaceModule } from './module-loader';

let activeRun: { runId: string; mode: { shouldStop: boolean } | null } = {
  runId: '',
  mode: null
};
let pendingExecutionInputResolve: ((value: string) => void) | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

type ExecutionOutputItem = {
  type?: string;
  text?: string;
  eventType?: LogEvent['eventType'];
  actionType?: LogEvent['actionType'];
  runId?: string;
  stepId?: string;
  instructionIndex?: number;
  payload?: Record<string, unknown>;
};

function emit(onLog: (event: LogEvent) => void, kind: LogEvent['kind'], text: string, extra: Partial<LogEvent> = {}): void {
  onLog({ ts: nowIso(), kind, text, ...extra });
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
    importWorkspaceModule<{ ExecutionMode: new (session: unknown, engine: unknown, instructions: string[], isHeadlessMode?: boolean) => { execute: (context?: { runId?: string; waitForUserInput?: () => Promise<string>; addOutput?: (item: ExecutionOutputItem) => void }) => Promise<{ success?: boolean; error?: string } | undefined>; shouldStop: boolean; stats?: { startTime?: number; actionCount?: number; instructionsCompleted?: number; retryCount?: number; assertionsPassed?: number; assertionsFailed?: number } } }>('src/modes/execution-mode.js'),
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

  emit(onLog, 'system', `Loading test: ${filename.replace(/\.dcua$/i, '')}`, {
    eventType: 'run_started',
    runId,
    payload: {
      testName: filename,
      instructionsTotal: instructions.length,
      platform: connection.platform,
      deviceName: connection.deviceName
    }
  });
  emit(onLog, 'info', `Loaded ${instructions.length} instructions`, {
    eventType: 'system_message',
    runId,
    payload: {
      testName: filename,
      instructionsTotal: instructions.length
    }
  });

  let runSuccess = false;
  let runError: string | null = null;
  void mode
    .execute({
      runId,
      waitForUserInput: () =>
        new Promise<string>((resolve) => {
          pendingExecutionInputResolve = resolve;
        }),
      addOutput: (item: ExecutionOutputItem) => {
        const text = item?.text ?? '';
        if (!text && !item.eventType) return;

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

        emit(onLog, kind, text, {
          eventType: item.eventType,
          actionType: item.actionType,
          runId: item.runId ?? runId,
          stepId: item.stepId,
          instructionIndex: item.instructionIndex,
          payload: item.payload
        });
      }
    })
    .then((result: { success?: boolean; error?: string } | undefined) => {
      runSuccess = Boolean(result?.success);
      runError = result?.error ?? null;
    })
    .catch((error: Error) => {
      runError = error.message;
      emit(onLog, 'error', error.message, {
        eventType: 'error',
        runId,
        payload: { message: error.message }
      });
    })
    .finally(() => {
      pendingExecutionInputResolve = null;
      const stats = (mode as { stats?: { startTime?: number; actionCount?: number; instructionsCompleted?: number; retryCount?: number; assertionsPassed?: number; assertionsFailed?: number } }).stats;
      const durationMs = stats?.startTime ? Math.max(0, Date.now() - stats.startTime) : 0;
      emit(onLog, 'system', `Execution finished: ${filename}`, {
        eventType: 'run_finished',
        runId,
        payload: {
          success: runSuccess,
          error: runError,
          durationMs,
          instructionsTotal: instructions.length,
          instructionsCompleted: stats?.instructionsCompleted ?? 0,
          actionsTotal: stats?.actionCount ?? 0,
          assertionsPassed: stats?.assertionsPassed ?? 0,
          assertionsFailed: stats?.assertionsFailed ?? 0,
          retries: stats?.retryCount ?? 0
        }
      });
      activeRun = { runId: '', mode: null };
    });

  return { runId };
}

export async function stopExecution(runId: string): Promise<{ stopped: true }> {
  if (!activeRun.mode || activeRun.runId !== runId) {
    throw new Error('No active run matching this run ID.');
  }

  activeRun.mode.shouldStop = true;
  if (pendingExecutionInputResolve) {
    pendingExecutionInputResolve('stop');
    pendingExecutionInputResolve = null;
  }
  return { stopped: true };
}

export async function respondExecution(runId: string, input: string): Promise<{ accepted: true }> {
  if (!activeRun.mode || activeRun.runId !== runId) {
    throw new Error('No active run matching this run ID.');
  }
  if (!pendingExecutionInputResolve) {
    throw new Error('No pending execution input request.');
  }

  pendingExecutionInputResolve(input);
  pendingExecutionInputResolve = null;
  return { accepted: true };
}
