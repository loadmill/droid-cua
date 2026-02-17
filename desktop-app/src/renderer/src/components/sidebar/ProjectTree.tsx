import { useState } from 'react';
import type { MouseEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronDown, ChevronRight, Ellipsis, Folder, FolderOpen, FolderPlus, Pencil, SquarePen, X } from 'lucide-react';
import type { ProjectFolder, ProjectTestFile } from '../../../../preload/types';
import type { TestRef } from '../../app/types';
import { DialogForm } from '../dialogs/DialogForm';
import { TestRow } from './TestRow';

interface ProjectTreeProps {
  folders: ProjectFolder[];
  testsByFolder: Record<string, ProjectTestFile[]>;
  selectedTestRef: TestRef | null;
  runningTestRef: TestRef | null;
  activeRunId: string | null;
  onAddFolder: () => void;
  onOpenCreate: (folderId: string) => void;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onOpenFolder: (folderId: string) => Promise<void>;
  onRemoveFolder: (folderId: string) => Promise<void>;
  onSelectTest: (ref: TestRef, isRunning: boolean) => void;
  onRightClickTest: (event: MouseEvent<HTMLButtonElement>, ref: TestRef) => void;
}

interface FolderMenuState {
  folderId: string;
  x: number;
  y: number;
}

function sameRef(a: TestRef | null, b: TestRef): boolean {
  if (!a) return false;
  return a.folderId === b.folderId && a.testName.toLowerCase() === b.testName.toLowerCase();
}

export function ProjectTree({
  folders,
  testsByFolder,
  selectedTestRef,
  runningTestRef,
  activeRunId,
  onAddFolder,
  onOpenCreate,
  onRenameFolder,
  onOpenFolder,
  onRemoveFolder,
  onSelectTest,
  onRightClickTest
}: ProjectTreeProps) {
  const [folderMenu, setFolderMenu] = useState<FolderMenuState | null>(null);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [renameFolderError, setRenameFolderError] = useState<string | null>(null);

  const renameFolder = renameFolderId ? folders.find((folder) => folder.id === renameFolderId) ?? null : null;

  async function handleRenameFolder(): Promise<void> {
    if (!renameFolderId) return;
    setRenameFolderError(null);
    try {
      await onRenameFolder(renameFolderId, renameFolderValue);
      setRenameFolderId(null);
      setRenameFolderValue('');
    } catch (error) {
      setRenameFolderError(error instanceof Error ? error.message : 'Failed to rename folder.');
    }
  }

  function openFolderMenuAt(event: MouseEvent<HTMLButtonElement>, folderId: string): void {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 168;
    const menuHeight = 104;
    const x = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    const y = Math.min(Math.max(8, rect.bottom + 4), window.innerHeight - menuHeight - 8);
    setFolderMenu({ folderId, x, y });
  }

  function isCollapsed(folderId: string): boolean {
    return collapsedFolderIds.has(folderId);
  }

  function toggleFolder(folderId: string): void {
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  return (
    <>
      <div className="no-drag mt-1 border-t border-slate-300 pt-2">
        <div className="mb-1.5 flex items-center gap-2 px-1">
          <span className="font-medium">Projects</span>
          <button
            type="button"
            className="ml-auto p-1 text-slate-600 hover:text-slate-900"
            onClick={onAddFolder}
            title="Add project folder"
          >
            <FolderPlus size={15} strokeWidth={2.2} />
          </button>
        </div>

        {folders.length === 0 ? <div className="px-2 py-1 text-[12px] text-slate-500">No project folders configured.</div> : null}

        <div className="space-y-0.5">
          {folders.map((folder) => {
            const tests = testsByFolder[folder.id] ?? [];
            const collapsed = isCollapsed(folder.id);
            return (
              <div key={folder.id} className="space-y-[1px]">
                <div className="group flex items-center gap-2 rounded-md px-2 py-0.5 text-[12px] text-slate-800 hover:bg-white/35">
                  <div className="grid min-w-0 grid-cols-[14px_1fr] items-center gap-2">
                    <button
                      type="button"
                      className="flex h-[14px] w-[14px] items-center justify-start text-slate-600 hover:text-slate-900"
                      aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${folder.name}`}
                      onClick={() => toggleFolder(folder.id)}
                    >
                      <span className="group-hover:hidden">
                        {collapsed ? <Folder size={14} strokeWidth={2.2} /> : <FolderOpen size={14} strokeWidth={2.2} />}
                      </span>
                      <span className="hidden group-hover:block">
                        {collapsed ? <ChevronRight size={12} strokeWidth={2.4} /> : <ChevronDown size={12} strokeWidth={2.4} />}
                      </span>
                    </button>
                    <span className="truncate">{folder.name}</span>
                  </div>

                  {folder.warning ? <span className="ml-auto text-[11px] text-amber-700">{folder.warning}</span> : null}

                  {!folder.warning ? (
                    <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        className="p-1 text-slate-600 hover:text-slate-900"
                        aria-label={`Open ${folder.name} menu`}
                        onClick={(event) => openFolderMenuAt(event, folder.id)}
                      >
                        <Ellipsis size={14} strokeWidth={2.2} />
                      </button>
                      <button type="button" className="p-1 text-slate-600 hover:text-slate-900" onClick={() => onOpenCreate(folder.id)} title={`Create test in ${folder.name}`}>
                        <SquarePen size={14} strokeWidth={2.2} />
                      </button>
                    </div>
                  ) : null}
                </div>

                {!collapsed
                  ? tests.map((test) => {
                      const ref = { folderId: folder.id, testName: test.filename };
                      const isRunning = Boolean(activeRunId && sameRef(runningTestRef, ref));
                      return (
                        <TestRow
                          key={`${folder.id}:${test.filename}`}
                          name={test.name}
                          refId={ref}
                          isActive={sameRef(selectedTestRef, ref)}
                          isRunning={isRunning}
                          onSelect={onSelectTest}
                          onRightClick={onRightClickTest}
                        />
                      );
                    })
                  : null}

                {!folder.warning && tests.length === 0 && !collapsed ? <div className="px-2 py-0.5 text-[11px] text-slate-500">No .dcua files in this folder.</div> : null}
              </div>
            );
          })}
        </div>
      </div>

      {folderMenu ? (
        <div className="no-drag fixed inset-0 z-[85]" onMouseDown={() => setFolderMenu(null)} onContextMenu={(event) => event.preventDefault()}>
          <div
            className="no-drag fixed min-w-[168px] rounded-[10px] border border-[#b7b7b7] bg-[#f1f1f1] p-1 shadow-[0_4px_10px_rgba(0,0,0,0.10)]"
            style={{ left: folderMenu.x, top: folderMenu.y }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="block w-full rounded-[7px] px-2.5 py-1.5 text-left text-[12px] font-normal leading-[1.2] text-[#2c2c2c] hover:bg-[#e7e7e7]"
              onClick={() => {
                const folderId = folderMenu.folderId;
                setFolderMenu(null);
                void onOpenFolder(folderId);
              }}
            >
              <span className="inline-flex items-center gap-2">
                <FolderOpen size={13} strokeWidth={2.1} />
                <span>Open</span>
              </span>
            </button>
            <button
              type="button"
              className="block w-full rounded-[7px] px-2.5 py-1.5 text-left text-[12px] font-normal leading-[1.2] text-[#2c2c2c] hover:bg-[#e7e7e7]"
              onClick={() => {
                const folder = folders.find((item) => item.id === folderMenu.folderId);
                if (!folder) return;
                setRenameFolderId(folder.id);
                setRenameFolderValue(folder.name);
                setRenameFolderError(null);
                setFolderMenu(null);
              }}
            >
              <span className="inline-flex items-center gap-2">
                <Pencil size={13} strokeWidth={2.1} />
                <span>Edit name</span>
              </span>
            </button>
            <button
              type="button"
              className="block w-full rounded-[7px] px-2.5 py-1.5 text-left text-[12px] font-normal leading-[1.2] text-[#2c2c2c] hover:bg-[#e7e7e7]"
              onClick={() => {
                const folderId = folderMenu.folderId;
                setFolderMenu(null);
                void onRemoveFolder(folderId);
              }}
            >
              <span className="inline-flex items-center gap-2">
                <X size={13} strokeWidth={2.1} />
                <span>Remove</span>
              </span>
            </button>
          </div>
        </div>
      ) : null}

      <Dialog.Root
        open={Boolean(renameFolderId)}
        onOpenChange={(open) => {
          if (!open) {
            setRenameFolderId(null);
            setRenameFolderValue('');
            setRenameFolderError(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/28" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-slate-300 bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
            <DialogForm onSubmit={handleRenameFolder}>
              <Dialog.Title className="text-[20px] font-semibold leading-none">Rename folder</Dialog.Title>
              <Dialog.Description className="mt-2 text-[13px] text-slate-500">Set a display name for this project folder.</Dialog.Description>
              <input
                autoFocus
                value={renameFolderValue}
                onChange={(event) => setRenameFolderValue(event.target.value)}
                placeholder="Folder name"
                aria-label="Folder name"
                className="mt-4 h-11 w-full rounded-xl border border-slate-300 px-4 text-[14px] leading-none outline-none focus:border-indigo-300"
              />
              {renameFolderError ? <div className="mt-2 text-[13px] text-rose-700">{renameFolderError}</div> : null}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="h-9 rounded-xl border border-slate-300 px-4 text-[14px]"
                  onClick={() => {
                    setRenameFolderId(null);
                    setRenameFolderValue('');
                    setRenameFolderError(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="h-9 rounded-xl border border-black bg-black px-4 text-[14px] text-white" disabled={!renameFolder?.id}>
                  Save
                </button>
              </div>
            </DialogForm>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
