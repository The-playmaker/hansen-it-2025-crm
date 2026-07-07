export function QuoteSummaryCard({ subtotal, vat, total, status }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <p className="text-xs uppercase text-slate-400">Tilbudssammendrag</p>
      {status ? <p className="mt-2 text-sm text-cyan-100">Status: {status}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div><p className="text-xs text-slate-400">Eks. mva</p><p className="font-semibold text-white">{subtotal}</p></div>
        <div><p className="text-xs text-slate-400">MVA</p><p className="font-semibold text-white">{vat}</p></div>
        <div><p className="text-xs text-slate-400">Inkl. mva</p><p className="font-semibold text-white">{total}</p></div>
      </div>
    </div>
  );
}
