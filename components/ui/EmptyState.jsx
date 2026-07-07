export function EmptyState({ title = "Ingen data", text = "Det finnes ingenting å vise her ennå.", action }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
