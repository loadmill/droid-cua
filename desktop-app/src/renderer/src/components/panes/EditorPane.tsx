import { Play, Save } from 'lucide-react';
import type { ProjectTestFile } from '../../../../preload/types';
import { BottomComposer } from './BottomComposer';

interface EditorPaneProps {
  selectedTest: ProjectTestFile | undefined;
  draft: string;
  isDirty: boolean;
  composerInput: string;
  isApplyingRevision: boolean;
  canApplyRevision: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => Promise<void>;
  onDelete: () => Promise<void>;
  onRun: () => Promise<void>;
  onComposerInputChange: (value: string) => void;
  onApplyRevision: () => Promise<void>;
}

export function EditorPane({
  selectedTest,
  draft,
  isDirty,
  composerInput,
  isApplyingRevision,
  canApplyRevision,
  onDraftChange,
  onSave,
  onDelete,
  onRun,
  onComposerInputChange,
  onApplyRevision
}: EditorPaneProps) {
  return (
    <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]">
      <div className="flex min-h-0 flex-col overflow-hidden p-4">
        <div className="mb-2 text-[12px] text-slate-500">Test: {selectedTest?.filename}</div>
        <div className="mb-3 flex gap-2">
          <button type="button" disabled={!isDirty} onClick={() => void onSave()} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 disabled:opacity-50">
            <Save size={12} />
            Save
          </button>
          <button type="button" onClick={() => void onDelete()} className="rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-700">
            Delete
          </button>
          <button type="button" onClick={() => void onRun()} className="inline-flex items-center gap-1 rounded border border-indigo-700 bg-indigo-700 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            <Play size={12} />
            Run Test
          </button>
        </div>
        <textarea
          className="h-full min-h-0 w-full flex-1 resize-none rounded-md border border-slate-300 bg-white p-3 font-mono text-[13px] outline-none focus:border-indigo-300"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          spellCheck={false}
        />
      </div>

      <BottomComposer
        mode="editor"
        inputValue={composerInput}
        onInputChange={onComposerInputChange}
        isApplying={isApplyingRevision}
        canSubmit={canApplyRevision}
        isRunning={false}
        isStopping={false}
        onSubmit={onApplyRevision}
        onStop={async () => {}}
      />
    </section>
  );
}
