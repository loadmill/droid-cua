import path from 'node:path';
import { access, appendFile, mkdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { app } from 'electron';
import { getDebugMode } from './settings-service';

type DebugScope = 'execution' | 'design' | 'device';

type DebugEvent = {
  event: string;
  scope: DebugScope;
  ids?: Record<string, unknown>;
  data?: Record<string, unknown>;
};

type SessionRecord = {
  id: string;
  scope: 'execution' | 'design';
  filePath: string;
  startedAt: string;
};

type WorkspaceBridgeEvent = {
  event?: unknown;
  scope?: unknown;
  ids?: unknown;
  data?: unknown;
};

const WORKSPACE_BRIDGE_KEY = '__DROID_DESKTOP_DEBUG_LOG_EVENT';
const LOGS_DIR_NAME = 'logs';
const DEVICE_LOG_NAME = 'device-events.jsonl';
const MAX_STRING_LENGTH = 1600;

function isPromptContentPath(pathParts: Array<string | number>): boolean {
  if (pathParts.length < 2) return false;
  const last = pathParts[pathParts.length - 1];
  if (last !== 'content') return false;
  return pathParts.includes('messages');
}

const executionSessions = new Map<string, SessionRecord>();
const designSessions = new Map<string, SessionRecord>();

let enabled = false;
let logsDirPath: string | null = null;
let deviceLogPath: string | null = null;
let currentLogFilePath: string | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function compactTimestamp(iso: string): string {
  return iso.replace(/[:.]/g, '-');
}

function sanitizeValue(value: unknown, pathParts: Array<string | number> = [], eventName = ''): unknown {
  if (typeof value === 'string') {
    if (eventName === 'cua.request.full' || eventName === 'cua.response.full') {
      return value;
    }
    if (isPromptContentPath(pathParts)) {
      return value;
    }
    if (value.length <= MAX_STRING_LENGTH) return value;
    return `${value.slice(0, MAX_STRING_LENGTH)}...<truncated:${value.length - MAX_STRING_LENGTH}>`;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, [...pathParts, index], eventName));
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = sanitizeValue(item, [...pathParts, key], eventName);
    }
    return output;
  }

  return value;
}

function serializeLine(event: DebugEvent): string {
  const payload = {
    ts: nowIso(),
    event: event.event,
    scope: event.scope,
    ids: sanitizeValue(event.ids ?? {}, [], event.event),
    data: sanitizeValue(event.data ?? {}, [], event.event)
  };
  return JSON.stringify(payload) + '\n';
}

function getActiveSessionFilePaths(): string[] {
  const all = [...executionSessions.values(), ...designSessions.values()];
  return all.map((record) => record.filePath);
}

function resolveSessionFile(scope: 'execution' | 'design', id: string): string | null {
  if (scope === 'execution') {
    return executionSessions.get(id)?.filePath ?? null;
  }
  return designSessions.get(id)?.filePath ?? null;
}

async function ensureLogsDir(): Promise<string> {
  if (logsDirPath) {
    await mkdir(logsDirPath, { recursive: true });
    return logsDirPath;
  }

  const userData = app.getPath('userData');
  logsDirPath = path.join(userData, LOGS_DIR_NAME);
  await mkdir(logsDirPath, { recursive: true });
  return logsDirPath;
}

async function ensureDeviceLogFile(): Promise<string> {
  if (deviceLogPath) return deviceLogPath;
  const dir = await ensureLogsDir();
  deviceLogPath = path.join(dir, DEVICE_LOG_NAME);
  return deviceLogPath;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function appendEvent(filePath: string, event: DebugEvent): Promise<void> {
  await appendFile(filePath, serializeLine(event), 'utf-8');
}

async function appendDeviceEvent(event: DebugEvent): Promise<void> {
  const logFile = await ensureDeviceLogFile();
  await appendEvent(logFile, event);

  for (const sessionFilePath of getActiveSessionFilePaths()) {
    if (sessionFilePath === logFile) continue;
    await appendEvent(sessionFilePath, event);
  }

  currentLogFilePath = getActiveSessionFilePaths().at(-1) ?? logFile;
}

function pickCurrentFile(): string | null {
  const activeExecution = [...executionSessions.values()].at(-1)?.filePath ?? null;
  if (activeExecution) return activeExecution;
  const activeDesign = [...designSessions.values()].at(-1)?.filePath ?? null;
  if (activeDesign) return activeDesign;
  return deviceLogPath;
}

export async function syncDebugLoggingEnabled(): Promise<boolean> {
  enabled = await getDebugMode();
  if (enabled) {
    await ensureLogsDir();
  }
  return enabled;
}

export function isEnabled(): boolean {
  return enabled;
}

export async function startExecutionSession(runId: string, data: Record<string, unknown> = {}): Promise<void> {
  if (!enabled) return;
  const dir = await ensureLogsDir();
  const startedAt = nowIso();
  const filename = `execution-${runId}-${compactTimestamp(startedAt)}.jsonl`;
  const filePath = path.join(dir, filename);

  await writeFile(filePath, '', 'utf-8');
  const session: SessionRecord = { id: runId, scope: 'execution', filePath, startedAt };
  executionSessions.set(runId, session);
  currentLogFilePath = filePath;

  await appendEvent(filePath, {
    event: 'session.started',
    scope: 'execution',
    ids: { runId },
    data: {
      startedAt,
      ...data
    }
  });
}

export async function endExecutionSession(runId: string, data: Record<string, unknown> = {}): Promise<void> {
  if (!enabled) return;
  const session = executionSessions.get(runId);
  if (!session) return;

  await appendEvent(session.filePath, {
    event: 'session.ended',
    scope: 'execution',
    ids: { runId },
    data: {
      startedAt: session.startedAt,
      endedAt: nowIso(),
      ...data
    }
  });

  executionSessions.delete(runId);
  currentLogFilePath = pickCurrentFile();
}

export async function startDesignSession(sessionId: string, data: Record<string, unknown> = {}): Promise<void> {
  if (!enabled) return;
  const dir = await ensureLogsDir();
  const startedAt = nowIso();
  const filename = `design-${sessionId}-${compactTimestamp(startedAt)}.jsonl`;
  const filePath = path.join(dir, filename);

  await writeFile(filePath, '', 'utf-8');
  const session: SessionRecord = { id: sessionId, scope: 'design', filePath, startedAt };
  designSessions.set(sessionId, session);
  currentLogFilePath = filePath;

  await appendEvent(filePath, {
    event: 'session.started',
    scope: 'design',
    ids: { sessionId },
    data: {
      startedAt,
      ...data
    }
  });
}

export async function endDesignSession(sessionId: string, data: Record<string, unknown> = {}): Promise<void> {
  if (!enabled) return;
  const session = designSessions.get(sessionId);
  if (!session) return;

  await appendEvent(session.filePath, {
    event: 'session.ended',
    scope: 'design',
    ids: { sessionId },
    data: {
      startedAt: session.startedAt,
      endedAt: nowIso(),
      ...data
    }
  });

  designSessions.delete(sessionId);
  currentLogFilePath = pickCurrentFile();
}

export async function logDeviceEvent(event: Omit<DebugEvent, 'scope'> & { scope?: DebugScope }): Promise<void> {
  if (!enabled) return;
  await appendDeviceEvent({
    event: event.event,
    scope: 'device',
    ids: event.ids,
    data: event.data
  });
}

export async function logSessionEvent(scope: 'execution' | 'design', id: string, event: Omit<DebugEvent, 'scope'>): Promise<void> {
  if (!enabled) return;

  const sessionFile = resolveSessionFile(scope, id);
  if (!sessionFile) return;

  await appendEvent(sessionFile, {
    event: event.event,
    scope,
    ids: event.ids,
    data: event.data
  });
}

export async function logWorkspaceEvent(rawEvent: WorkspaceBridgeEvent): Promise<void> {
  if (!enabled) return;
  const event = typeof rawEvent.event === 'string' ? rawEvent.event : '';
  const scope = rawEvent.scope === 'execution' || rawEvent.scope === 'design' || rawEvent.scope === 'device' ? rawEvent.scope : null;
  const ids = rawEvent.ids && typeof rawEvent.ids === 'object' ? (rawEvent.ids as Record<string, unknown>) : {};
  const data = rawEvent.data && typeof rawEvent.data === 'object' ? (rawEvent.data as Record<string, unknown>) : {};
  if (!event || !scope) return;

  if (scope === 'device') {
    await logDeviceEvent({ event, ids, data });
    return;
  }

  const idKey = scope === 'execution' ? 'runId' : 'sessionId';
  const idValue = typeof ids[idKey] === 'string' ? (ids[idKey] as string) : '';
  if (idValue) {
    await logSessionEvent(scope, idValue, { event, ids, data });
    return;
  }

  // Fallback to latest active session if no explicit ID was provided.
  const sessionFilePath =
    scope === 'execution' ? [...executionSessions.values()].at(-1)?.filePath ?? null : [...designSessions.values()].at(-1)?.filePath ?? null;
  if (!sessionFilePath) return;

  await appendEvent(sessionFilePath, { event, scope, ids, data });
}

export function installWorkspaceDebugBridge(): void {
  const target = globalThis as Record<string, unknown>;
  target[WORKSPACE_BRIDGE_KEY] = (event: WorkspaceBridgeEvent) => {
    void logWorkspaceEvent(event);
  };
}

export async function getCurrentLogFilePath(): Promise<string | null> {
  const current = currentLogFilePath ?? pickCurrentFile();
  if (current && (await fileExists(current))) {
    return current;
  }

  if (deviceLogPath && (await fileExists(deviceLogPath))) {
    return deviceLogPath;
  }
  return null;
}

export async function getLogsDirPath(): Promise<string> {
  return ensureLogsDir();
}
