import { useEffect, useState } from 'react';
import type { LogEvent } from '../../../../preload/types';
import { BottomComposer } from './BottomComposer';
import { ExecutionInputRequestCard } from './execution/ExecutionInputRequestCard';
import { ExecutionLoadmillCard } from './execution/ExecutionLoadmillCard';
import { ExecutionLogItem } from './execution/ExecutionLogItem';
import { assertionData, isLoadmillContinuationLine, isLoadmillLine } from './execution/log-utils';

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

function isGroupStart(line: LogEvent, previous: LogEvent | undefined): boolean {
  if (!previous) return true;
  if (line.eventType === 'run_started' || line.eventType === 'run_finished') return true;
  if (line.eventType === 'instruction_started' || line.kind === 'user') return true;
  if (previous.eventType === 'assertion_result' && line.eventType !== 'assertion_result') return true;
  return false;
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
  const options = pendingExecutionInputRequest?.options.length ? pendingExecutionInputRequest.options : ['retry', 'skip', 'stop'];

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

  const renderItems = buildRenderItems(visibleLogs);

  useEffect(() => {
    if (!pendingExecutionInputRequest) return;
    setSelectedExecutionOptionIndex(0);
  }, [pendingExecutionInputRequest]);

  useEffect(() => {
    if (!pendingExecutionInputRequest) return;

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
  }, [onExecutionResponse, options, pendingExecutionInputRequest, selectedExecutionOptionIndex]);

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
                  <ExecutionLoadmillCard lines={item.lines} />
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
                <ExecutionLogItem line={line} />
              </div>
            );
          })}
          {pendingExecutionInputRequest ? (
            <ExecutionInputRequestCard
              options={options}
              selectedIndex={selectedExecutionOptionIndex}
              onSelect={onExecutionResponse}
              onHover={setSelectedExecutionOptionIndex}
            />
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
