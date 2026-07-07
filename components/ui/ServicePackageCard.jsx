export function ServicePackageCard({ title, description, included = [], price, badge = "Pakke", action }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white">{title}</h3>
            {badge ? <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-100">{badge}</span> : null}
          </div>
          {description ? <p className="mt-1 text-sm text-slate-300">{description}</p> : null}
        </div>
        {price ? <p className="font-semibold text-white">{price}</p> : null}
      </div>
      {included.length ? (
        <ul className="mt-3 space-y-1 rounded-xl border border-white/10 bg-slate-900/40 p-3 text-sm text-slate-300">
          {included.map((item) => <li key={item.id || item.title}>- {item.title || item}</li>)}
        </ul>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </article>
  );
}
