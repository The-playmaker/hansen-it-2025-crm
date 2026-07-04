"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, SearchCheck } from "lucide-react";
import { EmptyState, Field, MetricCard, PhoenixPageHeader, PhoenixPanel, PrimaryButton, SecondaryButton, StatusBadge, TextInput } from "@/components/phoenix/PhoenixUi";

const categoryLabels = { web: "Web", email: "E-post", domain: "Domene" };

function toneFor(status) {
  if (status === "fail") return "border-rose-400/30 bg-rose-500/10 text-rose-200";
  if (status === "warn") return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  if (status === "ok") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
}

export default function SecurityScanPage() {
  const [domain, setDomain] = useState("");
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  const problems = useMemo(() => report?.findings?.filter((finding) => finding.status !== "ok") || [], [report]);
  const okFindings = useMemo(() => report?.findings?.filter((finding) => finding.status === "ok") || [], [report]);

  const runScan = async (event) => {
    event.preventDefault();
    if (!domain.trim()) return;
    setState("scanning");
    setError("");
    setReport(null);

    try {
      const response = await fetch("/api/admin/security/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Skanningen feilet.");
      setReport(result);
      setState("done");
    } catch (err) {
      setError(err.message || "Skanningen feilet.");
      setState("error");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        eyebrow="Security"
        title="Scan"
        description="Kjør passiv sikkerhetssjekk av domene direkte fra Phoenix CRM. Rapporten lagres i samme Supabase-prosjekt når tabellen finnes."
        action={<Link href="/admin/security/reports" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"><FileText size={16} />Reports</Link>}
      />

      <PhoenixPanel title="Ny skanning" description="Passive oppslag: DNS, RDAP, TLS, HTTPS og sikkerhetsheadere. Ingen aktiv angrepstesting.">
        <form onSubmit={runScan} className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Field label="Domene"><TextInput value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="hansen-it.com" /></Field>
          <div className="flex items-end"><PrimaryButton disabled={state === "scanning"} type="submit"><SearchCheck size={16} />{state === "scanning" ? "Skanner..." : "Start scan"}</PrimaryButton></div>
        </form>
        {error ? <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}
      </PhoenixPanel>

      {state === "scanning" ? <PhoenixPanel><EmptyState text="Skanner domene. Dette kan ta opptil ett minutt..." /></PhoenixPanel> : null}

      {report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Security Score" value={report.score} detail={`Karakter ${report.grade}`} tone={report.score >= 75 ? "emerald" : report.score >= 50 ? "amber" : "rose"} />
            <MetricCard label="Web" value={`${report.categories.web.score}/${report.categories.web.max}`} detail="HTTPS, TLS og headere" tone="cyan" />
            <MetricCard label="E-post" value={`${report.categories.email.score}/${report.categories.email.max}`} detail="SPF, DKIM og DMARC" tone="amber" />
            <MetricCard label="Domene" value={`${report.categories.domain.score}/${report.categories.domain.max}`} detail="RDAP og DNSSEC" tone="emerald" />
          </div>

          <PhoenixPanel title={`Rapport: ${report.domain}`} description={report.summary}>
            <div className="flex flex-wrap gap-2 text-sm text-slate-300">
              <StatusBadge>{report.saved ? "Lagret" : "Ikke lagret"}</StatusBadge>
              {report.reportId ? <span>Rapport-ID: {report.reportId}</span> : null}
              {report.saveError ? <span className="text-amber-200">Lagring feilet: {report.saveError}</span> : null}
            </div>
          </PhoenixPanel>

          <PhoenixPanel title="Prioriterte tiltak" description="Funn som bør rettes først.">
            <div className="space-y-3">
              {report.actions?.length ? report.actions.map((action) => (
                <article key={action.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="font-semibold text-white">{action.title}</h3><p className="mt-1 text-sm text-slate-300">{action.fix}</p></div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${toneFor(action.status)}`}>{action.status}</span>
                  </div>
                  {action.effort ? <p className="mt-2 text-xs text-slate-500">Estimert arbeid: {action.effort}</p> : null}
                </article>
              )) : <EmptyState text="Ingen prioriterte tiltak." />}
            </div>
          </PhoenixPanel>

          <div className="grid gap-6 xl:grid-cols-2">
            <PhoenixPanel title="Funn som bør ses på">
              <div className="space-y-3">
                {problems.length ? problems.map((finding) => (
                  <article key={finding.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" /><div><p className="font-semibold text-white">{finding.title}</p><p className="mt-1 text-sm text-slate-300">{finding.explain}</p><p className="mt-2 text-xs text-slate-500">{categoryLabels[finding.category] || finding.category}</p></div></div>
                  </article>
                )) : <EmptyState text="Ingen problemer funnet." />}
              </div>
            </PhoenixPanel>
            <PhoenixPanel title="Dette er på plass">
              <div className="space-y-3">
                {okFindings.length ? okFindings.map((finding) => (
                  <article key={finding.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" /><div><p className="font-semibold text-white">{finding.title}</p><p className="mt-1 text-sm text-slate-300">{finding.explain}</p></div></div>
                  </article>
                )) : <EmptyState text="Ingen OK-funn ennå." />}
              </div>
            </PhoenixPanel>
          </div>
        </>
      ) : null}
    </div>
  );
}
