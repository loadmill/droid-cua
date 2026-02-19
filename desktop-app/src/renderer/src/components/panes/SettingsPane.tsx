import type { PromptCustomizations } from '../../app/types';

interface SettingsPaneProps {
  workspacePath: string | undefined;
  promptCustomizations: PromptCustomizations;
  promptCustomizationsError: string | null;
  onPromptCustomizationsChange: (next: PromptCustomizations) => void;
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
}

function PromptEditorCard({
  title,
  description,
  value,
  onChange
}: {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="py-1">
      <div className="text-[16px] font-semibold">{title}</div>
      <div className="mt-1 text-[13px] text-slate-600">{description}</div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Add your custom instructions..."
        className="mt-3 h-36 w-full resize-y rounded-md border border-slate-300 p-3 font-mono text-[13px] outline-none focus:border-indigo-300"
      />
    </div>
  );
}

export function SettingsPane({
  workspacePath,
  promptCustomizations,
  promptCustomizationsError,
  onPromptCustomizationsChange,
  debugMode,
  onDebugModeChange
}: SettingsPaneProps) {
  return (
    <section className="flex flex-1 items-start justify-center overflow-auto p-8">
      <div className="w-full max-w-4xl space-y-4">
        <div className="mt-2 text-[13px] text-slate-600">Desktop config is stored locally in app user data. OPENAI_API_KEY is read from workspace <code>.env</code>.</div>
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-600">Workspace: {workspacePath ?? 'loading...'}</div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <label className="flex items-start justify-between gap-6">
            <div>
              <div className="text-[15px] font-semibold text-slate-900">Debug mode</div>
              <div className="mt-1 text-[13px] text-slate-600">
                Write structured diagnostic logs for CUA, device operations, retries, and reconnection flows.
              </div>
            </div>
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(event) => onDebugModeChange(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>
        </div>

        <PromptEditorCard
          title="Base Prompt Custom Instructions"
          description="Used in every AI-driven flow in the desktop app. Add global rules that should always apply, such as interaction style, safety constraints, app-specific conventions, or how strictly the agent should verify outcomes."
          value={promptCustomizations.basePromptInstructions}
          onChange={(value) => onPromptCustomizationsChange({ ...promptCustomizations, basePromptInstructions: value })}
        />

        <PromptEditorCard
          title="Design Mode Custom Instructions"
          description="Used only while creating tests in Design Mode. Add guidance for exploration behavior, how the agent should handle unclear UI states, and how generated test steps/assertions should be written for your team."
          value={promptCustomizations.designModeInstructions}
          onChange={(value) => onPromptCustomizationsChange({ ...promptCustomizations, designModeInstructions: value })}
        />

        <PromptEditorCard
          title="Execution Mode Custom Instructions"
          description="Used only when running existing test scripts. Add rules for step execution discipline, retry preferences, assertion strictness, and how the agent should behave when a step fails or cannot be completed."
          value={promptCustomizations.executionModeInstructions}
          onChange={(value) => onPromptCustomizationsChange({ ...promptCustomizations, executionModeInstructions: value })}
        />

        {promptCustomizationsError ? <div className="text-[13px] text-rose-700">{promptCustomizationsError}</div> : null}
      </div>
    </section>
  );
}
