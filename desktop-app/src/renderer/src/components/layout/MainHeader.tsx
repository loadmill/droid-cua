import { Loader2, StopCircle } from 'lucide-react';
import type { ConnectionState, ProjectTestFile, WorkspaceInfo } from '../../../../preload/types';
import type { Pane } from '../../app/types';
import { modeLabel } from '../../app/ui-utils';

interface MainHeaderProps {
  pane: Pane;
  workspace: WorkspaceInfo | null;
  selectedTest: ProjectTestFile | undefined;
  connection: ConnectionState;
  activeRunId: string | null;
  isStopping: boolean;
  onStop: () => void;
  onOpenCommandMenu: () => void;
}

export function MainHeader({
  pane,
  workspace,
  selectedTest,
  connection,
  activeRunId,
  isStopping,
  onStop,
  onOpenCommandMenu
}: MainHeaderProps) {
  return (
    <header className="drag-region flex items-start justify-between border-b border-line px-4 py-3">
      <div className="no-drag min-w-0">
        <div className="truncate text-[15px] font-semibold">
          {pane === 'devices'
            ? 'Device Setup'
            : pane === 'execution'
              ? `Execution: ${selectedTest?.name ?? 'test'}`
              : pane === 'editor'
                ? `Test Code: ${selectedTest?.name ?? ''}`
                : pane === 'settings'
                  ? 'Settings'
                  : 'Design Mode'}
        </div>
        <div className="truncate text-[12px] text-slate-500">{workspace?.workspaceName ?? 'Loading workspace...'}</div>
      </div>

      <div className="no-drag flex items-center gap-2">
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] text-indigo-900">{modeLabel(pane)}</span>
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] text-indigo-900">
          {connection.connected ? `${connection.deviceName} ${connection.resolution ? `· ${connection.resolution}` : ''}` : 'No device connected'}
        </span>
        {activeRunId ? (
          <button
            type="button"
            onClick={onStop}
            disabled={isStopping}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] disabled:opacity-60"
          >
            {isStopping ? <Loader2 size={12} className="animate-spin" /> : <StopCircle size={12} />}
            {isStopping ? 'Stopping...' : 'Stop'}
          </button>
        ) : null}
        <button type="button" onClick={onOpenCommandMenu} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px]">
          Command Menu
        </button>
      </div>
    </header>
  );
}
