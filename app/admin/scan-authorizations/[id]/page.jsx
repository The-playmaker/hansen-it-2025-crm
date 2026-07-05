"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Copy, Download, FileText, MessageSquarePlus, Play } from "lucide-react";
import { downloadSecurityReportPdf } from "@/lib/securityScan/exportClient";
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

  const scope = item?.scan_scopes?.[0];
  const runner = job?.metadata?.runner || {};
  const scannedDomains = job?.metadata?.passive_domains_scanned || reports.map(reportDomain);

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

          <PhoenixPanel title="Rapporter" description="Rapportkort per domene med handlinger.">
            {reports.length ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {reports.map((report) => {
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
                        <Link href={`/admin/security/reports/${report.id}`}><SecondaryButton type="button"><FileText size={16} />Open report</SecondaryButton></Link>
                        <SecondaryButton type="button" onClick={() => downloadSecurityReportPdf(report)}><Download size={16} />Download PDF</SecondaryButton>
                        <SecondaryButton type="button" disabled={Boolean(busy)} onClick={() => createCrmItem("task", report, primaryFinding)}><MessageSquarePlus size={16} />Create task</SecondaryButton>
                        <SecondaryButton type="button" disabled={Boolean(busy)} onClick={() => createCrmItem("quote", report, primaryFinding)}><FileText size={16} />Create quote draft</SecondaryButton>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : <EmptyState text="Ingen scan_reports lagret ennå." />}
          </PhoenixPanel>
        </>
      ) : null}
    </div>
  );
}
