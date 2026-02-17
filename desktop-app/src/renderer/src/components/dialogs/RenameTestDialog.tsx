import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { DialogForm } from './DialogForm';

interface RenameTestDialogProps {
  open: boolean;
  renameValue: string;
  renameError: string | null;
  onOpenChange: (open: boolean) => void;
  onRenameValueChange: (value: string) => void;
  onRename: () => Promise<void>;
}

export function RenameTestDialog({
  open,
  renameValue,
  renameError,
  onOpenChange,
  onRenameValueChange,
  onRename
}: RenameTestDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/28" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-slate-300 bg-white p-5 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
          <DialogForm onSubmit={onRename}>
            <button
              type="button"
              aria-label="Close"
              className="absolute right-4 top-4 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => onOpenChange(false)}
            >
              <X size={18} />
            </button>
            <Dialog.Title className="text-[20px] font-semibold leading-none">Rename test file</Dialog.Title>
            <Dialog.Description className="mt-2 text-[13px] text-slate-500">Keep it short and recognizable.</Dialog.Description>
            <input
              autoFocus
              value={renameValue}
              onChange={(event) => onRenameValueChange(event.target.value)}
              placeholder="new-test-name"
              className="mt-4 h-11 w-full rounded-xl border border-slate-300 px-4 text-[14px] leading-none outline-none focus:border-indigo-300"
            />
            {renameError ? <div className="mt-2 text-[13px] text-rose-700">{renameError}</div> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="h-9 rounded-xl border border-slate-300 px-4 text-[14px]" onClick={() => onOpenChange(false)}>
                Cancel
              </button>
              <button type="submit" className="h-9 rounded-xl border border-black bg-black px-4 text-[14px] text-white">
                Save
              </button>
            </div>
          </DialogForm>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
