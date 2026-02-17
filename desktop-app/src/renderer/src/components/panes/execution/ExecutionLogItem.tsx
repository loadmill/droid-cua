import type { LogEvent } from '../../../../../preload/types';
import { AlertTriangle, ArrowUpDown, Camera, CheckCircle2, Keyboard, MousePointer2, MoveDiagonal2, RotateCcw, Timer } from 'lucide-react';
import { logClass } from '../../../app/ui-utils';
import { assertionData, formatDuration, runSummaryData } from './log-utils';

interface ExecutionLogItemProps {
  line: LogEvent;
}

export function ExecutionLogItem({ line }: ExecutionLogItemProps): JSX.Element {
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
          isPass ? 'border-emerald-200 bg-emerald-50/55 text-emerald-900' : isStopped ? 'border-amber-200 bg-amber-50/55 text-amber-900' : 'border-rose-200 bg-rose-50/55 text-rose-900'
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
