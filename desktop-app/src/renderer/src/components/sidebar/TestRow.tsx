import type { MouseEvent } from 'react';
import type { TestRef } from '../../app/types';

interface TestRowProps {
  name: string;
  refId: TestRef;
  isActive: boolean;
  isRunning: boolean;
  onSelect: (ref: TestRef, isRunning: boolean) => void;
  onRightClick: (event: MouseEvent<HTMLButtonElement>, ref: TestRef) => void;
}

export function TestRow({ name, refId, isActive, isRunning, onSelect, onRightClick }: TestRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(refId, isRunning)}
      onMouseDown={(event) => {
        if (event.button !== 2) return;
        event.preventDefault();
        onRightClick(event, refId);
      }}
      onContextMenu={(event) => event.preventDefault()}
      className={`block w-full rounded-md px-2 py-1.5 text-left text-[12px] ${isActive ? 'border border-indigo-200/55 bg-white/55 text-slate-900' : 'border border-transparent text-slate-700 hover:bg-white/55'}`}
    >
      <span className="grid grid-cols-[14px_1fr] items-center gap-2">
        <span className="flex h-[14px] w-[14px] items-center justify-start">
          {isRunning ? <span className="block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" /> : null}
        </span>
        <span>{name}</span>
      </span>
    </button>
  );
}
