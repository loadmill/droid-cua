import type { LogEvent, ProjectFolder } from '../../../../preload/types';
import type { DesignPhase } from '../../app/types';
import { useAutoFollowScroll } from '../../app/useAutoFollowScroll';
import { BottomComposer } from './BottomComposer';
import { ExecutionLogItem } from './execution/ExecutionLogItem';

interface DesignPaneProps {
  designLogs: LogEvent[];
  designPhase: DesignPhase;
  isDesignRunning: boolean;
  generatedScript: string | null;
  designError: string | null;
  designInput: string;
  pendingRevisionPrompt: string;
  projectFolders: ProjectFolder[];
  showSaveForm: boolean;
  designSaveTargetFolderId: string | null;
  designRequestedName: string;
  onDesignInputChange: (value: string) => void;
  onPendingRevisionPromptChange: (value: string) => void;
  onDesignSubmit: () => Promise<void>;
  onDesignStop: () => Promise<void>;
  onDesignRevise: () => Promise<void>;
  onDesignDiscard: () => void;
  onOpenSaveForm: () => void;
  onCloseSaveForm: () => void;
  onSaveTargetFolderChange: (folderId: string) => void;
  onDesignRequestedNameChange: (value: string) => void;
  onDesignSave: () => Promise<void>;
}

function isGroupStart(line: LogEvent, previous: LogEvent | undefined): boolean {
  if (!previous) return true;
  if (line.eventType === 'design_started' || line.eventType === 'design_finished') return true;
  if (line.kind === 'user') return true;
  if (previous.kind === 'user') return true;
  return false;
}

export function DesignPane({
  designLogs,
  designPhase,
  isDesignRunning,
  generatedScript,
  designError,
  designInput,
  pendingRevisionPrompt,
  projectFolders,
  showSaveForm,
  designSaveTargetFolderId,
  designRequestedName,
  onDesignInputChange,
  onPendingRevisionPromptChange,
  onDesignSubmit,
  onDesignStop,
  onDesignRevise,
  onDesignDiscard,
  onOpenSaveForm,
  onCloseSaveForm,
  onSaveTargetFolderChange,
  onDesignRequestedNameChange,
  onDesignSave
}: DesignPaneProps) {
  const placeholder =
    designPhase === 'awaiting_initial_input'
      ? 'Describe what you want to test...'
      : designPhase === 'script_generated'
        ? 'Describe script changes to revise...'
      : 'Guide or correct the agent...';
  const visibleLogs = designLogs.filter((line) => line.text.trim().length > 0);
  const isNewSessionState = visibleLogs.length === 0 && !generatedScript && designPhase !== 'script_generated';
  const { scrollRef, handleScroll } = useAutoFollowScroll(
    `${visibleLogs.length}:${generatedScript ? 'script' : 'no-script'}:${showSaveForm ? 'save-form' : 'no-save-form'}`
  );

  return (
    <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`min-h-0 overflow-auto px-6 lg:px-10 ${isNewSessionState ? 'py-8' : 'py-5'}`}
      >
        <div
          className={`mx-auto max-w-[860px] space-y-3 text-[14px] leading-6 text-slate-700 ${
            isNewSessionState ? 'flex min-h-full flex-col justify-center pb-10' : ''
          }`}
        >
          <div className={`rounded-xl border border-slate-200 bg-white p-4 ${isNewSessionState ? 'mx-auto w-full max-w-[780px]' : ''}`}>
            <div className="text-[18px] font-semibold text-slate-900">Design Mode: New Test</div>
            <div className="mt-2 text-[14px] text-slate-600">Describe what you want to test. The agent will explore autonomously.</div>
            <div className="mt-4 text-[15px] font-medium text-slate-800">What do you want to test?</div>
          </div>

          {designError && visibleLogs.length === 0 ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{designError}</div>
          ) : null}

          {visibleLogs.map((line, idx) => {
            const prev = idx > 0 ? visibleLogs[idx - 1] : undefined;
            return (
            <div key={`${line.ts}-${idx}`} className={isGroupStart(line, prev) ? (idx === 0 ? '' : 'mt-3.5') : 'mt-1'}>
              <ExecutionLogItem line={line} />
            </div>
            );
          })}

          {generatedScript ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="mb-2 text-[13px] font-semibold text-emerald-900">Generated Test Script</div>
              <textarea
                value={generatedScript}
                readOnly
                className="h-48 w-full resize-none rounded border border-emerald-200 bg-white p-3 font-mono text-[12px] leading-5 text-slate-800"
              />
              <div className="mt-3 w-full overflow-hidden rounded-xl border border-emerald-200 bg-white">
                <button
                  type="button"
                  onClick={onOpenSaveForm}
                  className="flex w-full items-center justify-between border-t border-emerald-100 px-3 py-2 text-left text-[13px] text-emerald-800 first:border-t-0 hover:bg-emerald-50/55"
                >
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={() => void onDesignRevise()}
                  className="flex w-full items-center justify-between border-t border-emerald-100 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50"
                >
                  <span>Revise</span>
                </button>
                <button
                  type="button"
                  onClick={onDesignDiscard}
                  className="flex w-full items-center justify-between border-t border-emerald-100 px-3 py-2 text-left text-[13px] text-rose-700 hover:bg-rose-50/45"
                >
                  <span>Discard</span>
                </button>
              </div>

              {showSaveForm ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="grid gap-2">
                    <select
                      value={designSaveTargetFolderId ?? ''}
                      onChange={(event) => onSaveTargetFolderChange(event.target.value)}
                      className="h-9 rounded border border-slate-300 px-2 text-[13px]"
                    >
                      <option value="" disabled>
                        Select project folder...
                      </option>
                      {projectFolders
                        .filter((folder) => folder.exists)
                        .map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                    </select>
                    <input
                      value={designRequestedName}
                      onChange={(event) => onDesignRequestedNameChange(event.target.value)}
                      placeholder="test-name"
                      className="h-9 rounded border border-slate-300 px-2 text-[13px]"
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-[12px]" onClick={onCloseSaveForm}>
                      Cancel
                    </button>
                    <button type="button" className="rounded border border-indigo-700 bg-indigo-700 px-3 py-1.5 text-[12px] text-white" onClick={() => void onDesignSave()}>
                      Save Test
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className={isNewSessionState ? 'px-1 pb-4' : ''}>
        <BottomComposer
          mode="design"
          inputValue={designPhase === 'script_generated' ? pendingRevisionPrompt : designInput}
          onInputChange={designPhase === 'script_generated' ? onPendingRevisionPromptChange : onDesignInputChange}
          placeholder={placeholder}
          isApplying={false}
          canSubmit={Boolean((designPhase === 'script_generated' ? pendingRevisionPrompt : designInput).trim())}
          isRunning={isDesignRunning}
          isStopping={false}
          onSubmit={designPhase === 'script_generated' ? onDesignRevise : onDesignSubmit}
          onStop={onDesignStop}
        />
      </div>
    </section>
  );
}
