import * as Dialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';

interface CommandMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenDevices: () => void;
  onOpenProjects: () => void;
  onOpenSettings: () => void;
  onRefreshTests: () => Promise<void>;
  onRefreshDevices: () => Promise<void>;
}

export function CommandMenuDialog({
  open,
  onOpenChange,
  onOpenDevices,
  onOpenProjects,
  onOpenSettings,
  onRefreshTests,
  onRefreshDevices
}: CommandMenuDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-[30%] w-[540px] -translate-x-1/2 rounded-lg border border-slate-300 bg-white shadow-xl">
          <Command className="p-2">
            <Command.Input className="w-full rounded-md border border-slate-300 px-3 py-2 text-[13px] outline-none" placeholder="Type a command..." />
            <Command.List className="mt-2 max-h-72 overflow-auto p-1 text-[13px]">
              <Command.Empty className="px-2 py-3 text-slate-500">No results.</Command.Empty>
              <Command.Group heading="Navigation" className="text-slate-500">
                <Command.Item className="cursor-pointer rounded px-2 py-2 data-[selected=true]:bg-slate-100" onSelect={onOpenDevices}>
                  Open Devices
                </Command.Item>
                <Command.Item className="cursor-pointer rounded px-2 py-2 data-[selected=true]:bg-slate-100" onSelect={onOpenProjects}>
                  Open Projects
                </Command.Item>
                <Command.Item className="cursor-pointer rounded px-2 py-2 data-[selected=true]:bg-slate-100" onSelect={onOpenSettings}>
                  Open Settings
                </Command.Item>
              </Command.Group>
              <Command.Group heading="Actions" className="text-slate-500">
                <Command.Item
                  className="cursor-pointer rounded px-2 py-2 data-[selected=true]:bg-slate-100"
                  onSelect={() => {
                    void onRefreshTests();
                  }}
                >
                  Refresh Tests
                </Command.Item>
                <Command.Item
                  className="cursor-pointer rounded px-2 py-2 data-[selected=true]:bg-slate-100"
                  onSelect={() => {
                    void onRefreshDevices();
                  }}
                >
                  Refresh Devices
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
