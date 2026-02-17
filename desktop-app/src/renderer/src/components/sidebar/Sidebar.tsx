import type { MouseEvent } from 'react';
import { MonitorSmartphone, Plus, Settings } from 'lucide-react';
import type { ConnectionState, ProjectFolder, ProjectTestFile } from '../../../../preload/types';
import type { Section, TestRef } from '../../app/types';
import { ProjectTree } from './ProjectTree';

function LoadmillMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 1035 1035" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="h-4 w-4">
      <path
        d="M808.982 297.016 644.14 29.3c-1.484-2.012-5.587-8.153-11.234-8.488-7.747-.46-9.872 3.935-11.428
        7.151l-.029.06-111.354 457.775c-1.141 5.191.769 9.126 4.5 12.835 3.731 3.709 10.086 1.879
        12.796.5l275.123-180.566c2.845-1.478 8.763-5.472 9.675-9.625.912-4.153-1.758-9.681-3.207-11.926ZM221.403
        695.361l265.91-167.74c2.219-1.152 8.607-4.858 13.825-2.672 7.156 3 7.129 7.881 7.109 11.453v.067L406.583
        996.493c-1.262 5.167-4.71 7.857-9.694 9.537-4.983 1.69-9.882-2.75-11.708-5.18L217.718 717.557c-1.903-2.58-5.457-8.772-4.447-12.902
        1.01-4.131 5.843-7.917 8.132-9.294Z"
        fill="#52BAD3"
      />
      <path
        d="M282.079 171.043 8.876 355.76c-1.948 1.568-7.91 5.926-8.008 11.582-.133 7.758 4.346 9.697 7.625
        11.116l.062.027 452.431 99.593c5.234.922 9.086-1.152 12.634-5.036 3.549-3.884 1.453-10.156-.039-12.806L303.882
        176.598c-1.596-2.78-5.835-8.525-10.023-9.261-4.188-.737-9.598 2.163-11.78 3.706ZM769.31 811.501
        554.939 562.32c-1.503-1.998-6.214-7.686-4.919-13.193 1.775-7.554 6.594-8.334 10.12-8.904l.066-.011
        462.134 22.113c5.3.392 8.52 3.347 11.01 7.984 2.49 4.636-1.08 10.201-3.18 12.405L791.81 811.468c-2.23
        2.303-7.75 6.832-11.99 6.518-4.241-.314-8.774-4.454-10.51-6.485Z"
        fill="#5691E2"
      />
    </svg>
  );
}

interface SidebarProps {
  section: Section;
  connection: ConnectionState;
  folders: ProjectFolder[];
  testsByFolder: Record<string, ProjectTestFile[]>;
  selectedTestRef: TestRef | null;
  activeRunId: string | null;
  runningTestRef: TestRef | null;
  onSectionChange: (section: Section) => void;
  onAddFolder: () => void;
  onOpenCreateDialog: (folderId: string) => void;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onOpenFolder: (folderId: string) => Promise<void>;
  onRemoveFolder: (folderId: string) => Promise<void>;
  onSelectTest: (ref: TestRef, isRunning: boolean) => void;
  onRightClickTest: (event: MouseEvent<HTMLButtonElement>, ref: TestRef) => void;
}

export function Sidebar({
  section,
  connection,
  folders,
  testsByFolder,
  selectedTestRef,
  activeRunId,
  runningTestRef,
  onSectionChange,
  onAddFolder,
  onOpenCreateDialog,
  onRenameFolder,
  onOpenFolder,
  onRemoveFolder,
  onSelectTest,
  onRightClickTest
}: SidebarProps) {
  return (
    <aside className="rail drag-region flex flex-col gap-3 bg-rail px-3 pb-3 pt-10">
      <div className="no-drag flex items-center gap-2 px-0.5 text-[12px] font-medium text-slate-600">
        <LoadmillMark />
        <span>Loadmill Droid-cua</span>
      </div>

      <nav className="no-drag flex flex-col gap-1">
        <button
          type="button"
          disabled
          className="flex min-h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-3 text-left text-slate-400"
          title="Coming soon"
        >
          <Plus size={14} />
          <span className="font-medium">New Test</span>
          <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-[10px]">Coming soon</span>
        </button>

        <button
          type="button"
          className={`flex min-h-9 items-center gap-2 rounded-md border px-3 text-left ${section === 'devices' ? 'border-indigo-200 bg-white shadow-sm' : 'border-transparent hover:bg-white/70'}`}
          onClick={() => onSectionChange('devices')}
        >
          <MonitorSmartphone size={14} />
          <span className="font-medium">Devices</span>
          <span className="ml-auto text-[11px] text-slate-500">{connection.connected ? 'connected' : 'offline'}</span>
        </button>
      </nav>

      <ProjectTree
        folders={folders}
        testsByFolder={testsByFolder}
        selectedTestRef={selectedTestRef}
        activeRunId={activeRunId}
        runningTestRef={runningTestRef}
        onAddFolder={onAddFolder}
        onOpenCreate={onOpenCreateDialog}
        onRenameFolder={onRenameFolder}
        onOpenFolder={onOpenFolder}
        onRemoveFolder={onRemoveFolder}
        onSelectTest={onSelectTest}
        onRightClickTest={onRightClickTest}
      />

      <button
        type="button"
        className={`no-drag mt-auto flex min-h-9 items-center gap-2 rounded-md border px-3 text-left ${section === 'settings' ? 'border-indigo-200 bg-white shadow-sm' : 'border-transparent hover:bg-white/70'}`}
        onClick={() => onSectionChange('settings')}
      >
        <Settings size={14} />
        <span className="font-medium">Settings</span>
      </button>
    </aside>
  );
}
