interface SettingsPaneProps {
  workspacePath: string | undefined;
}

export function SettingsPane({ workspacePath }: SettingsPaneProps) {
  return (
    <section className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-xl border border-slate-300 bg-white p-6">
        <div className="text-[16px] font-semibold">Settings</div>
        <div className="mt-2 text-[13px] text-slate-600">Desktop config is stored locally in app user data. OPENAI_API_KEY is read from workspace <code>.env</code>.</div>
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-600">Workspace: {workspacePath ?? 'loading...'}</div>
      </div>
    </section>
  );
}
