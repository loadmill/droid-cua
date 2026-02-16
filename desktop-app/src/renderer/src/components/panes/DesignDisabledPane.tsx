export function DesignDisabledPane() {
  return (
    <section className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-xl rounded-xl border border-slate-300 bg-white p-6 text-center">
        <div className="text-[16px] font-semibold">New Test Design Mode</div>
        <div className="mt-2 text-[13px] text-slate-600">Coming soon in a later phase. For v1, create/select tests under ./tests and run them.</div>
      </div>
    </section>
  );
}
