#!/usr/bin/env node
/**
 * Phoenix scanner node runner (standalone, outside Next.js).
 *
 * Scoring is NOT done here — lib/securityScan/score.js (buildSecurityReport)
 * is the single source of truth, shared with the CRM API scan path.
 */

import os from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { checkWeb } from "../lib/securityScan/checks/web.js";
import { checkTls } from "../lib/securityScan/checks/tls.js";
import { checkEmail } from "../lib/securityScan/checks/email.js";
import {
  checkDnssec,
  discoverSubdomains,
} from "../lib/securityScan/checks/dns.js";
import { checkDomainRegistration } from "../lib/securityScan/checks/rdap.js";
import {
  checkExposedBackend,
  isActiveScanAllowed,
  skippedExposedBackend,
} from "../lib/securityScan/checks/exposedBackend.js";
import { assertPublicTarget } from "../lib/securityScan/guards.js";
import { buildSecurityReport } from "../lib/securityScan/score.js";
import {
  assessDomainDns,
  InvalidDomainError,
} from "../lib/scanAuthorizationValidation.js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[phoenix-scanner] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Runner must run server-side only.");
  process.exit(1);
}

function envFlag(name, defaultValue = false) {
  const value = process.env[name];
  if (value == null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

const egressDedicated = envFlag("SCANNER_EGRESS_DEDICATED", false);
const allowActiveScan = envFlag("SCANNER_ALLOW_ACTIVE_SCAN", false);
const egressType = process.env.SCANNER_EGRESS_TYPE || "shared_proxmox_nat";

const runner = {
  name: process.env.SCANNER_NODE_NAME || os.hostname() || "phoenix-scan01",
  internalIp: process.env.SCANNER_INTERNAL_IP || "10.200.1.20",
  egressIp: process.env.SCANNER_EGRESS_IP || "185.243.217.163",
  egressType,
  egressDedicated,
  allowActiveScan,
  mode: process.env.SCANNER_MODE || "passive",
  version: "phoenix-scanner-runner-v2",
  path: process.argv[1] || "/opt/phoenix-scanner/app/scanner-runner.mjs",
};

const pollIntervalMs = Math.max(Number(process.env.SCANNER_POLL_INTERVAL_MS || 15000), 5000);
const runOnce = process.env.RUN_ONCE === "1" || process.argv.includes("--once");
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const domainPattern = /^(?!-)[a-z0-9æøå-]{1,63}(\.[a-z0-9æøå-]{1,63})+$/i;

function log(message, extra = {}) {
  const payload = {
    ts: new Date().toISOString(),
    node: runner.name,
    internalIp: runner.internalIp,
    egressIp: runner.egressIp,
    mode: runner.mode,
    ...extra,
  };
  console.log(`[phoenix-scanner] ${message} ${JSON.stringify(payload)}`);
}

function normalizeDomain(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0];
}

function safeError(error) {
  return error?.message ? String(error.message).slice(0, 700) : "Unknown scanner error.";
}

function dbSeverity(severity) {
  return ["critical", "high", "medium", "low"].includes(severity) ? severity : "info";
}

/**
 * Run the same checks as lib/scanJobs.js / API scan, then score via buildSecurityReport.
 */
async function passiveScanDomain(domain, { authorizationSigned = false } = {}) {
  const normalized = normalizeDomain(domain);
  if (!domainPattern.test(normalized)) throw new Error(`Invalid domain in scope: ${domain}`);

  await assertPublicTarget(normalized);

  const dnsPresence = await assessDomainDns(normalized);
  if (dnsPresence.empty) {
    throw new InvalidDomainError(normalized, dnsPresence.suggestion);
  }

  const [web, email, dnssec, rdap, subdomains] = await Promise.all([
    checkWeb(normalized).catch(() => ({ reachable: false, headers: {} })),
    checkEmail(normalized).catch(() => ({
      hasMx: false,
      mx: [],
      spf: { present: false },
      dmarc: { present: false },
      dkim: { present: false, selectors: [] },
      mtaSts: false,
      tlsRpt: false,
    })),
    checkDnssec(normalized).catch(() => ({ enabled: null })),
    checkDomainRegistration(normalized).catch(() => ({ found: false })),
    discoverSubdomains(normalized).catch(() => []),
  ]);

  const tlsInfo = web.reachable
    ? await checkTls(web.finalHost || normalized).catch(() => ({ ok: false }))
    : { ok: false };

  let exposedBackend = skippedExposedBackend("not_authorized");
  if (authorizationSigned && isActiveScanAllowed()) {
    exposedBackend = await checkExposedBackend(normalized).catch(() =>
      skippedExposedBackend("check_failed")
    );
  }

  const report = buildSecurityReport({
    domain: normalized,
    web,
    tlsInfo,
    email,
    dnssec,
    rdap,
    subdomains,
    exposedBackend,
    dnsPresence,
  });

  return {
    ...report,
    scanner: runner,
    scanType: "passive",
  };
}

async function claimOldestQueuedJob() {
  const query = supabase.from("scan_jobs").select("*").eq("status", "queued");

  if (!runner.egressDedicated || !runner.allowActiveScan || runner.mode === "passive") {
    query.eq("scan_type", "passive");
  }

  const { data: queued, error } = await query
    .order("queued_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!queued) return null;

  const startedAt = new Date().toISOString();
  const metadata = {
    ...(queued.metadata || {}),
    runner,
    runner_started_at: startedAt,
  };

  const { data: claimed, error: claimError } = await supabase
    .from("scan_jobs")
    .update({
      status: "running",
      started_at: startedAt,
      completed_at: null,
      error: null,
      error_message: null,
      metadata,
    })
    .eq("id", queued.id)
    .eq("status", "queued")
    .select("*")
    .single();

  if (claimError) throw claimError;
  return claimed;
}

async function failJob(job, error) {
  const message = safeError(error);
  const failedAt = new Date().toISOString();
  const isInvalidDomain = error?.code === "invalid_domain" || error instanceof InvalidDomainError;
  await supabase
    .from("scan_jobs")
    .update({
      status: isInvalidDomain ? "invalid_domain" : "failed",
      completed_at: failedAt,
      error: message,
      error_message: message,
      metadata: {
        ...(job.metadata || {}),
        runner,
        runner_failed_at: failedAt,
        ...(isInvalidDomain
          ? {
              invalid_domain: error.domain || null,
              suggestion: error.suggestion || null,
            }
          : {}),
      },
    })
    .eq("id", job.id);
  log(isInvalidDomain ? "job invalid_domain" : "job failed", {
    jobId: job.id,
    error: message,
    suggestion: error.suggestion || null,
  });
}

async function completeJob(job, domains) {
  const completedAt = new Date().toISOString();
  await supabase
    .from("scan_jobs")
    .update({
      status: "completed",
      completed_at: completedAt,
      error: null,
      error_message: null,
      metadata: {
        ...(job.metadata || {}),
        runner,
        runner_completed_at: completedAt,
        passive_domains_scanned: domains,
      },
    })
    .eq("id", job.id);
}

async function persist(job, authorization, report) {
  const rawResult = { ...report, runner };
  const { data: result, error: resultError } = await supabase
    .from("scan_results")
    .insert({
      job_id: job.id,
      authorization_id: authorization.id,
      customer_id: job.customer_id || authorization.customer_id || null,
      request_id: job.request_id || authorization.request_id || null,
      status: "completed",
      summary: report.summary,
      raw_result: rawResult,
    })
    .select("*")
    .single();

  if (resultError) throw resultError;

  const findings = (report.findings || []).map((item) => ({
    result_id: result.id,
    job_id: job.id,
    authorization_id: authorization.id,
    title: item.title || item.id || "Phoenix Scan-funn",
    description: item.explain || item.description || null,
    severity: dbSeverity(item.severity || item.status),
    category: item.category || null,
    recommendation: item.fix || item.recommendation || null,
    evidence: item.evidence ?? null,
    status: "open",
  }));

  if (findings.length) {
    const { error } = await supabase.from("scan_findings").insert(findings);
    if (error) throw error;
  }

  const { error: reportError } = await supabase.from("scan_reports").insert({
    job_id: job.id,
    authorization_id: authorization.id,
    customer_id: job.customer_id || authorization.customer_id || null,
    contact_id: job.contact_id || authorization.contact_id || null,
    request_id: job.request_id || authorization.request_id || null,
    quote_id: job.quote_id || authorization.quote_id || null,
    lead_id: job.lead_id || authorization.lead_id || null,
    title: `Phoenix Security Report: ${report.domain}`,
    report: rawResult,
  });

  if (reportError) throw reportError;
}

async function runJob(job) {
  const { data: authorization, error: authError } = await supabase
    .from("scan_authorizations")
    .select("*")
    .eq("id", job.authorization_id)
    .single();

  if (authError || !authorization) throw new Error("Missing scan_authorization.");
  if (authorization.status !== "signed") throw new Error("Scan authorization is not signed.");
  if (job.scan_type !== "passive") {
    throw new Error(
      `Runner mode '${runner.mode}' supports only scan_type='passive'. Got '${job.scan_type}'.`
    );
  }

  const domains = (job.domains || []).map(normalizeDomain).filter(Boolean);
  if (!domains.length) throw new Error("Passive scan requires at least one domain.");

  for (const domain of domains) {
    await assertPublicTarget(domain);
  }

  const completedDomains = [];
  for (const domain of domains) {
    log("scanning domain", { jobId: job.id, domain });
    const report = await passiveScanDomain(domain, { authorizationSigned: true });
    await persist(job, authorization, report);
    completedDomains.push(domain);
  }

  await completeJob(job, completedDomains);
  log("job completed", { jobId: job.id, domains: completedDomains });
}

async function pollOnce() {
  const job = await claimOldestQueuedJob();
  if (!job) return false;

  log("job claimed", { jobId: job.id, scanType: job.scan_type, domains: job.domains || [] });
  try {
    await runJob(job);
  } catch (error) {
    await failJob(job, error);
  }
  return true;
}

let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
  log("SIGINT received, stopping after current poll");
});
process.on("SIGTERM", () => {
  stopping = true;
  log("SIGTERM received, stopping after current poll");
});

log("runner started", { pollIntervalMs, runOnce });

if (!runner.egressDedicated) {
  log("active scanning disabled - shared egress IP", { egressType: runner.egressType });
}

if (!runner.allowActiveScan) {
  log("external_active, nmap and vuln scan disabled by SCANNER_ALLOW_ACTIVE_SCAN=false");
}

if (runner.mode !== "passive" || !runner.egressDedicated || !runner.allowActiveScan) {
  runner.mode = "passive";
}

if (
  process.env.SCANNER_MODE &&
  process.env.SCANNER_MODE !== "passive" &&
  (!egressDedicated || !allowActiveScan)
) {
  console.error(
    "[phoenix-scanner] Active scanner mode blocked. Shared egress or SCANNER_ALLOW_ACTIVE_SCAN=false only permits passive scans."
  );
  process.exit(1);
}

do {
  try {
    const worked = await pollOnce();
    if (!worked) log("no queued jobs");
  } catch (error) {
    log("poll error", { error: safeError(error) });
  }

  if (runOnce || stopping) break;
  await sleep(pollIntervalMs);
} while (!stopping);

log("runner stopped");
