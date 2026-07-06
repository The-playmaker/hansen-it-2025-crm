export function ChecklistCard({ title = "Checklist", items = [] }) {
  const done = items.filter((item) => item.ok).length;
  return (
    <section className={`rounded-2xl border p-5 ${done === items.length ? "border-emerald-400/30 bg-emerald-500/10" : "border-amber-400/30 bg-amber-500/10"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-300">{done}/{items.length} kontrollpunkter er OK.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-sm text-white">{done}/{items.length}</span>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.key || item.label} className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm">
            <span className={item.ok ? "text-emerald-300" : "text-amber-300"}>{item.ok ? "OK" : "Mangler"}</span>
            <span className="ml-2 text-slate-100">{item.label}</span>
            {item.details ? <span className="ml-1 text-slate-400">- {item.details}</span> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
