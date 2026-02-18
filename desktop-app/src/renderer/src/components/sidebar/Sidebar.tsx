import type { MouseEvent } from 'react';
import { MonitorSmartphone, Settings, SquarePen } from 'lucide-react';
import type { ConnectionState, ProjectFolder, ProjectTestFile } from '../../../../preload/types';
import type { Section, TestRef } from '../../app/types';
import { LoadmillMark } from '../brand/LoadmillMark';
import { ProjectTree } from './ProjectTree';

interface SidebarProps {
  section: Section;
  connection: ConnectionState;
  folders: ProjectFolder[];
  testsByFolder: Record<string, ProjectTestFile[]>;
  selectedTestRef: TestRef | null;
  activeRunId: string | null;
  runningTestRef: TestRef | null;
  onSectionChange: (section: Section) => void;
  onNewTest: () => void;
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
  onNewTest,
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
          className={`flex min-h-9 items-center gap-2 rounded-md border px-3 text-left ${section === 'new-test' && !selectedTestRef ? 'border-indigo-200 bg-white shadow-sm' : 'border-transparent hover:bg-white/70'}`}
          onClick={onNewTest}
        >
          <SquarePen size={14} />
          <span className="font-medium">Test design</span>
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
