export function StatusCard({ label, value, detail, tone = "cyan" }) {
  const tones = {
    cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-100",
    green: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-400/25 bg-amber-500/10 text-amber-100",
    red: "border-rose-400/25 bg-rose-500/10 text-rose-100",
    slate: "border-white/10 bg-white/[0.04] text-slate-100",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.cyan}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {detail ? <p className="mt-1 text-sm opacity-75">{detail}</p> : null}
    </div>
  );
}
