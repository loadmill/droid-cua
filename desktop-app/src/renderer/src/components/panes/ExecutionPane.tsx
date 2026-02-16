import type { LogEvent } from '../../../../preload/types';
import { formatTime, logClass } from '../../app/ui-utils';
import { BottomComposer } from './BottomComposer';

interface ExecutionPaneProps {
  executionLogs: LogEvent[];
  isRunning: boolean;
  isStopping: boolean;
  onStop: () => Promise<void>;
}

export function ExecutionPane({ executionLogs, isRunning, isStopping, onStop }: ExecutionPaneProps) {
  return (
    <section className="grid min-h-0 flex-1 grid-rows-[1fr_auto]">
      <div className="min-h-0 overflow-auto p-4">
        <div className="space-y-1 font-mono text-[12px]">
          {executionLogs.length === 0 ? <div className="text-slate-500">Starting execution...</div> : null}
          {executionLogs.map((line, idx) => (
            <div key={`${line.ts}-${idx}`} className={logClass(line.kind)}>
              [{formatTime(line.ts)}] {line.text}
            </div>
          ))}
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
