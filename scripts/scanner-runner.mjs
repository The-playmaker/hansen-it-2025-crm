#!/usr/bin/env node

import { Resolver } from "node:dns/promises";
import os from "node:os";
import tls from "node:tls";
import { setTimeout as sleep } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

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
  version: "phoenix-scanner-runner-v1",
  path: process.argv[1] || "/opt/phoenix-scanner/app/scanner-runner.mjs"
};

const pollIntervalMs = Math.max(Number(process.env.SCANNER_POLL_INTERVAL_MS || 15000), 5000);
const runOnce = process.env.RUN_ONCE === "1" || process.argv.includes("--once");
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const resolver = new Resolver({ timeout: 5000, tries: 2 });
resolver.setServers((process.env.SCANNER_DNS_SERVERS || "1.1.1.1,8.8.8.8").split(",").map((server) => server.trim()).filter(Boolean));

const domainPattern = /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i;
const severityRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4, ok: 5 };
const dkimSelectors = (process.env.SCANNER_DKIM_SELECTORS || "selector1,selector2,google,default,mail,smtp").split(",").map((selector) => selector.trim()).filter(Boolean);

function log(message, extra = {}) {
  const payload = { ts: new Date().toISOString(), node: runner.name, internalIp: runner.internalIp, egressIp: runner.egressIp, mode: runner.mode, ...extra };
  console.log(`[phoenix-scanner] ${message} ${JSON.stringify(payload)}`);
}

function normalizeDomain(input) {
  return String(input || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0];
}

function safeError(error) {
  return error?.message ? String(error.message).slice(0, 700) : "Unknown scanner error.";
}

function dbSeverity(severity) {
  return ["critical", "high", "medium", "low"].includes(severity) ? severity : "info";
}

function gradeFromScore(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "E";
}

async function resolveSafe(type, name) {
  try {
    if (type === "a") return await resolver.resolve4(name);
    if (type === "aaaa") return await resolver.resolve6(name);
    if (type === "mx") return (await resolver.resolveMx(name)).sort((a, b) => a.priority - b.priority);
    if (type === "txt") return (await resolver.resolveTxt(name)).map((chunks) => chunks.join(""));
    if (type === "ns") return await resolver.resolveNs(name);
  } catch {
    return [];
  }
  return [];
}

async function fetchWeb(domain) {
  const headers = { "user-agent": "PhoenixScanRunner/1.0 passive (+https://hansen-it.com)" };
  const result = {
    httpsReachable: false,
    httpReachable: false,
    httpRedirectsToHttps: null,
    status: null,
    finalUrl: null,
    headers: {},
    rawHeaders: {}
  };

  try {
    const response = await fetch(`https://${domain}/`, { method: "GET", redirect: "manual", headers, signal: AbortSignal.timeout(9000) });
    result.httpsReachable = response.status < 500;
    result.status = response.status;
    result.finalUrl = `https://${domain}/`;
    result.rawHeaders = Object.fromEntries(response.headers.entries());
    result.headers = {
      hsts: Boolean(response.headers.get("strict-transport-security")),
      csp: Boolean(response.headers.get("content-security-policy")),
      xContentTypeOptions: (response.headers.get("x-content-type-options") || "").toLowerCase() === "nosniff",
      frameProtection: Boolean(response.headers.get("x-frame-options")) || (response.headers.get("content-security-policy") || "").includes("frame-ancestors"),
      referrerPolicy: Boolean(response.headers.get("referrer-policy")),
      permissionsPolicy: Boolean(response.headers.get("permissions-policy"))
    };
  } catch (error) {
    result.httpsError = safeError(error);
  }

  try {
    const response = await fetch(`http://${domain}/`, { method: "GET", redirect: "manual", headers, signal: AbortSignal.timeout(9000) });
    result.httpReachable = response.status < 500;
    if ([301, 302, 307, 308].includes(response.status)) {
      result.httpRedirectsToHttps = (response.headers.get("location") || "").startsWith("https://");
    } else {
      result.httpRedirectsToHttps = false;
    }
  } catch (error) {
    result.httpError = safeError(error);
  }

  return result;
}

function checkTls(domain) {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: domain, port: 443, servername: domain, rejectUnauthorized: false, timeout: 8000 }, () => {
      const cert = socket.getPeerCertificate();
      const daysToExpiry = cert?.valid_to ? Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400000) : null;
      const result = {
        ok: true,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError || null,
        protocol: socket.getProtocol(),
        cipher: socket.getCipher()?.name || null,
        issuer: cert?.issuer?.O || cert?.issuer?.CN || null,
        subject: cert?.subject?.CN || null,
        validFrom: cert?.valid_from || null,
        validTo: cert?.valid_to || null,
        daysToExpiry
      };
      socket.destroy();
      resolve(result);
    });
    socket.on("error", (error) => resolve({ ok: false, error: safeError(error) }));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false, error: "TLS connection timed out." });
    });
  });
}

async function checkEmail(domain) {
  const [txt, dmarcTxt, mx] = await Promise.all([
    resolveSafe("txt", domain),
    resolveSafe("txt", `_dmarc.${domain}`),
    resolveSafe("mx", domain)
  ]);

  const spf = txt.find((record) => record.toLowerCase().startsWith("v=spf1"));
  const dmarc = dmarcTxt.find((record) => record.toLowerCase().startsWith("v=dmarc1"));
  const dmarcPolicy = dmarc?.match(/p\s*=\s*(none|quarantine|reject)/i)?.[1]?.toLowerCase() || null;
  const dkim = [];

  for (const selector of dkimSelectors) {
    const records = await resolveSafe("txt", `${selector}._domainkey.${domain}`);
    const record = records.find((entry) => entry.toLowerCase().startsWith("v=dkim1"));
    if (record) dkim.push({ selector, record });
  }

  return {
    hasMx: mx.length > 0,
    mx: mx.map((record) => ({ exchange: record.exchange, priority: record.priority })),
    spf: { present: Boolean(spf), record: spf || null },
    dkim: { present: dkim.length > 0, selectors: dkim },
    dmarc: { present: Boolean(dmarc), policy: dmarcPolicy, record: dmarc || null }
  };
}

async function checkDns(domain) {
  const [a, aaaa, ns] = await Promise.all([
    resolveSafe("a", domain),
    resolveSafe("aaaa", domain),
    resolveSafe("ns", domain)
  ]);
  return { a, aaaa, ns };
}

function finding(findings, item) {
  findings.push({ category: "domain", evidence: {}, recommendation: null, ...item });
}

function buildReport(domain, checks) {
  const { dns, web, tlsInfo, email } = checks;
  const findings = [];
  let score = 0;

  if (dns.a.length || dns.aaaa.length) score += 12;
  finding(findings, {
    id: "dns-records",
    category: "dns",
    title: dns.a.length || dns.aaaa.length ? "DNS peker til offentlige adresser" : "Domenet mangler A/AAAA-records",
    severity: dns.a.length || dns.aaaa.length ? "ok" : "high",
    description: dns.a.length || dns.aaaa.length ? "Domenet har offentlig DNS-oppsett." : "Domenet ser ikke ut til å peke til en webtjeneste.",
    recommendation: dns.a.length || dns.aaaa.length ? null : "Kontroller DNS-sonen og legg inn riktig A/AAAA-record.",
    evidence: dns
  });

  if (web.httpsReachable) score += 18;
  finding(findings, {
    id: "https-reachable",
    category: "http",
    title: web.httpsReachable ? "HTTPS svarer" : "HTTPS svarer ikke",
    severity: web.httpsReachable ? "ok" : "high",
    description: web.httpsReachable ? "Nettstedet svarer via sikker HTTPS-forbindelse." : "Nettstedet ser ikke ut til å være tilgjengelig via sikker HTTPS-forbindelse.",
    recommendation: web.httpsReachable ? null : "Sett opp gyldig TLS/HTTPS på webserver eller CDN.",
    evidence: { status: web.status, error: web.httpsError || null }
  });

  if (web.httpRedirectsToHttps === true) score += 8;
  finding(findings, {
    id: "http-redirect",
    category: "http",
    title: web.httpRedirectsToHttps === true ? "HTTP videresendes til HTTPS" : "HTTP videresendes ikke til HTTPS",
    severity: web.httpRedirectsToHttps === true ? "ok" : "medium",
    description: web.httpRedirectsToHttps === true ? "Besøkende sendes automatisk til sikker versjon." : "Besøkende kan ende på usikret HTTP-versjon.",
    recommendation: web.httpRedirectsToHttps === true ? null : "Sett opp permanent redirect fra HTTP til HTTPS.",
    evidence: { httpReachable: web.httpReachable, httpRedirectsToHttps: web.httpRedirectsToHttps }
  });

  if (tlsInfo.ok && tlsInfo.authorized) score += 18;
  finding(findings, {
    id: "tls-certificate",
    category: "tls",
    title: tlsInfo.ok && tlsInfo.authorized ? "TLS-sertifikat validerer" : "TLS-sertifikat bør kontrolleres",
    severity: tlsInfo.ok && tlsInfo.authorized ? "ok" : "high",
    description: tlsInfo.ok && tlsInfo.authorized ? "Sertifikatet validerer i passiv kontroll." : "Sertifikatet kunne ikke valideres trygt fra scanner-node.",
    recommendation: tlsInfo.ok && tlsInfo.authorized ? null : "Kontroller sertifikat, mellomliggende sertifikater og automatisk fornyelse.",
    evidence: tlsInfo
  });

  const presentHeaders = Object.entries(web.headers || {}).filter(([, present]) => present).map(([name]) => name);
  score += Math.min(14, presentHeaders.length * 3);
  finding(findings, {
    id: "security-headers",
    category: "headers",
    title: `${presentHeaders.length} sikkerhetsheadere observert`,
    severity: presentHeaders.length >= 4 ? "ok" : "medium",
    description: presentHeaders.length >= 4 ? "Flere viktige security headers er på plass." : "Noen vanlige security headers mangler eller bør strammes inn.",
    recommendation: presentHeaders.length >= 4 ? null : "Vurder HSTS, CSP, X-Content-Type-Options, frame protection, Referrer-Policy og Permissions-Policy.",
    evidence: { presentHeaders, headers: web.rawHeaders }
  });

  if (email.hasMx) score += 5;
  if (email.spf.present) score += 8;
  if (email.dkim.present) score += 7;
  if (email.dmarc.present && email.dmarc.policy !== "none") score += 10;
  finding(findings, {
    id: "email-authentication",
    category: "email",
    title: "E-postbeskyttelse kontrollert",
    severity: email.hasMx && email.spf.present && email.dkim.present && email.dmarc.present ? "ok" : "high",
    description: `MX ${email.hasMx ? "funnet" : "mangler"}, SPF ${email.spf.present ? "funnet" : "mangler"}, DKIM ${email.dkim.present ? "funnet" : "ikke funnet med standard selectors"}, DMARC ${email.dmarc.present ? `funnet (${email.dmarc.policy || "ukjent policy"})` : "mangler"}.`,
    recommendation: email.hasMx && email.spf.present && email.dkim.present && email.dmarc.present ? null : "Sett opp SPF, DKIM og DMARC. DMARC bør etter hvert ha quarantine eller reject-policy.",
    evidence: email
  });

  const roundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const actions = findings
    .filter((item) => item.recommendation)
    .sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9));

  return {
    domain,
    scannedAt: new Date().toISOString(),
    scanner: runner,
    scanType: "passive",
    score: roundedScore,
    grade: gradeFromScore(roundedScore),
    summary: roundedScore >= 75 ? "Grunnsikringen ser god ut. Se funn for mulige forbedringer." : "Flere viktige grunnsikringspunkter bør følges opp.",
    categories: {
      dns: { score: dns.a.length || dns.aaaa.length ? 12 : 0, max: 12 },
      web: { score: web.httpsReachable ? 18 : 0, max: 18 },
      tls: { score: tlsInfo.ok && tlsInfo.authorized ? 18 : 0, max: 18 },
      headers: { score: Math.min(14, presentHeaders.length * 3), max: 14 },
      email: { score: (email.hasMx ? 5 : 0) + (email.spf.present ? 8 : 0) + (email.dkim.present ? 7 : 0) + (email.dmarc.present && email.dmarc.policy !== "none" ? 10 : 0), max: 30 }
    },
    checks,
    findings,
    actions
  };
}

async function claimOldestQueuedJob() {
  const query = supabase
    .from("scan_jobs")
    .select("*")
    .eq("status", "queued");

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
    runner_started_at: startedAt
  };

  const { data: claimed, error: claimError } = await supabase
    .from("scan_jobs")
    .update({ status: "running", started_at: startedAt, completed_at: null, error: null, error_message: null, metadata })
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
  await supabase
    .from("scan_jobs")
    .update({
      status: "failed",
      completed_at: failedAt,
      error: message,
      error_message: message,
      metadata: { ...(job.metadata || {}), runner, runner_failed_at: failedAt }
    })
    .eq("id", job.id);
  log("job failed", { jobId: job.id, error: message });
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
      metadata: { ...(job.metadata || {}), runner, runner_completed_at: completedAt, passive_domains_scanned: domains }
    })
    .eq("id", job.id);
}

async function persist(job, authorization, report) {
  const rawResult = { ...report, runner };
  const { data: result, error: resultError } = await supabase
    .from("scan_results")
    .insert({ job_id: job.id, authorization_id: authorization.id, status: "completed", summary: report.summary, raw_result: rawResult })
    .select("*")
    .single();

  if (resultError) throw resultError;

  const findings = report.findings.map((item) => ({
    result_id: result.id,
    job_id: job.id,
    authorization_id: authorization.id,
    title: item.title,
    description: item.description || null,
    severity: dbSeverity(item.severity),
    category: item.category || null,
    recommendation: item.recommendation || null,
    evidence: { ...(item.evidence || {}), scanner: runner, finding_id: item.id },
    status: "open"
  }));

  if (findings.length) {
    const { error } = await supabase.from("scan_findings").insert(findings);
    if (error) throw error;
  }

  const { error: reportError } = await supabase
    .from("scan_reports")
    .insert({ job_id: job.id, authorization_id: authorization.id, title: `Phoenix Security Report: ${report.domain}`, report: rawResult });

  if (reportError) throw reportError;
}

async function passiveScanDomain(domain) {
  const normalized = normalizeDomain(domain);
  if (!domainPattern.test(normalized)) throw new Error(`Invalid domain in scope: ${domain}`);

  const dns = await checkDns(normalized);
  const [web, tlsInfo, email] = await Promise.all([
    fetchWeb(normalized),
    checkTls(normalized),
    checkEmail(normalized)
  ]);

  return buildReport(normalized, { dns, web, tlsInfo, email });
}

async function runJob(job) {
  const { data: authorization, error: authError } = await supabase
    .from("scan_authorizations")
    .select("*")
    .eq("id", job.authorization_id)
    .single();

  if (authError || !authorization) throw new Error("Missing scan_authorization.");
  if (authorization.status !== "signed") throw new Error("Scan authorization is not signed.");
  if (job.scan_type !== "passive") throw new Error(`Runner mode '${runner.mode}' supports only scan_type='passive'. Got '${job.scan_type}'.`);

  const domains = (job.domains || []).map(normalizeDomain).filter(Boolean);
  if (!domains.length) throw new Error("Passive scan requires at least one domain.");

  const completedDomains = [];
  for (const domain of domains) {
    log("scanning domain", { jobId: job.id, domain });
    const report = await passiveScanDomain(domain);
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

if (process.env.SCANNER_MODE && process.env.SCANNER_MODE !== "passive" && (!egressDedicated || !allowActiveScan)) {
  console.error("[phoenix-scanner] Active scanner mode blocked. Shared egress or SCANNER_ALLOW_ACTIVE_SCAN=false only permits passive scans.");
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
