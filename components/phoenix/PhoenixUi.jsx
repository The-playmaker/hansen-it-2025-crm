import { Plus, Save, Trash2 } from "lucide-react";

export function PhoenixPageHeader({ eyebrow = "Project Phoenix", title, description, action }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm text-slate-300">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function PhoenixPanel({ title, description, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-card backdrop-blur ${className}`}>
      {(title || description) && (
        <div className="mb-4">
          {title ? <h2 className="text-lg font-semibold text-white">{title}</h2> : null}
          {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function MetricCard({ label, value, detail, tone = "cyan" }) {
  const tones = {
    cyan: "from-cyan-500/20 to-blue-500/10 text-cyan-200",
    emerald: "from-emerald-500/20 to-teal-500/10 text-emerald-200",
    amber: "from-amber-500/20 to-orange-500/10 text-amber-200",
    rose: "from-rose-500/20 to-red-500/10 text-rose-200"
  };
  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${tones[tone]} p-5 shadow-card`}>
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
      {detail ? <p className="mt-2 text-xs text-slate-400">{detail}</p> : null}
    </div>
  );
}

export function StatusBadge({ children }) {
  const value = String(children || "").toLowerCase();
  const tone = value.includes("høy") || value.includes("avslått")
    ? "border-rose-400/30 bg-rose-500/10 text-rose-200"
    : value.includes("aktiv") || value.includes("godkjent") || value.includes("ferdig")
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : value.includes("venter") || value.includes("sendt") || value.includes("vurderes")
        ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
        : "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{children}</span>;
}

export function Field({ label, children }) {
  return (
    <label className="block text-sm font-medium text-slate-200">
      <span>{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function TextInput(props) {
  return <input {...props} className={`min-h-10 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400 ${props.className || ""}`} />;
}

export function TextArea(props) {
  return <textarea {...props} className={`min-h-24 w-full resize-y rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400 ${props.className || ""}`} />;
}

export function SelectInput({ options = [], ...props }) {
  return (
    <select {...props} className={`min-h-10 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400 ${props.className || ""}`}>
      {options.map((option) => (
        <option key={option.value || option} value={option.value || option}>{option.label || option}</option>
      ))}
    </select>
  );
}

export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button {...props} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 ${className}`}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...props }) {
  return (
    <button {...props} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 ${className}`}>
      {children}
    </button>
  );
}

export function FormActions({ editing, onCancel }) {
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      <PrimaryButton type="submit"><Save size={16} />{editing ? "Lagre" : "Opprett"}</PrimaryButton>
      {editing ? <SecondaryButton type="button" onClick={onCancel}>Avbryt</SecondaryButton> : null}
    </div>
  );
}

export function RecordCard({ title, meta, badge, children, onEdit, onDelete }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          {meta ? <p className="mt-1 text-sm text-slate-400">{meta}</p> : null}
        </div>
        {badge ? <StatusBadge>{badge}</StatusBadge> : null}
      </div>
      {children ? <div className="mt-3 text-sm text-slate-300">{children}</div> : null}
      {(onEdit || onDelete) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onEdit ? <SecondaryButton onClick={onEdit}>Rediger</SecondaryButton> : null}
          {onDelete ? <button onClick={onDelete} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-400/30 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/10"><Trash2 size={16} />Slett</button> : null}
        </div>
      )}
    </article>
  );
}

export function EmptyState({ text = "Ingen elementer ennå." }) {
  return <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400">{text}</div>;
}

export function AddIcon() {
  return <Plus size={16} />;
}

export function formatDate(value) {
  if (!value) return "Ingen dato";
  return new Intl.DateTimeFormat("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(Number(value || 0));
}
