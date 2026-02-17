import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface AppShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}

export function AppShell({ sidebar, header, children }: AppShellProps) {
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isResizing) return;

    function onMouseMove(event: MouseEvent): void {
      const shell = shellRef.current;
      if (!shell) return;

      const bounds = shell.getBoundingClientRect();
      const nextWidth = event.clientX - bounds.left;
      const minWidth = 240;
      const maxWidth = 520;
      setSidebarWidth(Math.max(minWidth, Math.min(maxWidth, nextWidth)));
    }

    function onMouseUp(): void {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  return (
    <div className="h-screen text-[13px] text-slate-900">
      <div
        ref={shellRef}
        className="app-shell grid h-full overflow-hidden border border-line bg-shell"
        style={{ gridTemplateColumns: `${sidebarWidth}px 1px minmax(0, 1fr)` }}
      >
        {sidebar}
        <div
          className="no-drag w-px cursor-col-resize bg-slate-300 hover:bg-slate-400"
          onMouseDown={(event) => {
            event.preventDefault();
            setIsResizing(true);
          }}
        />
        <main className="main-pane flex min-h-0 flex-col bg-main">
          {header}
          {children}
        </main>
      </div>
    </div>
  );
}
