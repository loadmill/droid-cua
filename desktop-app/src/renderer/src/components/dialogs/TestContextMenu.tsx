import type { ContextMenuState } from '../../app/types';
import type { TestRef } from '../../app/types';

interface TestContextMenuProps {
  menu: ContextMenuState | null;
  onClose: () => void;
  onRename: (ref: TestRef) => void;
  onDelete: (ref: TestRef) => void;
}

export function TestContextMenu({ menu, onClose, onRename, onDelete }: TestContextMenuProps) {
  if (!menu) return null;

  return (
    <div className="fixed inset-0 z-[80]" onMouseDown={onClose} onContextMenu={(event) => event.preventDefault()}>
      <div
        className="fixed min-w-[170px] rounded-[10px] border border-[#b7b7b7] bg-[#f1f1f1] p-1 shadow-[0_4px_10px_rgba(0,0,0,0.10)]"
        style={{ left: menu.x, top: menu.y }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="block w-full rounded-[7px] px-2.5 py-1.5 text-left text-[12px] font-normal leading-[1.2] text-[#2c2c2c] hover:bg-[#e7e7e7]"
          onClick={() => onRename(menu.ref)}
        >
          Rename
        </button>
        <div className="mx-2 my-0.5 border-t border-[#cccccc]" />
        <button
          type="button"
          className="block w-full rounded-[7px] px-2.5 py-1.5 text-left text-[12px] font-normal leading-[1.2] text-[#2c2c2c] hover:bg-[#e7e7e7]"
          onClick={() => onDelete(menu.ref)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
