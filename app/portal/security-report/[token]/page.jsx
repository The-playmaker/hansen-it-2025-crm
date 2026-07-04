"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

const severityTone = {
  critical: "border-rose-400/40 bg-rose-500/15 text-rose-100",
  high: "border-orange-400/40 bg-orange-500/15 text-orange-100",
  medium: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  low: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
  ok: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
};

function Badge({ children, tone = "ok" }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severityTone[tone] || severityTone.ok}`}>{children}</span>;
}

export default function SecurityReportPortalPage() {
  const { token } = useParams();
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [share, setShare] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const response = await fetch(`/api/portal/security-report/${token}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Kunne ikke hente rapport.");
        if (!cancelled) {
          setShare(result.data);
          setState("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Kunne ikke hente rapport.");
          setState("error");
        }
      }
    }
    if (token) load();
    return () => { cancelled = true; };
  }, [token]);

  const reportRow = share?.report;
  const report = reportRow?.report || {};
  const problemFindings = useMemo(() => (report.findings || []).filter((finding) => finding.status !== "ok"), [report.findings]);
  const okFindings = useMemo(() => (report.findings || []).filter((finding) => finding.status === "ok"), [report.findings]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950"><ShieldCheck size={24} /></div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Phoenix Scan</p>
                <h1 className="mt-2 text-2xl font-bold">Sikkerhetsrapport</h1>
                <p className="mt-2 text-sm text-slate-300">Delt av Hansen IT. Lenken er token-basert og krever ikke innlogging.</p>
              </div>
            </div>
            {reportRow ? <Badge tone={Number(reportRow.score || 0) >= 75 ? "ok" : Number(reportRow.score || 0) >= 50 ? "medium" : "critical"}>{reportRow.score}/100 · {reportRow.grade}</Badge> : null}
          </div>
        </header>

        {state === "loading" ? <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-slate-300">Henter rapport...</section> : null}
        {state === "error" ? <section className="rounded-3xl border border-rose-400/30 bg-rose-500/10 p-6 text-sm text-rose-200">{error}</section> : null}

        {reportRow ? (
          <>
            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5"><p className="text-sm text-slate-400">Domene</p><p className="mt-2 text-xl font-bold">{reportRow.domain}</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5"><p className="text-sm text-slate-400">Web</p><p className="mt-2 text-xl font-bold">{report.categories?.web?.score ?? "-"}/{report.categories?.web?.max ?? "-"}</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5"><p className="text-sm text-slate-400">E-post</p><p className="mt-2 text-xl font-bold">{report.categories?.email?.score ?? "-"}/{report.categories?.email?.max ?? "-"}</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5"><p className="text-sm text-slate-400">Spoofing</p><p className="mt-2 text-xl font-bold">{report.spoofingRisk?.level || "ukjent"}</p></div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-lg font-semibold">Sammendrag</h2>
              <p className="mt-2 text-slate-300">{report.summary || "Ingen sammendrag lagret."}</p>
              {report.spoofingRisk?.reason ? <p className="mt-3 text-sm text-amber-200">Spoofing-risk: {report.spoofingRisk.reason}</p> : null}
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
              <h2 className="text-lg font-semibold">Prioriterte tiltak</h2>
              <div className="mt-4 space-y-3">
                {(report.actions || []).length ? report.actions.map((action) => (
                  <article key={action.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><p className="font-semibold">{action.title}</p><p className="mt-1 text-sm text-slate-300">{action.fix || action.explain}</p></div>
                      <Badge tone={action.severity}>{action.severity || action.status}</Badge>
                    </div>
                  </article>
                )) : <p className="text-sm text-slate-400">Ingen prioriterte tiltak.</p>}
              </div>
            </section>

            {report.subdomains?.length ? (
              <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                <h2 className="text-lg font-semibold">Subdomener</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {report.subdomains.map((item) => (
                    <div key={item.host} className="rounded-xl border border-white/10 p-3 text-sm">
                      <p className="font-semibold">{item.host}</p>
                      {item.a?.length ? <p className="mt-1 text-xs text-slate-400">A: {item.a.join(", ")}</p> : null}
                      {item.cname?.length ? <p className="mt-1 text-xs text-slate-400">CNAME: {item.cname.join(", ")}</p> : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                <h2 className="text-lg font-semibold">Funn som bør ses på</h2>
                <div className="mt-4 space-y-3">
                  {problemFindings.length ? problemFindings.map((finding) => (
                    <article key={finding.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                      <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" /><div><p className="font-semibold">{finding.title}</p><p className="mt-1 text-sm text-slate-300">{finding.explain}</p></div></div>
                    </article>
                  )) : <p className="text-sm text-slate-400">Ingen problemer funnet.</p>}
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
                <h2 className="text-lg font-semibold">Dette er på plass</h2>
                <div className="mt-4 space-y-3">
                  {okFindings.length ? okFindings.map((finding) => (
                    <article key={finding.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                      <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" /><div><p className="font-semibold">{finding.title}</p><p className="mt-1 text-sm text-slate-300">{finding.explain}</p></div></div>
                    </article>
                  )) : <p className="text-sm text-slate-400">Ingen OK-funn.</p>}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
