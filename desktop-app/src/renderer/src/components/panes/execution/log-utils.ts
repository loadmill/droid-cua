import type { LogEvent } from '../../../../../preload/types';

export interface AssertionData {
  assertion: string;
  details: string | null;
  passed: boolean;
}

export interface RunSummaryData {
  success: boolean;
  status: 'passed' | 'failed' | 'stopped';
  durationMs: number | null;
  instructionsTotal: number | null;
  instructionsCompleted: number | null;
  actionsTotal: number | null;
  assertionsPassed: number | null;
  assertionsFailed: number | null;
  retries: number | null;
  error: string | null;
}

export function cleanAssertionDetails(rawDetails: string | null, assertion: string, passed: boolean): string | null {
  if (!rawDetails) return null;

  let details = rawDetails
    .replace(/\[(Assertion|Assistant)\]\s*/gi, '')
    .replace(/\r/g, '')
    .trim();

  const lines = details
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/assertion result:/i.test(line));

  details = lines.join(' ').replace(/\s{2,}/g, ' ').trim();

  if (!passed && /assertion result:\s*pass/i.test(rawDetails)) {
    details = details.replace(/assertion result:\s*pass.*$/i, '').trim();
  }
  if (passed && /assertion result:\s*fail/i.test(rawDetails)) {
    details = details.replace(/assertion result:\s*fail.*$/i, '').trim();
  }

  if (details.toLowerCase() === assertion.trim().toLowerCase()) {
    return null;
  }
  return details.length > 0 ? details : null;
}

export function assertionData(line: LogEvent): AssertionData | null {
  if (line.eventType !== 'assertion_result') return null;
  const payload = line.payload ?? {};
  const assertion = typeof payload.assertion === 'string' && payload.assertion.trim().length > 0 ? payload.assertion : line.text;
  const passed = Boolean(payload.passed);
  const rawDetails = typeof payload.details === 'string' && payload.details.trim().length > 0 ? payload.details : null;
  const details = cleanAssertionDetails(rawDetails, assertion, passed);
  return { assertion, details, passed };
}

export function runSummaryData(line: LogEvent): RunSummaryData | null {
  if (line.eventType !== 'run_finished') return null;
  const payload = line.payload ?? {};
  const success = Boolean(payload.success);
  const error = typeof payload.error === 'string' && payload.error.trim().length > 0 ? payload.error : null;
  const stopped = !success && Boolean(error && error.toLowerCase().includes('stopped by user'));

  return {
    success,
    status: stopped ? 'stopped' : success ? 'passed' : 'failed',
    durationMs: typeof payload.durationMs === 'number' ? payload.durationMs : null,
    instructionsTotal: typeof payload.instructionsTotal === 'number' ? payload.instructionsTotal : null,
    instructionsCompleted: typeof payload.instructionsCompleted === 'number' ? payload.instructionsCompleted : null,
    actionsTotal: typeof payload.actionsTotal === 'number' ? payload.actionsTotal : null,
    assertionsPassed: typeof payload.assertionsPassed === 'number' ? payload.assertionsPassed : null,
    assertionsFailed: typeof payload.assertionsFailed === 'number' ? payload.assertionsFailed : null,
    retries: typeof payload.retries === 'number' ? payload.retries : null,
    error
  };
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return 'n/a';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function isLoadmillLine(line: LogEvent): boolean {
  return line.text.startsWith('[Loadmill]');
}

export function isLoadmillContinuationLine(line: LogEvent): boolean {
  return line.text.startsWith('  ') || line.text.startsWith('Command:') || line.text.startsWith('Error:') || line.text.startsWith('Skipping failed Loadmill');
}
