"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, ShieldCheck } from "lucide-react";

function toLines(values) {
  return Array.isArray(values) ? values.join("\n") : "";
}

export default function ScanAuthorizationPortalPage() {
  const { token } = useParams();
  const [authorization, setAuthorization] = useState(null);
  const [scope, setScope] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [signed, setSigned] = useState(null);
  const [form, setForm] = useState({
    signer_name: "",
    signer_email: "",
    signer_role: "",
    domains: "",
    ip_addresses: "",
    scan_type: "passive",
    accepted_terms: false
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/portal/scan-authorization/${token}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Kunne ikke hente autorisasjon.");
        const item = result.data;
        const firstScope = item.scan_scopes?.[0] || null;
        if (!cancelled) {
          setAuthorization(item);
          setScope(firstScope);
          setForm({
            signer_name: item.signer_name || "",
            signer_email: item.signer_email || "",
            signer_role: item.signer_role || "",
            domains: toLines(firstScope?.domains),
            ip_addresses: toLines(firstScope?.ip_addresses),
            scan_type: firstScope?.scan_type || "passive",
            accepted_terms: false
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Kunne ikke hente autorisasjon.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (token) load();
    return () => { cancelled = true; };
  }, [token]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const sign = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/scan-authorization/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Signering feilet.");
      setSigned(result.data);
      setAuthorization(result.data.authorization);
    } catch (err) {
      setError(err.message || "Signering feilet.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950"><ShieldCheck size={24} /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Project Phoenix</p>
              <h1 className="mt-2 text-2xl font-bold">Scan Authorization</h1>
              <p className="mt-2 text-sm text-slate-300">Godkjenn definert scan-scope før Hansen IT kan køe autorisert skanning.</p>
            </div>
          </div>
        </header>

        {loading ? <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-slate-300">Henter autorisasjon...</section> : null}
        {error ? <section className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</section> : null}

        {authorization?.status === "signed" || signed ? (
          <section className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-200" />
              <div>
                <h2 className="text-xl font-bold text-white">Autorisasjonen er signert</h2>
                <p className="mt-2 text-sm text-emerald-100">Scan job er opprettet med status queued. Hansen IT kan nå behandle skanningen innenfor signert scope.</p>
              </div>
            </div>
          </section>
        ) : null}

        {authorization && authorization.status !== "signed" && !signed ? (
          <form onSubmit={sign} className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-lg font-semibold">Kunde og signatar</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-slate-200">Kunde/firma<input className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-white" value={authorization.customer_name || ""} readOnly /></label>
                <label className="text-sm text-slate-200">Navn<input className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-white" value={form.signer_name} onChange={(e) => update("signer_name", e.target.value)} required /></label>
                <label className="text-sm text-slate-200">E-post<input type="email" className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-white" value={form.signer_email} onChange={(e) => update("signer_email", e.target.value)} required /></label>
                <label className="text-sm text-slate-200">Rolle<input className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-white" value={form.signer_role} onChange={(e) => update("signer_role", e.target.value)} required /></label>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-lg font-semibold">Scan-scope</h2>
              <p className="mt-1 text-sm text-slate-400">Bekreft at dette er domener og IP-er dere eier eller har eksplisitt samtykke til å teste.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm text-slate-200">Scan-type<select className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-slate-950/90 px-3 text-white" value={form.scan_type} onChange={(e) => update("scan_type", e.target.value)}>
                  <option value="passive">Passiv OSINT/DNS/HTTP</option>
                  <option value="standard">Standard autorisert scan</option>
                  <option value="extended">Utvidet autorisert scan</option>
                </select></label>
                <div className="hidden md:block" />
                <label className="text-sm text-slate-200">Domener<textarea className="mt-1 min-h-32 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white" value={form.domains} onChange={(e) => update("domains", e.target.value)} /></label>
                <label className="text-sm text-slate-200">IP-er<textarea className="mt-1 min-h-32 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-white" value={form.ip_addresses} onChange={(e) => update("ip_addresses", e.target.value)} /></label>
              </div>
              {scope?.notes ? <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-300">{scope.notes}</p> : null}
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-lg font-semibold">Vilkår</h2>
              <p className="mt-3 whitespace-pre-wrap rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-200">{authorization.terms_text}</p>
              <label className="mt-4 flex items-start gap-3 text-sm text-slate-200">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={form.accepted_terms} onChange={(e) => update("accepted_terms", e.target.checked)} required />
                Jeg bekrefter at jeg har myndighet til å godkjenne dette scope-et, og at Hansen IT kan køe skanningen innenfor vilkårene over.
              </label>
            </section>

            <button disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60">
              <ShieldCheck size={18} />{saving ? "Signerer..." : "Signer og godkjenn scan"}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
