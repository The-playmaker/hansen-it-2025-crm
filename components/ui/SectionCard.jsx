export function SectionCard({ title, description, action, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-slate-950/55 p-5 shadow-sm ${className}`}>
      {(title || description || action) ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-lg font-semibold text-white">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
