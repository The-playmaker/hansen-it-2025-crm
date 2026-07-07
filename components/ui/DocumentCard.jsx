export function DocumentCard({ title, filename, type, visible, actions }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{title || filename || "Dokument"}</p>
          <p className="mt-1 text-xs text-slate-400">{type || "attachment"} · {visible ? "Synlig i portal" : "Skjult i portal"}</p>
          {filename ? <p className="mt-1 text-sm text-slate-300">{filename}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
