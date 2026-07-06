import { checkEmail } from "@/lib/securityScan/checks/email";
import { checkWeb } from "@/lib/securityScan/checks/web";
import { checkTls } from "@/lib/securityScan/checks/tls";
import { checkDnssec, discoverSubdomains, resolveA } from "@/lib/securityScan/checks/dns";
import { checkDomainRegistration } from "@/lib/securityScan/checks/rdap";
import { buildSecurityReport } from "@/lib/securityScan/score";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

const domainPattern = /^(?!-)[a-z0-9æøå-]{1,63}(\.[a-z0-9æøå-]{1,63})+$/i;

function normalizeDomain(input) {
  return String(input || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0];
}

function safeErrorMessage(error) {
  return error?.message ? String(error.message).slice(0, 500) : "Ukjent scanner-feil.";
}

function dbSeverity(severity) {
  return ["critical", "high", "medium", "low"].includes(severity) ? severity : "info";
}

async function updateJob(jobId, payload) {
  await supabaseAdmin.from("scan_jobs").update(payload).eq("id", jobId);
}

async function loadJob(jobId) {
  const { data, error } = await supabaseAdmin.from("scan_jobs").select("*").eq("id", jobId).single();
  if (error || !data) throw new Error("Fant ikke scan_job.");
  return data;
}

async function loadOldestQueuedJob() {
  const { data, error } = await supabaseAdmin
    .from("scan_jobs")
    .select("*")
    .eq("status", "queued")
    .eq("scan_type", "passive")
    .order("queued_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function claimJob(job) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("scan_jobs")
    .update({
      status: "running",
      started_at: now,
      error: null,
      error_message: null,
      metadata: {
        ...(job.metadata || {}),
        runner: "phoenix-scanner-runner",
        runner_started_at: now
      }
    })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("*")
    .single();
  if (error || !data) throw new Error("Kunne ikke reservere scan_job. Den kan allerede være plukket opp.");
  return data;
}

async function loadAuthorization(job) {
  const { data, error } = await supabaseAdmin
    .from("scan_authorizations")
    .select("*")
    .eq("id", job.authorization_id)
    .single();
  if (error || !data) throw new Error("Mangler scan_authorization for jobben.");
  return data;
}

async function passiveScanDomain(domain) {
  const normalized = normalizeDomain(domain);
  if (!domainPattern.test(normalized)) throw new Error(`Ugyldig domene i scope: ${domain}`);

  const ips = await resolveA(normalized);
  const wwwIps = ips.length ? ips : await resolveA(`www.${normalized}`);
  if (!ips.length && !wwwIps.length) throw new Error(`Fant ingen DNS A-records for ${normalized}.`);

  const [web, email, dnssec, rdap, subdomains] = await Promise.all([
    checkWeb(normalized).catch(() => ({ reachable: false, headers: {} })),
    checkEmail(normalized).catch(() => ({ hasMx: false, mx: [], spf: { present: false }, dmarc: { present: false }, dkim: { present: false, selectors: [] }, mtaSts: false, tlsRpt: false })),
    checkDnssec(normalized).catch(() => ({ enabled: null })),
    checkDomainRegistration(normalized).catch(() => ({ found: false })),
    discoverSubdomains(normalized).catch(() => [])
  ]);

  const tlsInfo = web.reachable ? await checkTls(web.finalHost || normalized).catch(() => ({ ok: false })) : { ok: false };
  return buildSecurityReport({ domain: normalized, web, tlsInfo, email, dnssec, rdap, subdomains });
}

async function persistReport({ job, authorization, report }) {
  const { data: result, error: resultError } = await supabaseAdmin
    .from("scan_results")
    .insert({
      job_id: job.id,
      authorization_id: authorization.id,
      status: "completed",
      summary: report.summary,
      raw_result: report
    })
    .select("*")
    .single();
  if (resultError) throw resultError;

  const findings = (report.findings || []).map((finding) => ({
    result_id: result.id,
    job_id: job.id,
    authorization_id: authorization.id,
    title: finding.title || finding.id || "Phoenix Scan-funn",
    description: finding.explain || finding.description || null,
    severity: dbSeverity(finding.severity || finding.status),
    category: finding.category || null,
    recommendation: finding.fix || null,
    evidence: {
      id: finding.id || null,
      status: finding.status || null,
      raw: finding
    },
    status: "open"
  }));

  if (findings.length) {
    const { error: findingsError } = await supabaseAdmin.from("scan_findings").insert(findings);
    if (findingsError) throw findingsError;
  }

  const { data: scanReport, error: reportError } = await supabaseAdmin
    .from("scan_reports")
    .insert({
      job_id: job.id,
      authorization_id: authorization.id,
      title: `Phoenix Security Report: ${report.domain}`,
      report
    })
    .select("*")
    .single();
  if (reportError) throw reportError;

  return { result, scanReport, findingsCount: findings.length };
}

export async function runPassiveScanJob(jobId = null) {
  if (!hasSupabaseAdminConfig) {
    return { ok: false, status: 503, error: "Supabase er ikke konfigurert." };
  }

  let job = jobId ? await loadJob(jobId) : await loadOldestQueuedJob();
  if (!job) return { ok: true, idle: true, message: "Ingen queued scan_jobs." };
  if (job.status !== "queued") return { ok: false, status: 409, error: `scan_job har status '${job.status}', ikke queued.` };
  if (job.scan_type !== "passive") {
    return { ok: false, status: 403, error: "Active scanning disabled – shared egress IP. Bare passive scan_jobs kan kjøres nå." };
  }

  job = await claimJob(job);

  try {
    const authorization = await loadAuthorization(job);
    if (authorization.status !== "signed") {
      throw new Error("Scan authorization er ikke signert. Jobben kan ikke kjøres.");
    }

    const domains = Array.isArray(job.domains) ? job.domains.map(normalizeDomain).filter(Boolean) : [];
    if (!domains.length) throw new Error("Passive scan krever minst ett domene i scope.");

    const reports = [];
    const persisted = [];
    for (const domain of domains) {
      const report = await passiveScanDomain(domain);
      reports.push(report);
      persisted.push(await persistReport({ job, authorization, report }));
    }

    const completedAt = new Date().toISOString();
    await updateJob(job.id, {
      status: "completed",
      completed_at: completedAt,
      error: null,
      error_message: null,
      metadata: {
        ...(job.metadata || {}),
        completed_by: "phoenix-scanner-runner",
        completed_at: completedAt,
        passive_domains_scanned: reports.map((report) => report.domain)
      }
    });

    return { ok: true, jobId: job.id, status: "completed", reports: reports.length, persisted };
  } catch (error) {
    const message = safeErrorMessage(error);
    await updateJob(job.id, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error: message,
      error_message: message,
      metadata: {
        ...(job.metadata || {}),
        failed_by: "phoenix-scanner-runner"
      }
    });
    return { ok: false, jobId: job.id, status: "failed", error: message };
  }
}
