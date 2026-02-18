import { randomUUID } from 'node:crypto';
import type { LogEvent } from '../../preload/types';
import { getConnectionState } from './device-service';
import { hasActiveExecutionRun } from './execution-service';
import { importWorkspaceModule } from './module-loader';
import { createTest, saveTest } from './test-service';
import { getProjectFolderById } from './project-folders-service';
import { getPromptCustomizations } from './prompt-customizations-service';

type DesignPhase = 'idle' | 'awaiting_initial_input' | 'exploring' | 'script_generated' | 'saving' | 'error';

type DesignOutputItem = {
  type?: LogEvent['kind'];
  text?: string;
  eventType?: LogEvent['eventType'];
  actionType?: LogEvent['actionType'];
  payload?: Record<string, unknown>;
};

interface ActiveDesignSession {
  sessionId: string;
  phase: DesignPhase;
  stopped: boolean;
  loopRunning: boolean;
  guidanceQueue: string[];
  generatedScript: string | null;
  baseDesignPrompt: string;
  initialUserPrompt: string | null;
  consecutiveErrorCount: number;
  onLog: (event: LogEvent) => void;
  session: {
    deviceInfo: unknown;
    deviceId: string;
    previousResponseId: string | null;
    messages: unknown[];
    transcript: string[];
    setSystemPrompt: (prompt: string) => void;
    addToTranscript: (line: string) => void;
    addMessage: (role: string, content: string) => void;
    updateResponseId: (responseId: string | null | undefined) => void;
    clearMessages: () => void;
  };
  engine: {
    runFullTurn: (
      response: unknown,
      trackAction?: ((action: { type: string } | null) => boolean) | null,
      context?: { addOutput: (item: DesignOutputItem) => void; runId?: string } | null
    ) => Promise<string>;
  };
  sendCUARequest: (args: {
    messages: unknown[];
    screenshotBase64?: string;
    previousResponseId?: string | null;
    deviceInfo: unknown;
  }) => Promise<{ id: string }>;
  getScreenshotAsBase64: (deviceId: string, deviceInfo: unknown) => Promise<string>;
  reviseTestScript: (originalScript: string, revisionRequest: string) => Promise<string>;
}

let activeDesign: ActiveDesignSession | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function emit(onLog: (event: LogEvent) => void, kind: LogEvent['kind'], text: string, extra: Partial<LogEvent> = {}): void {
  onLog({ ts: nowIso(), kind, text, ...extra });
}

function mapOutputKind(item: DesignOutputItem): LogEvent['kind'] {
  const type = item.type ?? 'info';
  if (
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
  ) {
    return type;
  }
  return 'info';
}

function extractGeneratedScript(transcript: string[]): string | null {
  const transcriptText = transcript.join('\n');
  const codeBlockRegex = /```(?:\w+)?\s*\n([\s\S]*?)\n```/g;
  const matches = [...transcriptText.matchAll(codeBlockRegex)];
  if (matches.length === 0) {
    // Fallback: detect numbered/bulleted script-like assistant output even without code fences.
    for (let i = transcript.length - 1; i >= 0; i -= 1) {
      const line = transcript[i];
      if (!line.startsWith('[Assistant] ')) {
        continue;
      }

      const assistantText = line.replace(/^\[Assistant\]\s*/, '').trim();
      const normalized = normalizeScriptLikeAssistantText(assistantText);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }
  return matches[matches.length - 1]?.[1]?.trim() ?? null;
}

function normalizeScriptLikeAssistantText(text: string): string | null {
  const numberedPattern = /(?:^|\s)\d+\.\s+/;
  const bulletedPattern = /(?:^|\s)[*-]\s+/;

  if (!numberedPattern.test(text) && !bulletedPattern.test(text)) {
    return null;
  }

  // Split compact formats like "1. Open... 2. Click..." into lines.
  const withLineBreaks = text
    .replace(/\s+(\d+\.)\s+/g, '\n$1 ')
    .replace(/\s+([*-])\s+/g, '\n$1 ')
    .trim();

  const parsedLines = withLineBreaks
    .split('\n')
    .map((line) => line.replace(/^\s*(?:\d+\.|[*-])\s*/, '').trim())
    .filter(Boolean);

  if (parsedLines.length < 3) {
    return null;
  }

  // Treat question/analysis style responses as non-scripts.
  const looksConversational = parsedLines.some((line) => /\?$/.test(line));
  if (looksConversational) {
    return null;
  }

  if (!parsedLines.some((line) => line.toLowerCase() === 'exit')) {
    parsedLines.push('exit');
  }

  return parsedLines.join('\n');
}

function finishActiveDesign(reason: 'saved' | 'stopped' | 'error'): void {
  if (!activeDesign) return;
  const sessionId = activeDesign.sessionId;
  if (reason === 'saved') {
    emit(activeDesign.onLog, 'system', 'Design session completed.', { eventType: 'design_finished', payload: { sessionId, reason } });
  } else if (reason === 'stopped') {
    emit(activeDesign.onLog, 'system', 'Design session stopped.', { eventType: 'design_finished', payload: { sessionId, reason } });
  } else {
    emit(activeDesign.onLog, 'system', 'Design session ended with errors.', { eventType: 'design_finished', payload: { sessionId, reason } });
  }
  activeDesign.session.updateResponseId(undefined);
  activeDesign.session.clearMessages();
  activeDesign = null;
}

async function runLoop(): Promise<void> {
  if (!activeDesign || activeDesign.loopRunning || activeDesign.phase !== 'exploring' || activeDesign.stopped) {
    return;
  }

  activeDesign.loopRunning = true;
  const currentSessionId = activeDesign.sessionId;
  let shouldContinueAfterFinally = false;

  try {
    while (activeDesign && activeDesign.sessionId === currentSessionId && !activeDesign.stopped && activeDesign.phase === 'exploring') {
      if (activeDesign.guidanceQueue.length > 0) {
        const guidance = activeDesign.guidanceQueue.shift();
        if (guidance) {
          activeDesign.session.addToTranscript(`[User Guidance] ${guidance}`);
          activeDesign.session.addMessage('user', guidance);
          activeDesign.session.updateResponseId(null);
        }
      }

      emit(activeDesign.onLog, 'info', 'Agent is exploring autonomously...', {
        eventType: 'design_status',
        payload: { phase: activeDesign.phase, sessionId: activeDesign.sessionId }
      });

      const screenshotBase64 = await activeDesign.getScreenshotAsBase64(activeDesign.session.deviceId, activeDesign.session.deviceInfo);
      const response = await activeDesign.sendCUARequest({
        messages: activeDesign.session.messages,
        screenshotBase64,
        previousResponseId: activeDesign.session.previousResponseId,
        deviceInfo: activeDesign.session.deviceInfo
      });

      const newResponseId = await activeDesign.engine.runFullTurn(
        response,
        () => Boolean(activeDesign?.stopped || (activeDesign?.guidanceQueue.length ?? 0) > 0),
        {
          addOutput: (item: DesignOutputItem) => {
            if (!activeDesign) return;
            const text = item.text ?? '';
            if (!text && !item.eventType) return;
            emit(activeDesign.onLog, mapOutputKind(item), text, {
              eventType: item.eventType,
              actionType: item.actionType,
              payload: item.payload,
              runId: activeDesign.sessionId
            });
          },
          runId: activeDesign.sessionId
        }
      );

      if (!activeDesign || activeDesign.sessionId !== currentSessionId) {
        return;
      }

      activeDesign.session.updateResponseId(newResponseId);
      activeDesign.consecutiveErrorCount = 0;

      if (activeDesign.guidanceQueue.length > 0) {
        emit(activeDesign.onLog, 'system', 'Guidance received. Adjusting exploration...', {
          eventType: 'design_status',
          payload: { phase: activeDesign.phase, sessionId: activeDesign.sessionId }
        });
        continue;
      }

      const script = extractGeneratedScript(activeDesign.session.transcript);
      if (script) {
        activeDesign.generatedScript = script;
        activeDesign.phase = 'script_generated';
        emit(activeDesign.onLog, 'success', 'Generated test script.', {
          eventType: 'design_generated_script',
          payload: { script, sessionId: activeDesign.sessionId }
        });
        return;
      }
    }
  } catch (error) {
    if (!activeDesign || activeDesign.sessionId !== currentSessionId) {
      return;
    }
    const message = error instanceof Error ? error.message : 'Unknown design mode error';
    activeDesign.consecutiveErrorCount += 1;

    if (activeDesign.consecutiveErrorCount <= 2) {
      emit(activeDesign.onLog, 'error', message, {
        payload: { message, sessionId: activeDesign.sessionId, recoverable: true }
      });
      emit(activeDesign.onLog, 'info', 'Recovering from error and continuing...', {
        eventType: 'design_status',
        payload: { phase: activeDesign.phase, sessionId: activeDesign.sessionId, recovering: true }
      });

      const transcriptText = activeDesign.session.transcript.join('\n');
      const recoveryPrompt = `${activeDesign.baseDesignPrompt}

RECOVERY MODE:
The previous turn failed with error: "${message}".
Continue from the current app state without repeating completed steps unless needed.

Transcript so far:
${transcriptText}

Original objective:
${activeDesign.initialUserPrompt ?? '(not provided)'}

If the objective is already completed, generate the final test script now.`;

      activeDesign.session.setSystemPrompt(recoveryPrompt);
      activeDesign.session.updateResponseId(null);
      activeDesign.phase = 'exploring';
      shouldContinueAfterFinally = true;
    }

    if (!shouldContinueAfterFinally) {
      activeDesign.phase = 'error';
      emit(activeDesign.onLog, 'error', message, {
        eventType: 'design_error',
        payload: { message, sessionId: activeDesign.sessionId, recoverable: false }
      });
    }
  } finally {
    if (activeDesign && activeDesign.sessionId === currentSessionId) {
      activeDesign.loopRunning = false;
    }
    if (shouldContinueAfterFinally && activeDesign && activeDesign.sessionId === currentSessionId && !activeDesign.stopped && activeDesign.phase === 'exploring') {
      setTimeout(() => {
        void runLoop();
      }, 0);
    }
  }
}

export async function startDesign(onLog: (event: LogEvent) => void): Promise<{ sessionId: string }> {
  if (activeDesign) {
    throw new Error('A design session is already in progress.');
  }
  if (hasActiveExecutionRun()) {
    throw new Error('Cannot start design mode while test execution is running.');
  }

  const connection = getConnectionState();
  if (!connection.connected || !connection.deviceId) {
    throw new Error('No device connected. Go to Devices and connect before starting design mode.');
  }
  if (!connection.deviceInfo) {
    throw new Error('Missing device info. Reconnect the device before starting design mode.');
  }

  const [{ Session }, { ExecutionEngine }, { buildDesignModePrompt }, { sendCUARequest, reviseTestScript }, { getScreenshotAsBase64 }] = await Promise.all([
    importWorkspaceModule<{ Session: new (deviceId: string, deviceInfo: unknown) => ActiveDesignSession['session'] }>('src/core/session.js'),
    importWorkspaceModule<{ ExecutionEngine: new (session: unknown, options?: { recordScreenshots?: boolean }) => ActiveDesignSession['engine'] }>(
      'src/core/execution-engine.js'
    ),
    importWorkspaceModule<{
      buildDesignModePrompt: (
        deviceInfo: unknown,
        customInstructions?: {
          basePromptInstructions?: string;
          designModeInstructions?: string;
          executionModeInstructions?: string;
        }
      ) => string;
    }>('src/core/prompts.js'),
    importWorkspaceModule<{ sendCUARequest: ActiveDesignSession['sendCUARequest']; reviseTestScript: ActiveDesignSession['reviseTestScript'] }>(
      'src/device/openai.js'
    ),
    importWorkspaceModule<{ getScreenshotAsBase64: ActiveDesignSession['getScreenshotAsBase64'] }>('src/device/connection.js')
  ]);
  const promptCustomizations = await getPromptCustomizations();

  const sessionId = randomUUID();
  const session = new Session(connection.deviceId, {
    ...connection.deviceInfo
  });
  const prompt = buildDesignModePrompt(session.deviceInfo, promptCustomizations);
  session.setSystemPrompt(prompt);

  const engine = new ExecutionEngine(session, { recordScreenshots: false });

  activeDesign = {
    sessionId,
    phase: 'awaiting_initial_input',
    stopped: false,
    loopRunning: false,
    guidanceQueue: [],
    generatedScript: null,
    baseDesignPrompt: prompt,
    initialUserPrompt: null,
    consecutiveErrorCount: 0,
    onLog,
    session,
    engine,
    sendCUARequest,
    getScreenshotAsBase64,
    reviseTestScript
  };

  emit(onLog, 'system', '', { eventType: 'design_started', runId: sessionId, payload: { sessionId } });
  emit(onLog, 'info', '', {
    eventType: 'design_status',
    runId: sessionId,
    payload: { phase: activeDesign.phase, sessionId }
  });
  emit(onLog, 'info', '', {
    eventType: 'design_status',
    runId: sessionId,
    payload: { phase: activeDesign.phase, sessionId }
  });
  emit(onLog, 'system', '', {
    eventType: 'design_waiting_for_input',
    runId: sessionId,
    payload: { phase: activeDesign.phase, sessionId }
  });

  return { sessionId };
}

export async function submitDesignInput(sessionId: string, input: string): Promise<{ accepted: true }> {
  if (!activeDesign || activeDesign.sessionId !== sessionId) {
    throw new Error('No active design session matching this session ID.');
  }

  const value = input.trim();
  if (!value) {
    throw new Error('Input is required.');
  }

  if (activeDesign.phase === 'script_generated' || activeDesign.phase === 'saving') {
    throw new Error('Design input is disabled while reviewing/saving the generated script.');
  }

  if (value.toLowerCase() === 'cancel' || value.toLowerCase() === 'stop') {
    activeDesign.stopped = true;
    finishActiveDesign('stopped');
    return { accepted: true };
  }

  emit(activeDesign.onLog, 'user', value, {
    eventType: 'design_user_input',
    runId: activeDesign.sessionId,
    payload: { phase: activeDesign.phase, sessionId: activeDesign.sessionId }
  });

  if (activeDesign.phase === 'awaiting_initial_input') {
    activeDesign.initialUserPrompt = value;
    activeDesign.session.addToTranscript(`[Design] ${value}`);
    activeDesign.session.addMessage('user', value);
    activeDesign.phase = 'exploring';
    void runLoop();
    return { accepted: true };
  }

  activeDesign.guidanceQueue.push(value);
  if (activeDesign.phase === 'error') {
    activeDesign.consecutiveErrorCount = 0;
    activeDesign.phase = 'exploring';
    void runLoop();
  }
  return { accepted: true };
}

export async function reviseGeneratedScript(sessionId: string, revisionPrompt: string): Promise<{ script: string }> {
  if (!activeDesign || activeDesign.sessionId !== sessionId) {
    throw new Error('No active design session matching this session ID.');
  }
  if (!activeDesign.generatedScript) {
    throw new Error('No generated script available to revise.');
  }
  if (activeDesign.phase === 'saving') {
    throw new Error('Cannot revise while save is in progress.');
  }

  const prompt = revisionPrompt.trim();
  if (!prompt) {
    throw new Error('Revision prompt is required.');
  }

  const revised = await activeDesign.reviseTestScript(activeDesign.generatedScript, prompt);
  activeDesign.generatedScript = revised;
  activeDesign.phase = 'script_generated';
  emit(activeDesign.onLog, 'success', 'Script revised.', {
    eventType: 'design_generated_script',
    runId: activeDesign.sessionId,
    payload: { script: revised, revised: true, sessionId: activeDesign.sessionId }
  });

  return { script: revised };
}

export async function saveGeneratedScript(
  sessionId: string,
  payload: { folderId: string; requestedName: string }
): Promise<{ createdName: string; path: string; folderId: string }> {
  if (!activeDesign || activeDesign.sessionId !== sessionId) {
    throw new Error('No active design session matching this session ID.');
  }
  if (!activeDesign.generatedScript) {
    throw new Error('No generated script available to save.');
  }

  const folder = await getProjectFolderById(payload.folderId);
  if (!folder) {
    throw new Error('Project folder not found.');
  }
  if (!folder.exists) {
    throw new Error('Project folder is unavailable.');
  }

  activeDesign.phase = 'saving';
  emit(activeDesign.onLog, 'info', 'Saving generated test script...', {
    eventType: 'design_status',
    runId: activeDesign.sessionId,
    payload: { phase: activeDesign.phase, sessionId: activeDesign.sessionId }
  });

  const created = await createTest(folder.path, payload.requestedName);
  await saveTest(folder.path, created.createdName, activeDesign.generatedScript);

  emit(activeDesign.onLog, 'success', `Test saved as ${created.createdName}`, {
    eventType: 'design_saved',
    runId: activeDesign.sessionId,
    payload: {
      sessionId: activeDesign.sessionId,
      folderId: payload.folderId,
      createdName: created.createdName,
      path: created.path
    }
  });

  finishActiveDesign('saved');

  return { ...created, folderId: payload.folderId };
}

export async function stopDesign(sessionId: string): Promise<{ stopped: true }> {
  if (!activeDesign || activeDesign.sessionId !== sessionId) {
    throw new Error('No active design session matching this session ID.');
  }
  activeDesign.stopped = true;
  finishActiveDesign('stopped');
  return { stopped: true };
}

export function getDesignState(sessionId: string): { phase: DesignPhase; hasScript: boolean; script?: string } {
  if (!activeDesign || activeDesign.sessionId !== sessionId) {
    throw new Error('No active design session matching this session ID.');
  }
  return {
    phase: activeDesign.phase,
    hasScript: Boolean(activeDesign.generatedScript),
    script: activeDesign.generatedScript ?? undefined
  };
}

export function hasActiveDesignSession(): boolean {
  return Boolean(activeDesign);
}
