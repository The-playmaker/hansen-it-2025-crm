"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, FileJson, FileText, Link as LinkIcon, MessageSquarePlus, PackagePlus } from "lucide-react";
import { downloadSecurityReportJson, downloadSecurityReportPdf } from "@/lib/securityScan/exportClient";
import { buildReportRecommendation, servicePackageCategoryLabels } from "@/lib/securityScan/recommendations";
import { EmptyState, formatDate, MetricCard, PhoenixPageHeader, PhoenixPanel, PrimaryButton, SecondaryButton, StatusBadge } from "@/components/phoenix/PhoenixUi";
import CrmLinkPicker from "@/components/admin/CrmLinkPicker";
import ForretningskoblingPanel from "@/components/admin/ForretningskoblingPanel";

const severityLabels = { critical: "kritisk", high: "høy", medium: "middels", low: "lav", ok: "ok" };

function innerReport(row = {}) {
  return row.report && typeof row.report === "object" ? row.report : row;
}

function severityCounts(row = {}) {
  const findings = innerReport(row).findings || [];
  return findings.reduce((counts, finding) => {
    const severity = finding.severity || finding.status || "low";
    if (severity === "critical" || severity === "high") counts.high += 1;
    else if (severity === "medium") counts.medium += 1;
    else if (severity === "low") counts.low += 1;
    return counts;
  }, { high: 0, medium: 0, low: 0 });
}

function customerLabel(row = {}) {
  return row.customer?.company_name || row.request?.company || row.request?.name || "Ingen kunde koblet";
}

export default function SecurityReportDetailPage({ params }) {
  const router = useRouter();
  const [row, setRow] = useState(null);
  const [state, setState] = useState("loading");
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [servicePackages, setServicePackages] = useState([]);
  const [linkPicker, setLinkPicker] = useState(null);
  const [linkItems, setLinkItems] = useState([]);
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");

  const reload = async () => {
    const response = await fetch(`/api/admin/security/reports/${params.id}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Kunne ikke hente rapport.");
    setRow(result.data);
    return result.data;
  };

  useEffect(() => {
    let cancelled = false;
    async function loadReport() {
      try {
        const response = await fetch(`/api/admin/security/reports/${params.id}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Kunne ikke hente rapport.");
        const packagesResponse = await fetch("/api/admin/service-packages", { cache: "no-store" }).catch(() => null);
        const packagesResult = packagesResponse ? await packagesResponse.json().catch(() => ({})) : {};
        if (!cancelled) {
          setRow(result.data);
          setServicePackages(packagesResult.data || []);
          setState("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Kunne ikke hente rapport.");
          setState("error");
        }
      }
    }
    loadReport();
    return () => { cancelled = true; };
  }, [params.id]);

  const report = innerReport(row || {});
  const counts = useMemo(() => severityCounts(row || {}), [row]);
  const findings = report.findings || [];
  const actions = report.actions || [];
  const recommendation = useMemo(() => buildReportRecommendation(report), [report]);
  const recommendedPackages = useMemo(() => {
    const inferred = Array.isArray(recommendation.packages) ? recommendation.packages.slice(0, 3) : [];
    if (!inferred.length) return [];
    return inferred.map((item) => {
      const db = servicePackages.find((pkg) => pkg.slug === item.slug && pkg.is_active !== false);
      if (db) return { ...db, reason: item.reason };
      return {
        slug: item.slug,
        name: item.name,
        reason: item.reason,
        short_description: item.reason,
        category: item.category || "anbefalt",
      };
    });
  }, [servicePackages, recommendation]);

  const createShareLink = async () => {
    if (!row?.id) return;
    setActionBusy("share");
    setActionMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/security/reports/${row.id}/share`, { method: "POST" });
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

  const createCrmAction = async (type, finding) => {
    if (!row || !finding) return;
    if ((type === "quote" || type === "note") && !row.customer_id) {
      setError("Koble til en kunde først.");
      openLinkPicker("customer");
      return;
    }
    const key = `${type}-${finding.id}`;
    setActionBusy(key);
    setActionMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/security/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          domain: row.domain,
          reportId: row.id,
          customer_id: row.customer_id,
          request_id: row.request_id,
          lead_id: row.lead_id,
          finding
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke opprette CRM-handling.");
      setActionMessage(type === "task" ? "Oppgave opprettet." : type === "quote" ? "Tilbudskladd opprettet." : "Kundenotat lagt til.");
    } catch (err) {
      console.error("CRM-handling feilet:", err);
      setError(err.message || "Kunne ikke opprette CRM-handling.");
    } finally {
      setActionBusy("");
    }
  };

  const createPackageQuote = async (packageIds = []) => {
    if (!row) return;
    if (!row.customer_id) {
      setError("Koble til en kunde først. Et tilbud uten kunde gir ingen mening.");
      openLinkPicker("customer");
      return;
    }
    setActionBusy(packageIds.length === 1 ? `package-${packageIds[0]}` : "packages");
    setActionMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/security/reports/${row.id}/service-package-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageIds })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke lage tilbudskladd fra produktpakker.");
      setActionMessage(`Tilbud oppdatert: ${result.data?.title || result.data?.id}`);
      if (result.url) router.push(result.url);
      else await reload();
    } catch (err) {
      console.error("Opprett tilbud fra pakker feilet:", err);
      setError(err.message || "Kunne ikke lage tilbudskladd fra produktpakker.");
    } finally {
      setActionBusy("");
    }
  };

  const syncQuoteFromReport = async () => {
    if (!row?.id) return;
    if (!row.customer_id) {
      setError("Koble til en kunde først. Et tilbud uten kunde gir ingen mening.");
      openLinkPicker("customer");
      return;
    }
    setActionBusy("sync-quote");
    setActionMessage("");
    setError("");
    try {
      const response = await fetch(`/api/admin/security/reports/${row.id}/service-package-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke opprette eller oppdatere tilbud.");
      setActionMessage("Tilbud er opprettet/oppdatert fra rapporten.");
      if (result.url) router.push(result.url);
      else await reload();
    } catch (err) {
      console.error("Opprett tilbud feilet:", err);
      setError(err.message || "Kunne ikke opprette eller oppdatere tilbud.");
    } finally {
      setActionBusy("");
    }
  };

  const openLinkPicker = async (type) => {
    setLinkPicker(type);
    setLinkError("");
    setLinkLoading(true);
    setLinkItems([]);
    try {
      if (type === "contact") {
        if (!row?.customer_id) {
          setLinkLoading(false);
          return;
        }
        const response = await fetch(`/api/admin/customers/${row.customer_id}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Kunne ikke hente kontakter.");
        setLinkItems(result.data?.contacts || []);
        return;
      }
      const path = type === "customer" ? "/api/admin/customers" : "/api/admin/requests";
      const response = await fetch(path, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke hente liste.");
      setLinkItems(result.data || []);
    } catch (err) {
      console.error("Link-picker feilet:", err);
      setLinkError(err.message || "Kunne ikke hente liste.");
    } finally {
      setLinkLoading(false);
    }
  };

  const patchLinks = async (payload) => {
    setActionBusy("link");
    setError("");
    setActionMessage("");
    try {
      const response = await fetch(`/api/admin/security/reports/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke oppdatere koblingen.");
      setRow(result.data);
      setActionMessage("Koblingen er lagret.");
      setLinkPicker(null);
    } catch (err) {
      console.error("PATCH rapportkobling feilet:", err);
      setError(err.message || "Kunne ikke oppdatere koblingen.");
    } finally {
      setActionBusy("");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        eyebrow="Security Reports"
        title={row?.domain || "Rapportdetaljer"}
        description="Sammendrag, score, tekniske funn og Fix with Hansen IT-handlinger samlet på én side."
        action={<Link href="/admin/security/reports" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"><ArrowLeft size={16} />Til rapporter</Link>}
      />

      {state === "loading" ? <PhoenixPanel><EmptyState text="Henter rapport..." /></PhoenixPanel> : null}
      {state === "error" ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}

      {row ? (
        <>
          {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}
          {actionMessage ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{actionMessage}</div> : null}
          {shareUrl ? <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm text-cyan-100"><p className="font-semibold">Delbar lenke</p><p className="mt-1 break-all">{shareUrl}</p></div> : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Score" value={row.score} detail={`Karakter ${row.grade}`} tone={Number(row.score || 0) >= 75 ? "emerald" : Number(row.score || 0) >= 50 ? "amber" : "rose"} />
            <MetricCard label="High" value={counts.high} detail="Kritisk/høy severity" tone="rose" />
            <MetricCard label="Medium" value={counts.medium} detail="Middels severity" tone="amber" />
            <MetricCard label="Low" value={counts.low} detail="Lav severity" tone="cyan" />
            <MetricCard label="Kunde" value={row.customer_id ? "Koblet" : "Ikke koblet"} detail={`${customerLabel(row)} · ${formatDate(row.created_at)}`} tone="emerald" />
          </div>

          <ForretningskoblingPanel
            row={row}
            busy={actionBusy}
            description="Koble rapporten til kunde, kontakt og henvendelse før du lager tilbud."
            onLinkCustomer={() => openLinkPicker("customer")}
            onLinkContact={() => openLinkPicker("contact")}
            onLinkRequest={() => openLinkPicker("request")}
            onCreateQuote={syncQuoteFromReport}
            createQuoteLabel="Opprett tilbud fra denne rapporten"
            createQuoteBusy={actionBusy === "sync-quote"}
          />

          <PhoenixPanel title="Sammendrag" description={report.summary || "Ingen sammendrag lagret."}>
            <div className="flex flex-wrap gap-2">
              <StatusBadge>{row.grade}</StatusBadge>
              <StatusBadge>{row.score}/100</StatusBadge>
              {row.customer_id ? <StatusBadge>Kunde koblet</StatusBadge> : null}
              {row.request_id ? <StatusBadge>Request koblet</StatusBadge> : null}
              {row.lead_id ? <StatusBadge>Lead koblet</StatusBadge> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <SecondaryButton type="button" onClick={() => downloadSecurityReportPdf(row)}><Download size={16} />Last ned PDF</SecondaryButton>
              <SecondaryButton type="button" onClick={() => downloadSecurityReportJson(row)}><FileJson size={16} />Last ned JSON</SecondaryButton>
              <SecondaryButton type="button" disabled={Boolean(actionBusy)} onClick={createShareLink}><LinkIcon size={16} />{actionBusy === "share" ? "Lager..." : "Lag delbar lenke"}</SecondaryButton>
            </div>
          </PhoenixPanel>

          <PhoenixPanel title={recommendation.title} description={recommendation.text}>
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Anbefalt prioritet" value={recommendation.priority} detail={recommendation.firstStep} tone={recommendation.level === "urgent" ? "rose" : recommendation.level === "scope_warning" ? "amber" : "emerald"} />
              <MetricCard label="Estimert arbeid" value={recommendation.estimate} detail="Summert fra funn som ikke er OK." tone="cyan" />
              <MetricCard label="Forslag" value={recommendation.suggestions?.length || 0} detail="Neste steg og pakker" tone="emerald" />
            </div>
            <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
              <p className="font-semibold">{recommendation.cta}</p>
              <p className="mt-1">Fix with Hansen IT betyr kontrollert oppgave- og tilbudsflyt, ikke automatisk teknisk endring.</p>
            </div>
          </PhoenixPanel>

          <PhoenixPanel title="Score dashboard">
            <div className="grid gap-3 md:grid-cols-5">
              {Object.entries(report.categories || {}).map(([key, category]) => (
                <div key={key} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-sm text-slate-400">{key}</p>
                  <p className="mt-2 text-2xl font-bold text-white">{category.score}/{category.max}</p>
                </div>
              ))}
            </div>
          </PhoenixPanel>

          <PhoenixPanel title="Prioriterte tiltak" description="Fix with Hansen IT oppretter CRM-arbeid eller tilbud. Det gjør ingen automatisk teknisk endring.">
            <div className="space-y-3">
              {actions.length ? actions.map((action) => (
                <article key={action.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">{action.title}</h3>
                      <p className="mt-1 text-sm text-slate-300">{action.fix || action.explain}</p>
                      {action.effort ? <p className="mt-2 text-xs text-slate-500">Estimert arbeid: {action.effort}</p> : null}
                    </div>
                    <StatusBadge>{severityLabels[action.severity] || action.severity || action.status}</StatusBadge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <SecondaryButton disabled={Boolean(actionBusy)} onClick={() => createCrmAction("task", action)}><CheckCircle2 size={15} />Opprett oppgave</SecondaryButton>
                    <SecondaryButton disabled={Boolean(actionBusy)} onClick={() => createCrmAction("quote", action)}><FileText size={15} />Opprett/oppdater tilbud</SecondaryButton>
                    <SecondaryButton disabled={Boolean(actionBusy) || !row.customer_id} onClick={() => createCrmAction("note", action)}><MessageSquarePlus size={15} />Legg til kundenotat</SecondaryButton>
                  </div>
                </article>
              )) : <EmptyState text="Ingen prioriterte tiltak." />}
            </div>
          </PhoenixPanel>

          <PhoenixPanel title="Anbefalte produktpakker" description="Pakker foreslås fra rapportfunn. Tilbud sendes ikke automatisk.">
            <div className="space-y-3">
              {recommendedPackages.length ? recommendedPackages.map((pkg) => (
                <article key={pkg.id || pkg.slug} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white">{pkg.name}</h3>
                      <p className="mt-1 text-sm text-slate-300">{pkg.reason || pkg.short_description || "Anbefalt produktpakke basert på rapportfunn."}</p>
                    </div>
                    <StatusBadge>{servicePackageCategoryLabels[pkg.category] || pkg.category}</StatusBadge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {pkg.id ? <SecondaryButton disabled={Boolean(actionBusy)} onClick={() => createPackageQuote([pkg.id])}><PackagePlus size={15} />Legg anbefalt pakke til tilbud</SecondaryButton> : null}
                    {pkg.id ? <Link href={`/admin/service-packages/${pkg.id}`} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Åpne pakke</Link> : null}
                    {!pkg.id ? <StatusBadge>Migration/seed kreves</StatusBadge> : null}
                  </div>
                </article>
              )) : <EmptyState text="Ingen pakker foreslått for denne rapporten." />}
            </div>
            {recommendedPackages.some((pkg) => pkg.id) ? (
              <div className="mt-4">
                <PrimaryButton type="button" disabled={Boolean(actionBusy)} onClick={() => createPackageQuote(recommendedPackages.filter((pkg) => pkg.id).map((pkg) => pkg.id))}>
                  <PackagePlus size={16} />Opprett/oppdater tilbud fra anbefalte pakker
                </PrimaryButton>
              </div>
            ) : null}
          </PhoenixPanel>

          <PhoenixPanel title="Technical appendix">
            <div className="space-y-3">
              {findings.length ? findings.map((finding) => (
                <article key={finding.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{finding.title}</p>
                      <p className="mt-1 text-sm text-slate-300">{finding.explain}</p>
                      {finding.evidence ? <p className="mt-2 text-xs text-slate-500">Evidens: {finding.evidence}</p> : null}
                    </div>
                    <StatusBadge>{severityLabels[finding.severity] || finding.severity || finding.status}</StatusBadge>
                  </div>
                </article>
              )) : <EmptyState text="Ingen funn i rapporten." />}
            </div>
          </PhoenixPanel>
        </>
      ) : null}

      <CrmLinkPicker
        open={linkPicker === "customer"}
        title="Koble til kunde"
        description="Velg kunden som eier denne rapporten."
        items={linkItems}
        loading={linkLoading}
        error={linkError}
        searchKeys={["company_name", "email", "name", "organization_number"]}
        labelFor={(item) => item.company_name || item.name || item.email || item.id}
        detailFor={(item) => [item.email, item.organization_number].filter(Boolean).join(" · ")}
        onClose={() => setLinkPicker(null)}
        onSelect={(customer) => patchLinks({ customer_id: customer.id })}
      />
      <CrmLinkPicker
        open={linkPicker === "contact"}
        title="Koble kontaktperson"
        description={row?.customer_id ? "Velg kontaktperson for kunden." : "Velg kunde først."}
        items={linkItems}
        loading={linkLoading}
        error={linkError}
        emptyMessage={row?.customer_id ? "Ingen kontakter for valgt kunde." : "Velg kunde først."}
        searchKeys={["name", "email", "phone", "title"]}
        labelFor={(item) => item.name || item.email || item.id}
        detailFor={(item) => [item.email, item.phone].filter(Boolean).join(" · ")}
        onClose={() => setLinkPicker(null)}
        onSelect={(contact) => patchLinks({ contact_id: contact.id })}
      />
      <CrmLinkPicker
        open={linkPicker === "request"}
        title="Koble til henvendelse"
        description="Velg request/henvendelse som hører til rapporten."
        items={linkItems}
        loading={linkLoading}
        error={linkError}
        searchKeys={["company", "name", "email", "status"]}
        labelFor={(item) => item.company || item.name || item.email || item.id}
        detailFor={(item) => [item.email, item.status].filter(Boolean).join(" · ")}
        onClose={() => setLinkPicker(null)}
        onSelect={(request) => patchLinks({ request_id: request.id })}
      />
    </div>
  );
}
