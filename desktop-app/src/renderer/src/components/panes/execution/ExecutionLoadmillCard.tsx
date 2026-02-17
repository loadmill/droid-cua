import type { LogEvent } from '../../../../../preload/types';
import { LoadmillMark } from '../../brand/LoadmillMark';

interface ExecutionLoadmillCardProps {
  lines: LogEvent[];
}

export function ExecutionLoadmillCard({ lines }: ExecutionLoadmillCardProps) {
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
