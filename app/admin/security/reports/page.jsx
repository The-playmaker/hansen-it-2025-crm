"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileJson, Link as LinkIcon, Mail, SearchCheck } from "lucide-react";
import { downloadSecurityReportJson, downloadSecurityReportPdf } from "@/lib/securityScan/exportClient";
import { EmptyState, Field, formatDate, MetricCard, PhoenixPageHeader, PhoenixPanel, PrimaryButton, SecondaryButton, StatusBadge, TextArea, TextInput } from "@/components/phoenix/PhoenixUi";

export default function SecurityReportsPage() {
  const [reports, setReports] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [actionBusy, setActionBusy] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [sendForm, setSendForm] = useState({ recipient_email: "", message: "" });

  useEffect(() => {
    let cancelled = false;
    async function loadReports() {
      setLoading(true);
      try {
        const response = await fetch("/api/admin/security/reports", { cache: "no-store" });
        const result = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(result.error || "Kunne ikke hente rapporter.");
        setConfigured(result.configured !== false);
        setReports(result.data || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Kunne ikke hente rapporter.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadReports();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => reports.filter((report) => report.domain?.toLowerCase().includes(query.toLowerCase())), [reports, query]);
  const averageScore = reports.length ? Math.round(reports.reduce((sum, report) => sum + Number(report.score || 0), 0) / reports.length) : 0;
  const weakReports = reports.filter((report) => Number(report.score || 0) < 60).length;

  const openReport = (report) => {
    setSelected(report);
    setShareUrl("");
    setActionMessage("");
    setError("");
  };

  const createShareLink = async () => {
    if (!selected?.id) return;
    setActionBusy("share");
    setActionMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/security/reports/${selected.id}/share`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke lage delbar lenke.");
      setShareUrl(result.url);
      setActionMessage("Delbar rapportlenke er klar.");
    } catch (err) {
      setError(err.message || "Kunne ikke lage delbar lenke.");
    } finally {
      setActionBusy("");
    }
  };

  const sendReport = async (event) => {
    event.preventDefault();
    if (!selected?.id) return;
    setActionBusy("send");
    setActionMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/security/reports/${selected.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sendForm)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke sende rapport.");
      setShareUrl(result.url);
      setActionMessage("Rapporten er sendt.");
      setSendForm({ recipient_email: "", message: "" });
    } catch (err) {
      setError(err.message || "Kunne ikke sende rapport.");
    } finally {
      setActionBusy("");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        eyebrow="Security"
        title="Reports"
        description="Lagrede Phoenix Scan-rapporter fra CRM-databasen. Samme Supabase-prosjekt som resten av Phoenix."
        action={<Link href="/admin/security/scan" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300"><SearchCheck size={16} />Ny scan</Link>}
      />

      {!configured ? <PhoenixPanel title="Demo mode" description="Supabase er ikke konfigurert, så rapporter lagres ikke ennå." /> : null}
      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Rapporter" value={reports.length} detail="Lagret i security_scan_reports" tone="cyan" />
        <MetricCard label="Snittscore" value={averageScore} detail="Gjennomsnitt av lagrede scans" tone="emerald" />
        <MetricCard label="Under 60" value={weakReports} detail="Bør følges opp" tone="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <PhoenixPanel title="Rapportliste">
          <TextInput className="mb-4" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søk domene..." />
          {loading ? <EmptyState text="Henter rapporter..." /> : null}
          {!loading ? (
            <div className="space-y-3">
              {filtered.length ? filtered.map((report) => (
                <article key={report.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">{report.domain}</h3>
                      <p className="mt-1 text-sm text-slate-400">{formatDate(report.created_at)}{report.created_by ? ` - ${report.created_by}` : ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-2"><StatusBadge>{report.grade}</StatusBadge><StatusBadge>{report.score}/100</StatusBadge></div>
                  </div>
                  <div className="mt-4"><SecondaryButton type="button" onClick={() => openReport(report)}>Åpne detaljer</SecondaryButton></div>
                </article>
              )) : <EmptyState text={configured ? "Ingen rapporter funnet." : "Ingen rapporter i demo mode."} />}
            </div>
          ) : null}
        </PhoenixPanel>

        <PhoenixPanel title="Detaljer" description="Siste valgte rapport.">
          {selected ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm text-slate-400">Domene</p>
                <p className="mt-1 text-xl font-bold text-white">{selected.domain}</p>
                <p className="mt-2 text-sm text-slate-300">Score {selected.score}/100, karakter {selected.grade}</p>
                {selected.report?.spoofingRisk ? <p className="mt-2 text-sm text-amber-200">Spoofing-risk: {selected.report.spoofingRisk.level} - {selected.report.spoofingRisk.reason}</p> : null}
                {selected.report?.subdomains?.length ? <p className="mt-2 text-sm text-slate-400">Subdomener funnet: {selected.report.subdomains.length}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <SecondaryButton type="button" onClick={() => downloadSecurityReportPdf(selected)}><Download size={16} />PDF</SecondaryButton>
                  <SecondaryButton type="button" onClick={() => downloadSecurityReportJson(selected)}><FileJson size={16} />JSON</SecondaryButton>
                  <SecondaryButton type="button" disabled={Boolean(actionBusy)} onClick={createShareLink}><LinkIcon size={16} />{actionBusy === "share" ? "Lager..." : "Del lenke"}</SecondaryButton>
                </div>
                {shareUrl ? <div className="mt-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-3 text-sm text-cyan-100"><p className="font-semibold">Delbar lenke</p><p className="mt-1 break-all">{shareUrl}</p></div> : null}
                {actionMessage ? <div className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{actionMessage}</div> : null}
              </div>
              <form onSubmit={sendReport} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <p className="font-semibold text-white">Send rapport</p>
                <div className="mt-3 space-y-3">
                  <Field label="Mottaker"><TextInput type="email" value={sendForm.recipient_email} onChange={(event) => setSendForm((current) => ({ ...current, recipient_email: event.target.value }))} placeholder="kunde@example.no" /></Field>
                  <Field label="Melding"><TextArea value={sendForm.message} onChange={(event) => setSendForm((current) => ({ ...current, message: event.target.value }))} placeholder="Kort valgfri melding..." /></Field>
                  <PrimaryButton type="submit" disabled={actionBusy === "send"}><Mail size={16} />{actionBusy === "send" ? "Sender..." : "Send rapport"}</PrimaryButton>
                </div>
              </form>
              {selected.report?.subdomains?.length ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="font-semibold text-white">Subdomain discovery</p>
                  <div className="mt-3 space-y-2">
                    {selected.report.subdomains.slice(0, 8).map((item) => (
                      <div key={item.host} className="rounded-xl border border-white/10 p-3 text-sm">
                        <p className="font-semibold text-white">{item.host}</p>
                        {item.a?.length ? <p className="mt-1 text-xs text-slate-400">A: {item.a.join(", ")}</p> : null}
                        {item.cname?.length ? <p className="mt-1 text-xs text-slate-400">CNAME: {item.cname.join(", ")}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                {(selected.report?.actions || []).slice(0, 6).map((action) => (
                  <div key={action.id} className="rounded-xl border border-white/10 p-3">
                    <p className="font-semibold text-white">{action.title}{action.severity ? ` (${action.severity})` : ""}</p>
                    <p className="mt-1 text-sm text-slate-400">{action.fix}</p>
                  </div>
                ))}
                {!(selected.report?.actions || []).length ? <EmptyState text="Ingen prioriterte tiltak i rapporten." /> : null}
              </div>
            </div>
          ) : <EmptyState text="Velg en rapport fra listen." />}
        </PhoenixPanel>
      </div>
    </div>
  );
}
