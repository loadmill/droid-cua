import { ArrowUp } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface BottomComposerProps {
  mode: 'design' | 'editor' | 'execution';
  inputValue: string;
  onInputChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  isApplying: boolean;
  canSubmit: boolean;
  isRunning: boolean;
  isStopping: boolean;
  onSubmit: () => Promise<void>;
  onStop: () => Promise<void>;
}

export function BottomComposer({
  mode,
  inputValue,
  onInputChange,
  placeholder,
  readOnly,
  isApplying,
  canSubmit,
  isRunning,
  isStopping,
  onSubmit,
  onStop
}: BottomComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isEditableComposer = mode === 'editor' || mode === 'design';

  useEffect(() => {
    if (!isEditableComposer || !textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = '0px';
    const nextHeight = Math.max(52, Math.min(el.scrollHeight, Math.floor(window.innerHeight * 0.3)));
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > nextHeight ? 'auto' : 'hidden';
  }, [inputValue, isEditableComposer]);

  return (
    <div className="bg-gradient-to-b from-transparent to-slate-100 px-5 pb-5 pt-2 lg:px-8 lg:pb-6">
      <div className="min-h-[64px] rounded-2xl border border-indigo-200 bg-white px-3 py-2 shadow-[0_3px_8px_rgba(0,0,0,0.08)]">
        <div className="flex items-end gap-2">
          {mode === 'editor' || mode === 'design' ? (
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void onSubmit();
                }
              }}
              placeholder={placeholder ?? (mode === 'editor' ? 'Describe changes to apply to this test...' : 'Describe what you want to test...')}
              className="max-h-[30vh] min-h-[52px] flex-1 resize-none bg-transparent px-1 py-1 text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
              disabled={isApplying || readOnly}
              readOnly={readOnly}
            />
          ) : (
            <textarea
              value={isRunning ? 'Test is running...' : 'Run a test from editor to stream logs here.'}
              readOnly
              className="h-12 min-h-[48px] flex-1 resize-none bg-transparent px-1 py-1 text-[13px] text-slate-500 outline-none"
            />
          )}

          <button
            type="button"
            onClick={() => {
              if (mode === 'editor' || mode === 'design') {
                void onSubmit();
              } else {
                void onStop();
              }
            }}
            disabled={mode === 'editor' || mode === 'design' ? !canSubmit : !isRunning || isStopping}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#3f5edb] text-white shadow-[0_2px_6px_rgba(63,94,219,0.35)] disabled:cursor-default disabled:opacity-45"
            aria-label={mode === 'editor' ? 'Apply changes' : mode === 'design' ? 'Send design input' : 'Stop test'}
          >
            {mode === 'editor' || mode === 'design' ? (
              <ArrowUp size={16} />
            ) : isStopping ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/45 border-t-white" />
            ) : (
              <span className="h-3 w-3 rounded-[2px] bg-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
