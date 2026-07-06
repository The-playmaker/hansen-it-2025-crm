export function PortalActionCard({ title = "Neste steg", text, actions }) {
  return (
    <div className="rounded-2xl border border-cyan-400/25 bg-[#1B2A52]/90 p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {text ? <p className="mt-2 text-sm text-slate-200">{text}</p> : null}
      {actions ? <div className="mt-4 space-y-2">{actions}</div> : null}
    </div>
  );
}
