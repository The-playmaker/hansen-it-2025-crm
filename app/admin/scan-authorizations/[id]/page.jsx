"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Download, FileText, MessageSquarePlus, Play } from "lucide-react";
import { jsPDF } from "jspdf";
import { downloadSecurityReportPdf } from "@/lib/securityScan/exportClient";
import { buildReportRecommendation, standardServicePackages } from "@/lib/securityScan/recommendations";
import { EmptyState, formatDate, PhoenixPageHeader, PhoenixPanel, SecondaryButton, StatusBadge } from "@/components/phoenix/PhoenixUi";

function dateTime(value) {
  return value ? new Date(value).toLocaleString("nb-NO") : "-";
}

function duration(start, end) {
  if (!start || !end) return "-";
  const seconds = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function jobStatusText(job) {
  if (!job) return "Ingen scan job";
  return {
    queued: "Queued - waiting for scanner runner",
    running: "Running - scanner runner behandler jobben",
    completed: "Completed - scan er ferdig",
    failed: "Failed - se feilmelding under",
    cancelled: "Cancelled"
  }[job.status] || job.status;
}

function reportDomain(report) {
  return report?.report?.domain || report?.title?.replace(/^Phoenix Security Report:\s*/i, "") || "ukjent-domene";
}

function findingForAction(finding, report) {
  return {
    id: finding?.id || finding?.evidence?.finding_id || finding?.title || "scan-finding",
    title: finding?.title || "Phoenix Scan-funn",
    severity: finding?.severity || "medium",
    explain: finding?.description || finding?.evidence?.description || "",
    fix: finding?.recommendation || "",
    evidence: finding?.evidence ? JSON.stringify(finding.evidence).slice(0, 600) : "",
    category: finding?.category || "security"
  };
}

function innerReport(row = {}) {
  return row.report && typeof row.report === "object" ? row.report : row;
}

export default function ScanAuthorizationDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const portalUrl = useMemo(() => {
    if (!item?.token || typeof window === "undefined") return "";
    return `${window.location.origin}/portal/scan-authorization/${item.token}`;
  }, [item]);

  const jobs = useMemo(() => [...(item?.scan_jobs || [])].sort((a, b) => new Date(b.queued_at || 0) - new Date(a.queued_at || 0)), [item]);
  const job = jobs[0] || null;
  const reports = useMemo(() => item?.scan_reports || [], [item]);
  const combinedReports = useMemo(() => reports.filter((report) => report.report_type === "combined" || report.report?.reportType === "combined"), [reports]);
  const domainReports = useMemo(() => reports.filter((report) => !combinedReports.some((combined) => combined.id === report.id)), [reports, combinedReports]);
  const results = useMemo(() => item?.scan_results || [], [item]);
  const findings = useMemo(() => item?.scan_findings || [], [item]);
  const resultById = useMemo(() => Object.fromEntries(results.map((result) => [result.id, result])), [results]);
  const findingsByDomain = useMemo(() => {
    return findings.reduce((groups, finding) => {
      const domain = resultById[finding.result_id]?.raw_result?.domain || finding.evidence?.domain || "Ukjent domene";
      groups[domain] = groups[domain] || [];
      groups[domain].push(finding);
      return groups;
    }, {});
  }, [findings, resultById]);
  const counters = useMemo(() => findings.reduce((count, finding) => {
    const severity = finding.severity || "info";
    count[severity] = (count[severity] || 0) + 1;
    return count;
  }, { critical: 0, high: 0, medium: 0, low: 0, info: 0 }), [findings]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/scan-authorizations/${id}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke hente autorisasjon.");
      setItem(result.data);
    } catch (err) {
      setError(err.message || "Kunne ikke hente autorisasjon.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const createPassiveJob = async () => {
    setBusy("new-job");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/scan-authorizations/${id}/jobs`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke opprette ny passiv scan.");
      setMessage("Ny passiv scan er lagt i kø.");
      await load();
    } catch (err) {
      setError(err.message || "Kunne ikke opprette ny passiv scan.");
    } finally {
      setBusy("");
    }
  };

  const runPassiveJob = async () => {
    if (!job?.id) return;
    setBusy("run-job");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/scan-jobs/${job.id}/run-passive`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke kjøre passiv scan-jobb.");
      setMessage(result.idle ? "Ingen queued jobber." : "Passiv scan-jobb er kjørt ferdig.");
      await load();
    } catch (err) {
      setError(err.message || "Kunne ikke kjøre passiv scan-jobb.");
      await load();
    } finally {
      setBusy("");
    }
  };

  const createCrmItem = async (type, report, finding) => {
    const key = `${type}-${report.id}`;
    setBusy(key);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/security/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          domain: reportDomain(report),
          reportId: report.id,
          finding: findingForAction(finding || report.report?.actions?.[0] || report.report?.findings?.[0], report)
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke opprette CRM-element.");
      setMessage(type === "task" ? "Oppgave opprettet fra rapport." : "Tilbudskladd opprettet fra rapport.");
    } catch (err) {
      setError(err.message || "Kunne ikke opprette CRM-element.");
    } finally {
      setBusy("");
    }
  };

  const createCombinedReport = async () => {
    setBusy("combined-report");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/scan-authorizations/${id}/combined-report`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke lage samlet rapport.");
      setMessage("Samlet rapport er opprettet.");
      await load();
      setTimeout(() => document.getElementById("combined-report")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      setError(err.message || "Kunne ikke lage samlet rapport.");
    } finally {
      setBusy("");
    }
  };

  const syncQuoteFromReport = async (report) => {
    if (!report?.id) return;
    setBusy(`sync-quote-${report.id}`);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/scan-reports/${report.id}/sync-quote`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Kunne ikke opprette eller oppdatere tilbud.");
      setMessage("Tilbud er opprettet/oppdatert fra anbefalte pakker.");
      if (result.url) router.push(result.url);
      else await load();
    } catch (err) {
      setError(err.message || "Kunne ikke opprette eller oppdatere tilbud.");
    } finally {
      setBusy("");
    }
  };

  const downloadCombinedPdf = () => {
    if (!domainReports.length && !combinedReports.length) return;
    const doc = new jsPDF();
    const margin = 16;
    let y = 22;
    const addWrapped = (text, x = margin, width = 178, lineHeight = 5.2) => {
      const lines = doc.splitTextToSize(String(text || ""), width);
      doc.text(lines, x, y);
      y += lines.length * lineHeight;
    };
    const ensure = (needed = 24) => {
      if (y + needed > 270) {
        doc.addPage();
        y = 22;
      }
    };
    const cleanReports = (domainReports.length ? domainReports : reports).filter((report) => report.report_type !== "combined").map(innerReport);
    const savedCombined = combinedReports[0]?.report;
    const allActions = cleanReports.flatMap((report) => report.actions || []);
    const allFindings = cleanReports.flatMap((report) => report.findings || []);
    const worst = allFindings.find((finding) => ["critical", "high"].includes(finding.severity || finding.status)) || allFindings[0];
    const averageScore = Math.round(cleanReports.reduce((sum, report) => sum + Number(report.score || 0), 0) / cleanReports.length);
    const combinedReport = {
      domain: cleanReports.map((report) => report.domain).filter(Boolean).join(", "),
      score: averageScore,
      findings: allFindings,
      actions: allActions,
      summary: "Samlet rapport basert på passive eksterne kontroller."
    };
    const recommendation = savedCombined?.recommendation || buildReportRecommendation(combinedReport);
    const packages = standardServicePackages.filter((pkg) => recommendation.packageSlugs?.includes(pkg.slug));

    doc.setFillColor(21, 33, 73);
    doc.rect(0, 0, 210, 48, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text("Hansen IT", margin, 18);
    doc.setFontSize(12);
    doc.setFont(undefined, "normal");
    doc.text("Phoenix Security Report", margin, 30);
    doc.text("Samlet hovedrapport", margin, 39);

    y = 64;
    doc.setTextColor(21, 33, 73);
    doc.setFontSize(20);
    doc.setFont(undefined, "bold");
    addWrapped(item.customer_name || "Scan authorization");
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    addWrapped(`Dokumentdato: ${new Date().toLocaleDateString("nb-NO")}`);
    addWrapped(`Domener: ${combinedReport.domain || "Ikke oppgitt"}`);
    addWrapped(`Samlet score: ${averageScore}/100`);
    addWrapped(`Samlet prioritet: ${recommendation.priority}`);
    if (worst) addWrapped(`Høyeste funn: ${worst.title || worst.id || worst.severity || "Ikke oppgitt"}`);

    y += 6;
    doc.setFillColor(245, 248, 253);
    doc.roundedRect(margin, y, 178, 32, 3, 3, "F");
    y += 9;
    doc.setFont(undefined, "bold");
    doc.text("Oppsummering for kunde", margin + 6, y);
    y += 6;
    doc.setFont(undefined, "normal");
    addWrapped(recommendation.text, margin + 6, 166);
    y += 10;

    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text("Domeneoversikt", margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    cleanReports.forEach((report) => {
      ensure(12);
      addWrapped(`${report.domain}: score ${report.score ?? "-"} / 100, grade ${report.grade || "-"}`);
    });

    ensure(40);
    y += 5;
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text("Topp tiltak", margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    allActions.filter((action) => (action.severity || action.status) !== "ok").slice(0, 8).forEach((action, index) => {
      ensure(14);
      addWrapped(`${index + 1}. ${action.title || "Tiltak"} - ${action.fix || action.recommendation || action.explain || ""}`);
      y += 2;
    });
    if (!allActions.length) addWrapped("Ingen kritiske tiltak registrert i rapportene.");

    ensure(36);
    y += 5;
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text("Anbefalte pakker", margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    addWrapped(packages.length ? packages.map((pkg) => pkg.name).join(", ") : "Månedlig sikkerhetskontroll");

    doc.addPage();
    y = 22;
    doc.setFontSize(16);
    doc.setFont(undefined, "bold");
    doc.text("Teknisk appendix", margin, y);
    y += 10;
    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    cleanReports.forEach((report) => {
      ensure(20);
      doc.setFont(undefined, "bold");
      addWrapped(report.domain || "Domene");
      doc.setFont(undefined, "normal");
      (report.findings || []).forEach((finding) => {
        ensure(12);
        addWrapped(`- ${finding.title || finding.id || "Funn"} (${finding.severity || finding.status || "ukjent"}): ${finding.explain || finding.description || finding.evidence || ""}`);
      });
    });

    doc.save(`phoenix-samlet-scanrapport-${String(item.customer_name || "kunde").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`);
  };

  const scope = item?.scan_scopes?.[0];
  const runner = job?.metadata?.runner || {};
  const scannedDomains = job?.metadata?.passive_domains_scanned || reports.map(reportDomain);
  const primaryReport = combinedReports[0] || domainReports[0] || reports[0] || null;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <PhoenixPageHeader
        eyebrow="Security"
        title="Scan Authorization"
        description="Detaljer, signert scope, scan_job-status, resultater og rapporter."
        action={<SecondaryButton type="button" onClick={() => router.push("/admin/scan-authorizations")}><ArrowLeft size={16} />Tilbake</SecondaryButton>}
      />

      {loading ? <PhoenixPanel><EmptyState text="Henter autorisasjon..." /></PhoenixPanel> : null}
      {error ? <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div> : null}

      {item ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <p className="font-semibold">Passive scan runner active</p>
              <p className="mt-1">phoenix-scan01 kjører kun passiv scan for denne noden.</p>
            </div>
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-semibold">Active scanning disabled - shared egress IP</p>
              <p className="mt-1">Egress IP 185.243.217.163 er delt Proxmox/NAT. external_active, Nmap og vuln scan er blokkert.</p>
            </div>
          </div>

          <PhoenixPanel title={item.customer_name} description={`Signatar: ${item.signer_name || "-"} - ${item.signer_email}`}>
            <div className="flex flex-wrap gap-2">
              <StatusBadge>{item.status}</StatusBadge>
              {job ? <StatusBadge>{jobStatusText(job)}</StatusBadge> : null}
              {item.signed_at ? <StatusBadge>signert {formatDate(item.signed_at)}</StatusBadge> : null}
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <p className="text-sm text-slate-400">Portal-lenke</p>
              <p className="mt-1 break-all text-sm text-cyan-200">{portalUrl}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <SecondaryButton type="button" onClick={copyLink}><Copy size={16} />{copied ? "Kopiert" : "Kopier lenke"}</SecondaryButton>
                <Link href={portalUrl} target="_blank"><SecondaryButton type="button">Åpne portal</SecondaryButton></Link>
              </div>
            </div>
          </PhoenixPanel>

          <PhoenixPanel title="Forretningskobling" description="Koblingen som driver flyten videre til tilbud, dokumenter og kundeportal.">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm text-slate-400">Kunde</p>
                <p className="mt-1 font-semibold text-white">{item.customer?.company_name || item.customer_name || "Ikke koblet"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm text-slate-400">Kontaktperson</p>
                <p className="mt-1 font-semibold text-white">{item.contact?.name || item.signer_name || "Ikke koblet"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm text-slate-400">Henvendelse</p>
                <p className="mt-1 font-semibold text-white">{item.request?.company || item.request?.name || item.request_id || "Ikke koblet"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-sm text-slate-400">Tilbud / portal</p>
                <p className="mt-1 font-semibold text-white">{item.quote?.title || item.quote_id || "Mangler tilbud"}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {item.quote_id ? <Link href={`/admin/quotes/${item.quote_id}`}><SecondaryButton type="button">Åpne tilbud</SecondaryButton></Link> : null}
              {!item.quote_id && primaryReport ? <SecondaryButton type="button" disabled={Boolean(busy)} onClick={() => syncQuoteFromReport(primaryReport)}>Opprett tilbud fra denne scannen</SecondaryButton> : null}
              {!item.customer_id ? <SecondaryButton type="button" disabled>Koble til kunde</SecondaryButton> : null}
              {!item.request_id ? <SecondaryButton type="button" disabled>Koble til henvendelse</SecondaryButton> : null}
            </div>
          </PhoenixPanel>

          <div className="grid gap-6 xl:grid-cols-2">
            <PhoenixPanel title="Scope">
              {scope ? (
                <div className="space-y-4 text-sm">
                  <div><p className="text-slate-400">Scan-type</p><p className="font-semibold text-white">{scope.scan_type}</p></div>
                  <div><p className="text-slate-400">Domener</p><p className="whitespace-pre-wrap text-white">{(scope.domains || []).join("\n") || "-"}</p></div>
                  <div><p className="text-slate-400">IP-er</p><p className="whitespace-pre-wrap text-white">{(scope.ip_addresses || []).join("\n") || "-"}</p></div>
                  <div><p className="text-slate-400">Bekreftet av kunde</p><p className="text-white">{scope.confirmed_by_customer ? "Ja" : "Nei"}</p></div>
                </div>
              ) : <EmptyState text="Mangler scope." />}
            </PhoenixPanel>

            <PhoenixPanel title="Signatur og audit">
              <div className="space-y-3 text-sm">
                <div><p className="text-slate-400">Rolle</p><p className="text-white">{item.signer_role || "-"}</p></div>
                <div><p className="text-slate-400">IP-adresse</p><p className="text-white">{item.signed_ip || "-"}</p></div>
                <div><p className="text-slate-400">Timestamp</p><p className="text-white">{item.signed_at ? dateTime(item.signed_at) : "-"}</p></div>
                <div><p className="text-slate-400">Vilkår</p><p className="whitespace-pre-wrap text-slate-200">{item.terms_text}</p></div>
              </div>
            </PhoenixPanel>
          </div>

          <PhoenixPanel title="Scan job" description={job?.status === "completed" ? "Scan ferdig." : "Queue-status viser om jobben faktisk er plukket opp av scanner-runner."}>
            {job ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-white">{jobStatusText(job)}</p>
                  <StatusBadge>{job.status}</StatusBadge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div><p className="text-slate-400">Queued</p><p className="text-white">{dateTime(job.queued_at)}</p></div>
                  <div><p className="text-slate-400">Started</p><p className="text-white">{dateTime(job.started_at)}</p></div>
                  <div><p className="text-slate-400">Completed</p><p className="text-white">{dateTime(job.completed_at)}</p></div>
                  <div><p className="text-slate-400">Duration</p><p className="text-white">{duration(job.started_at, job.completed_at)}</p></div>
                  <div><p className="text-slate-400">Scanner node</p><p className="text-white">{runner.name || "-"}</p></div>
                  <div><p className="text-slate-400">Egress IP</p><p className="text-white">{runner.egressIp || "-"}</p></div>
                </div>
                {scannedDomains.length ? <p className="mt-3 text-slate-300">Scanned domains: {scannedDomains.join(", ")}</p> : null}
                {job.status === "queued" ? <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-amber-100">Runner har ikke plukket opp jobben ennå.</p> : null}
                {job.status === "failed" && (job.error_message || job.error) ? <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-rose-100">{String(job.error_message || job.error).slice(0, 700)}</p> : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {job.status === "queued" ? (
                    <SecondaryButton type="button" disabled={Boolean(busy) || job.scan_type !== "passive"} onClick={runPassiveJob}>
                      <Play size={16} />{busy === "run-job" ? "Kjører..." : "Kjør passiv scan nå"}
                    </SecondaryButton>
                  ) : null}
                  {job.status === "failed" ? (
                    <SecondaryButton type="button" disabled={Boolean(busy)} onClick={createPassiveJob}>
                      <Play size={16} />{busy === "new-job" ? "Legger i kø..." : "Run passive scan again"}
                    </SecondaryButton>
                  ) : null}
                  {job.status === "completed" ? (
                    <SecondaryButton type="button" disabled={Boolean(busy)} onClick={createPassiveJob}>
                      <Play size={16} />{busy === "new-job" ? "Legger i kø..." : "Ny passiv scan"}
                    </SecondaryButton>
                  ) : null}
                </div>
              </div>
            ) : <EmptyState text="Ingen jobb ennå. Jobb opprettes automatisk når kunden signerer." />}
          </PhoenixPanel>

          <div className="grid gap-4 md:grid-cols-5">
            {["critical", "high", "medium", "low", "info"].map((severity) => (
              <div key={severity} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-sm capitalize text-slate-300">{severity}</p>
                <p className="mt-2 text-3xl font-bold text-white">{counters[severity] || 0}</p>
              </div>
            ))}
          </div>

          <PhoenixPanel title="Scan results">
            {results.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {results.map((result) => (
                  <article key={result.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-white">{result.raw_result?.domain || "Resultat"}</h3>
                      <StatusBadge>{result.status}</StatusBadge>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{result.summary || result.raw_result?.summary || "-"}</p>
                    <p className="mt-2 text-xs text-slate-500">{dateTime(result.created_at)}</p>
                  </article>
                ))}
              </div>
            ) : <EmptyState text="Ingen scan_results lagret ennå." />}
          </PhoenixPanel>

          <PhoenixPanel title="Findings">
            {Object.keys(findingsByDomain).length ? (
              <div className="space-y-4">
                {Object.entries(findingsByDomain).map(([domain, domainFindings]) => (
                  <div key={domain} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <h3 className="font-semibold text-white">{domain}</h3>
                    <div className="mt-3 space-y-2">
                      {domainFindings.map((finding) => (
                        <div key={finding.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="font-semibold text-white">{finding.title}</p>
                            <StatusBadge>{finding.severity}</StatusBadge>
                          </div>
                          <p className="mt-1 text-sm text-slate-300">{finding.description || "-"}</p>
                          {finding.recommendation ? <p className="mt-2 text-sm text-cyan-200">Tiltak: {finding.recommendation}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState text="Ingen scan_findings lagret ennå." />}
          </PhoenixPanel>

          <PhoenixPanel title="Samlet rapport" description="Hovedrapport for kunden/scope. Per-domain rapporter ligger under tekniske rapporter.">
            {job?.status === "completed" ? (
              <div className="mb-4 flex flex-wrap gap-2">
                <SecondaryButton type="button" disabled={busy === "combined-report" || !domainReports.length} onClick={createCombinedReport}>
                  <FileText size={16} />{busy === "combined-report" ? "Genererer..." : "Generer samlet rapport"}
                </SecondaryButton>
                {combinedReports.length ? <a href="#combined-report"><SecondaryButton type="button"><FileText size={16} />Åpne samlet rapport</SecondaryButton></a> : null}
                {(combinedReports.length || domainReports.length) ? <SecondaryButton type="button" onClick={downloadCombinedPdf}><Download size={16} />Last ned samlet PDF</SecondaryButton> : null}
                {primaryReport ? <SecondaryButton type="button" disabled={Boolean(busy)} onClick={() => syncQuoteFromReport(primaryReport)}><FileText size={16} />Opprett/oppdater tilbud</SecondaryButton> : null}
              </div>
            ) : <EmptyState text="Samlet rapport kan genereres når scan job er completed." />}

            {combinedReports.length ? (
              <div id="combined-report" className="space-y-3">
                {combinedReports.map((report) => (
                  <article key={report.id} className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-white">{report.title || "Phoenix Security Assessment - samlet rapport"}</h3>
                        <p className="mt-1 text-sm text-cyan-100">{report.report?.recommendation?.title || "Oppsummering for kunde"} · Score {report.report?.score ?? "-"}/100</p>
                      </div>
                      <StatusBadge>combined</StatusBadge>
                    </div>
                    <p className="mt-3 text-sm text-slate-200">{report.report?.recommendation?.text || "Samlet rapport er generert fra scan results, findings og per-domain rapporter."}</p>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Tekniske rapporter per domene</h3>
            {domainReports.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {domainReports.map((report) => {
                  const primaryFinding = findings.find((finding) => finding.job_id === report.job_id) || report.report?.actions?.[0] || report.report?.findings?.[0];
                  return (
                    <article key={report.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-white">{reportDomain(report)}</h3>
                          <p className="mt-1 text-sm text-slate-400">Score {report.report?.score ?? "-"} / 100 · Grade {report.report?.grade || "-"}</p>
                        </div>
                        <StatusBadge>{report.report?.scanType || "passive"}</StatusBadge>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">{report.report?.summary || report.title}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href={`/admin/security/reports/${report.id}`}><SecondaryButton type="button"><FileText size={16} />Åpne rapport</SecondaryButton></Link>
                        <SecondaryButton type="button" onClick={() => downloadSecurityReportPdf(report)}><Download size={16} />Last ned PDF</SecondaryButton>
                        <SecondaryButton type="button" disabled={Boolean(busy)} onClick={() => createCrmItem("task", report, primaryFinding)}><MessageSquarePlus size={16} />Opprett oppgave</SecondaryButton>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : <EmptyState text="Ingen scan_reports lagret ennå." />}
            </div>
          </PhoenixPanel>
        </>
      ) : null}
    </div>
  );
}
