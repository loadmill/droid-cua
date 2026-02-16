import type { ReactNode } from 'react';

interface AppShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, header, children }: AppShellProps) {
  return (
    <div className="h-screen text-[13px] text-slate-900">
      <div className="app-shell grid h-full grid-cols-[300px_1px_minmax(0,1fr)] overflow-hidden border border-line bg-shell">
        {sidebar}
        <div className="w-px cursor-col-resize bg-slate-300" />
        <main className="main-pane flex min-h-0 flex-col bg-main">
          {header}
          {children}
        </main>
      </div>
    </div>
  );
}
