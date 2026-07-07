export function ReportSummaryCard({ title = "Samlet sikkerhetsrapport", score, recommendation, actions }) {
  return (
    <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {recommendation ? <p className="mt-1 text-sm text-cyan-100">{recommendation}</p> : null}
        </div>
        {score !== undefined ? <span className="rounded-full border border-white/15 bg-slate-950/50 px-3 py-1 text-sm font-semibold text-white">{score}/100</span> : null}
      </div>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
