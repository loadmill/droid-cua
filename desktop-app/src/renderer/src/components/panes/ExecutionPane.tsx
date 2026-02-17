import { useEffect, useState } from 'react';
import type { LogEvent } from '../../../../preload/types';
import { AlertTriangle, ArrowUpDown, Camera, CheckCircle2, Keyboard, MousePointer2, MoveDiagonal2, RotateCcw, Timer } from 'lucide-react';
import { logClass } from '../../app/ui-utils';
import { BottomComposer } from './BottomComposer';

interface ExecutionPaneProps {
  executionLogs: LogEvent[];
  pendingExecutionInputRequest: { options: string[] } | null;
  isRunning: boolean;
  isStopping: boolean;
  onStop: () => Promise<void>;
  onExecutionResponse: (input: string) => Promise<void>;
}

type RenderItem =
  | { kind: 'log'; line: LogEvent }
  | { kind: 'loadmill'; lines: LogEvent[] };

function LoadmillMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 1035 1035" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="h-4 w-4">
      <path
        d="M808.982 297.016 644.14 29.3c-1.484-2.012-5.587-8.153-11.234-8.488-7.747-.46-9.872 3.935-11.428
        7.151l-.029.06-111.354 457.775c-1.141 5.191.769 9.126 4.5 12.835 3.731 3.709 10.086 1.879
        12.796.5l275.123-180.566c2.845-1.478 8.763-5.472 9.675-9.625.912-4.153-1.758-9.681-3.207-11.926ZM221.403
        695.361l265.91-167.74c2.219-1.152 8.607-4.858 13.825-2.672 7.156 3 7.129 7.881 7.109 11.453v.067L406.583
        996.493c-1.262 5.167-4.71 7.857-9.694 9.537-4.983 1.69-9.882-2.75-11.708-5.18L217.718 717.557c-1.903-2.58-5.457-8.772-4.447-12.902
        1.01-4.131 5.843-7.917 8.132-9.294Z"
        fill="#52BAD3"
      />
      <path
        d="M282.079 171.043 8.876 355.76c-1.948 1.568-7.91 5.926-8.008 11.582-.133 7.758 4.346 9.697 7.625
        11.116l.062.027 452.431 99.593c5.234.922 9.086-1.152 12.634-5.036 3.549-3.884 1.453-10.156-.039-12.806L303.882
        176.598c-1.596-2.78-5.835-8.525-10.023-9.261-4.188-.737-9.598 2.163-11.78 3.706ZM769.31 811.501
        554.939 562.32c-1.503-1.998-6.214-7.686-4.919-13.193 1.775-7.554 6.594-8.334 10.12-8.904l.066-.011
        462.134 22.113c5.3.392 8.52 3.347 11.01 7.984 2.49 4.636-1.08 10.201-3.18 12.405L791.81 811.468c-2.23
        2.303-7.75 6.832-11.99 6.518-4.241-.314-8.774-4.454-10.51-6.485Z"
        fill="#5691E2"
      />
    </svg>
  );
}

export function ExecutionPane({
  executionLogs,
  pendingExecutionInputRequest,
  isRunning,
  isStopping,
  onStop,
  onExecutionResponse
}: ExecutionPaneProps) {
  const [selectedExecutionOptionIndex, setSelectedExecutionOptionIndex] = useState(0);
  const baseLogs = executionLogs.filter((line) => line.text.trim().length > 0);

  function cleanAssertionDetails(rawDetails: string | null, assertion: string, passed: boolean): string | null {
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

  function assertionData(line: LogEvent): { assertion: string; details: string | null; passed: boolean } | null {
    if (line.eventType !== 'assertion_result') return null;
    const payload = line.payload ?? {};
    const assertion = typeof payload.assertion === 'string' && payload.assertion.trim().length > 0 ? payload.assertion : line.text;
    const passed = Boolean(payload.passed);
    const rawDetails = typeof payload.details === 'string' && payload.details.trim().length > 0 ? payload.details : null;
    const details = cleanAssertionDetails(rawDetails, assertion, passed);
    return { assertion, details, passed };
  }

  function isDuplicateAssertionLine(line: LogEvent, previous: LogEvent | undefined): boolean {
    if (line.eventType !== 'assertion_result' || !previous || previous.eventType !== 'assertion_result') return false;
    const current = assertionData(line);
    const prev = assertionData(previous);
    if (!current || !prev) return false;
    return current.assertion === prev.assertion && current.passed === prev.passed;
  }

  function isAssistantAssertionSummary(line: LogEvent): boolean {
    if (!(line.eventType === 'assistant_message' || line.kind === 'assistant')) return false;
    const text = line.text.toLowerCase();
    return text.includes('assertion result: pass') || text.includes('assertion result: fail');
  }

  function runSummaryData(line: LogEvent): {
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
  } | null {
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

  function formatDuration(ms: number | null): string {
    if (ms === null) return 'n/a';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  function hasNearbyAssertionCard(logs: LogEvent[], index: number): boolean {
    const current = logs[index];
    const windowStart = Math.max(0, index - 3);
    const windowEnd = Math.min(logs.length - 1, index + 3);

    for (let i = windowStart; i <= windowEnd; i++) {
      if (i === index) continue;
      const candidate = logs[i];
      if (candidate.eventType !== 'assertion_result') continue;

      if (current.stepId && candidate.stepId) {
        if (current.stepId === candidate.stepId) return true;
        continue;
      }
      return true;
    }
    return false;
  }

  const visibleLogs = baseLogs.filter((line, idx, logs) => {
    if (isAssistantAssertionSummary(line) && hasNearbyAssertionCard(logs, idx)) {
      return false;
    }
    if (line.eventType === 'input_request') {
      return false;
    }
    if (line.eventType === 'run_finished' && pendingExecutionInputRequest) {
      return false;
    }
    return true;
  });

  function isLoadmillLine(line: LogEvent): boolean {
    return line.text.startsWith('[Loadmill]');
  }

  function isLoadmillContinuationLine(line: LogEvent): boolean {
    return (
      line.text.startsWith('  ') ||
      line.text.startsWith('Command:') ||
      line.text.startsWith('Error:') ||
      line.text.startsWith('Skipping failed Loadmill')
    );
  }

  function buildRenderItems(logs: LogEvent[]): RenderItem[] {
    const items: RenderItem[] = [];
    let idx = 0;

    while (idx < logs.length) {
      const current = logs[idx];
      if (!isLoadmillLine(current)) {
        items.push({ kind: 'log', line: current });
        idx++;
        continue;
      }

      const block: LogEvent[] = [current];
      idx++;

      while (idx < logs.length) {
        const next = logs[idx];
        if (isLoadmillLine(next) || isLoadmillContinuationLine(next)) {
          block.push(next);
          idx++;
          continue;
        }
        break;
      }

      items.push({ kind: 'loadmill', lines: block });
    }

    return items;
  }

  const renderItems = buildRenderItems(visibleLogs);

  useEffect(() => {
    if (!pendingExecutionInputRequest) return;
    setSelectedExecutionOptionIndex(0);
  }, [pendingExecutionInputRequest]);

  useEffect(() => {
    if (!pendingExecutionInputRequest) return;

    const options = pendingExecutionInputRequest.options.length > 0 ? pendingExecutionInputRequest.options : ['retry', 'skip', 'stop'];
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedExecutionOptionIndex((prev) => (prev + 1) % options.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedExecutionOptionIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        void onExecutionResponse(options[selectedExecutionOptionIndex] ?? options[0]);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onExecutionResponse, pendingExecutionInputRequest, selectedExecutionOptionIndex]);

  function isGroupStart(line: LogEvent, previous: LogEvent | undefined): boolean {
    if (!previous) return true;
    if (line.eventType === 'run_started' || line.eventType === 'run_finished') return true;
    if (line.eventType === 'instruction_started' || line.kind === 'user') return true;
    if (previous.eventType === 'assertion_result' && line.eventType !== 'assertion_result') return true;
    return false;
  }

  function renderLogLine(line: LogEvent): JSX.Element {
    const isInstruction = line.eventType === 'instruction_started' || line.kind === 'user';
    const isAssistant = line.eventType === 'assistant_message' || line.kind === 'assistant';
    const isAction = line.kind === 'action';
    const assertion = assertionData(line);
    const runSummary = runSummaryData(line);

    if (runSummary) {
      const isPass = runSummary.status === 'passed';
      const isStopped = runSummary.status === 'stopped';

      return (
        <div
          className={`mt-2 w-full rounded-xl border px-3.5 py-3 ${
            isPass
              ? 'border-emerald-200 bg-emerald-50/55 text-emerald-900'
              : isStopped
                ? 'border-amber-200 bg-amber-50/55 text-amber-900'
                : 'border-rose-200 bg-rose-50/55 text-rose-900'
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
              {isPass ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {isPass ? 'Test Passed' : isStopped ? 'Test Stopped' : 'Test Failed'}
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] ${
                isPass
                  ? 'border-emerald-300 bg-emerald-100/80 text-emerald-700'
                  : isStopped
                    ? 'border-amber-300 bg-amber-100/80 text-amber-700'
                    : 'border-rose-300 bg-rose-100/80 text-rose-700'
              }`}
            >
              {isPass ? 'PASS' : isStopped ? 'STOPPED' : 'FAIL'}
            </span>
          </div>

          <div className={`space-y-0.5 ${isPass ? 'text-emerald-800' : isStopped ? 'text-amber-800' : 'text-rose-800'}`}>
            <div>Duration: {formatDuration(runSummary.durationMs)}</div>
            <div>Steps: {runSummary.instructionsCompleted ?? 0}/{runSummary.instructionsTotal ?? 0}</div>
            <div>Assertions: {runSummary.assertionsPassed ?? 0}/{(runSummary.assertionsPassed ?? 0) + (runSummary.assertionsFailed ?? 0)}</div>
            <div>Retries: {runSummary.retries ?? 0}</div>
          </div>

          {runSummary.error ? (
            <div className={`mt-1.5 text-[13px] ${isPass ? 'text-emerald-700' : isStopped ? 'text-amber-700' : 'text-rose-700'}`}>
              {runSummary.error}
            </div>
          ) : null}
        </div>
      );
    }

    if (isInstruction) {
      return (
        <div className="flex justify-end">
          <div className="inline-block max-w-[70%] rounded-2xl rounded-br-md border border-slate-200 bg-slate-100 px-3.5 py-2 text-[14px] leading-5 text-slate-900">
            {line.text}
          </div>
        </div>
      );
    }

    if (isAssistant) {
      return (
        <div className="mt-1.5 max-w-[82%]">
          <div className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-slate-400">Assistant</div>
          <div className="text-[14px] leading-6 text-slate-700">{line.text}</div>
        </div>
      );
    }

    if (assertion) {
      const isPass = assertion.passed;
      return (
        <div
          className={`mt-2 w-full rounded-xl border px-3.5 py-3 ${
            isPass ? 'border-emerald-200 bg-emerald-50/55 text-emerald-900' : 'border-rose-200 bg-rose-50/55 text-rose-900'
          }`}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
              {isPass ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              {isPass ? 'Assertion Passed' : 'Assertion Failed'}
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] ${
                isPass ? 'border-emerald-300 bg-emerald-100/80 text-emerald-700' : 'border-rose-300 bg-rose-100/80 text-rose-700'
              }`}
            >
              {isPass ? 'PASS' : 'FAIL'}
            </span>
          </div>
          <div className="text-[14px] leading-5">{assertion.assertion}</div>
          {assertion.details ? <div className={`mt-1.5 text-[13px] ${isPass ? 'text-emerald-700' : 'text-rose-700'}`}>{assertion.details}</div> : null}
        </div>
      );
    }

    if (line.eventType === 'retry') {
      return (
        <div className="flex items-center gap-2 text-amber-700">
          <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
          <span>{line.text}</span>
        </div>
      );
    }

    if (isAction) {
      const lowerText = line.text.toLowerCase();
      const action = line.actionType;
      const iconClass = 'h-3.5 w-3.5 text-slate-400';

      let icon = <MousePointer2 className={iconClass} />;
      if (action === 'type' || action === 'keypress' || lowerText.includes('typing')) {
        icon = <Keyboard className={iconClass} />;
      } else if (action === 'scroll' || lowerText.includes('scroll')) {
        icon = <ArrowUpDown className={iconClass} />;
      } else if (action === 'drag' || lowerText.includes('drag')) {
        icon = <MoveDiagonal2 className={iconClass} />;
      } else if (action === 'screenshot' || lowerText.includes('capturing screen')) {
        icon = <Camera className={iconClass} />;
      } else if (action === 'wait' || lowerText.includes('waiting')) {
        icon = <Timer className={iconClass} />;
      }

      return (
        <div className={`flex items-center gap-2 ${logClass(line.kind)}`}>
          {icon}
          <span>{line.text}</span>
        </div>
      );
    }

    if (line.eventType === 'screenshot_captured') {
      return (
        <div className={`flex items-center gap-2 ${logClass(line.kind)}`}>
          <Camera className="h-3.5 w-3.5 text-slate-400" />
          <span>{line.text}</span>
        </div>
      );
    }

    return <div className={logClass(line.kind)}>{line.text}</div>;
  }

  function renderLoadmillCard(lines: LogEvent[]): JSX.Element {
    const texts = lines.map((line) => line.text);
    const normalized = texts.map((text) => text.replace(/^\[Loadmill\]\s*/, '').trim());
    const hasFailure = texts.some((text) => /\[Loadmill\]\s*FAILED|^Error:/i.test(text));
    const hasSuccess = texts.some((text) => /\bpassed\b/i.test(text)) && !hasFailure;
    const status = hasFailure ? 'failed' : hasSuccess ? 'passed' : 'running';
    const suiteRunIdFromPayload =
      lines
        .map((line) => line.payload?.loadmillSuiteRunId)
        .find((value): value is string => typeof value === 'string' && value.trim().length > 0) ?? null;
    const suiteRunIdFromText =
      texts
        .map((text) => {
          const startedMatch = text.match(/Test started \(ID:\s*([^)]+)\)/i);
          if (startedMatch?.[1]) return startedMatch[1].trim();
          const runIdMatch = text.match(/Run ID:\s*(.+)$/i);
          if (runIdMatch?.[1]) return runIdMatch[1].trim();
          return null;
        })
        .find((value): value is string => Boolean(value && value.length > 0)) ?? null;
    const suiteRunId = suiteRunIdFromPayload ?? suiteRunIdFromText;
    const suiteRunUrl = suiteRunId ? `https://app.loadmill.com/app/api-tests/test-suite-runs/${suiteRunId}` : null;

    const statusClass =
      status === 'failed'
        ? 'border-rose-300 bg-rose-100/80 text-rose-700'
        : status === 'passed'
          ? 'border-emerald-300 bg-emerald-100/80 text-emerald-700'
          : 'border-sky-300 bg-sky-100/80 text-sky-700';

    return (
      <div className="mt-1.5 w-full rounded-xl border border-sky-200 bg-sky-50/50 px-3.5 py-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-sky-800">
            <LoadmillMark />
            Loadmill Flow
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] ${statusClass}`}>
            {status}
          </span>
        </div>
        <div className="space-y-1.5 text-[14px] leading-5 text-slate-700">
          {normalized.map((text, idx) => {
            const startedMatch = text.match(/^Test started \(ID:\s*([^)]+)\)\.(.*)$/i);
            if (startedMatch && suiteRunUrl) {
              const trailing = startedMatch[2] ?? '';
              return (
                <div key={`${idx}-${text}`}>
                  <a
                    href={suiteRunUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-800"
                  >
                    Test started
                  </a>
                  {trailing}
                </div>
              );
            }
            return <div key={`${idx}-${text}`}>{text}</div>;
          })}
        </div>
      </div>
    );
  }

  return (
    <section className="grid min-h-0 flex-1 grid-rows-[1fr_auto]">
      <div className="min-h-0 overflow-auto px-6 py-5 lg:px-10">
        <div className="mx-auto max-w-[860px] text-[14px] leading-6 text-slate-700">
          {renderItems.length === 0 ? <div className="text-slate-500">Starting execution...</div> : null}
          {renderItems.map((item, idx) => {
            if (item.kind === 'loadmill') {
              const first = item.lines[0];
              const prevItem = idx > 0 ? renderItems[idx - 1] : null;
              const prev = prevItem && prevItem.kind === 'log' ? prevItem.line : undefined;
              return (
                <div
                  key={`${first.ts}-loadmill-${idx}`}
                  className={isGroupStart(first, prev) ? (idx === 0 ? '' : 'mt-3.5') : 'mt-1'}
                >
                  {renderLoadmillCard(item.lines)}
                </div>
              );
            }

            const line = item.line;
            const prevItem = idx > 0 ? renderItems[idx - 1] : null;
            const prev = prevItem && prevItem.kind === 'log' ? prevItem.line : undefined;

            if (isDuplicateAssertionLine(line, prev)) return null;
            return (
              <div
                key={`${line.ts}-${idx}`}
                className={isGroupStart(line, prev) ? (idx === 0 ? '' : 'mt-3.5') : 'mt-1'}
              >
                {renderLogLine(line)}
              </div>
            );
          })}
          {pendingExecutionInputRequest ? (
            <div className="mt-2.5 w-full overflow-hidden rounded-xl border border-slate-300 bg-white">
              {(pendingExecutionInputRequest.options.length > 0 ? pendingExecutionInputRequest.options : ['retry', 'skip', 'stop']).map((option, idx) => {
                const selected = idx === selectedExecutionOptionIndex;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => void onExecutionResponse(option)}
                    onMouseEnter={() => setSelectedExecutionOptionIndex(idx)}
                    className={`flex w-full items-center justify-between border-t border-slate-200 px-3 py-2 text-left text-[13px] first:border-t-0 ${
                      selected ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="capitalize">{option}</span>
                    {selected ? <span className="text-[11px] text-slate-500">↵</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <BottomComposer
        mode="execution"
        inputValue=""
        onInputChange={() => {}}
        isApplying={false}
        canSubmit={false}
        isRunning={isRunning}
        isStopping={isStopping}
        onSubmit={async () => {}}
        onStop={onStop}
      />
    </section>
  );
}
