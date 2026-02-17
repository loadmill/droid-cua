interface ExecutionInputRequestCardProps {
  options: string[];
  selectedIndex: number;
  onSelect: (option: string) => Promise<void>;
  onHover: (index: number) => void;
}

export function ExecutionInputRequestCard({ options, selectedIndex, onSelect, onHover }: ExecutionInputRequestCardProps) {
  return (
    <div className="mt-2.5 w-full overflow-hidden rounded-xl border border-slate-300 bg-white">
      {options.map((option, idx) => {
        const selected = idx === selectedIndex;
        return (
          <button
            key={option}
            type="button"
            onClick={() => void onSelect(option)}
            onMouseEnter={() => onHover(idx)}
            className={`flex w-full items-center justify-between border-t border-slate-200 px-3 py-2 text-left text-[13px] first:border-t-0 ${
              selected ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="capitalize">{option}</span>
            {selected ? <span className="text-[11px] text-slate-500">↵</span> : null}
          </button>
        );
      })}
    </div>
  );
}
