import * as Dialog from '@radix-ui/react-dialog';
import { DialogForm } from './DialogForm';

interface CreateTestDialogProps {
  open: boolean;
  targetFolderName: string | null;
  requestedName: string;
  createError: string | null;
  onOpenChange: (open: boolean) => void;
  onRequestedNameChange: (value: string) => void;
  onCreate: () => Promise<void>;
}

export function CreateTestDialog({
  open,
  targetFolderName,
  requestedName,
  createError,
  onOpenChange,
  onRequestedNameChange,
  onCreate
}: CreateTestDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/35" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-300 bg-white p-4 shadow-xl">
          <DialogForm onSubmit={onCreate}>
            <Dialog.Title className="text-[15px] font-semibold">Create test{targetFolderName ? ` in ${targetFolderName}` : ''}</Dialog.Title>
            <Dialog.Description className="mt-1 text-[12px] text-slate-600">Use a base name. <code>.dcua</code> will be normalized and duplicate names auto-suffix.</Dialog.Description>
            <input
              autoFocus
              value={requestedName}
              onChange={(event) => onRequestedNameChange(event.target.value)}
              placeholder="login-flow"
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-[13px] outline-none focus:border-indigo-300"
            />
            {createError ? <div className="mt-2 text-[12px] text-rose-700">{createError}</div> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-[12px]" onClick={() => onOpenChange(false)}>
                Cancel
              </button>
              <button type="submit" className="rounded border border-indigo-700 bg-indigo-700 px-3 py-1.5 text-[12px] text-white">
                Create
              </button>
            </div>
          </DialogForm>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
